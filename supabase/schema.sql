-- =============================================================================
-- DevStory AI — Supabase schema
-- Tablas: users, projects, generations | RLS | Storage bucket sketches_audio
-- Rate limiting: plan Free = máx. 2 generaciones/proyectos por mes (usuario e IP)
-- Ejecutar en Supabase SQL Editor (idempotente en lo posible).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.plan_type as enum ('free', 'pro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.input_type as enum ('text', 'audio', 'image', 'mixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.generation_status as enum ('pending', 'completed', 'failed');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Constantes de negocio
-- -----------------------------------------------------------------------------
create or replace function public.free_monthly_limit()
returns integer
language sql
immutable
as $$ select 2 $$;

-- -----------------------------------------------------------------------------
-- Tabla: users (perfil 1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text unique,
  full_name    text,
  avatar_url   text,
  plan         public.plan_type not null default 'free',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Tabla: projects
-- -----------------------------------------------------------------------------
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);

-- -----------------------------------------------------------------------------
-- Tabla: generations (cada inferencia de Gemini)
-- -----------------------------------------------------------------------------
create table if not exists public.generations (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  user_id          uuid not null references public.users (id) on delete cascade,
  input_type       public.input_type not null default 'text',
  input_text       text,
  sketch_path      text,               -- ruta en bucket sketches_audio
  audio_path       text,               -- ruta en bucket sketches_audio
  model_used       text not null default 'gemini-3.8-flash',
  status           public.generation_status not null default 'pending',
  -- Salida estructurada (DevStoryOutput)
  title            text,
  prd_markdown     text,
  jira_json        jsonb,
  mermaid_diagram  text,
  react_code       text,
  -- Telemetría / control
  ip_address       inet,
  tokens_used      integer default 0,
  error_message    text,
  created_at       timestamptz not null default now()
);

create index if not exists generations_user_month_idx
  on public.generations (user_id, created_at desc);
create index if not exists generations_ip_month_idx
  on public.generations (ip_address, created_at desc);
create index if not exists generations_project_idx
  on public.generations (project_id);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Alta automática de perfil al registrarse (OAuth Google / GitHub)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- Integridad: la generación debe pertenecer a un proyecto del mismo usuario
-- -----------------------------------------------------------------------------
create or replace function public.enforce_generation_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.user_id = new.user_id
  ) then
    raise exception 'Project % does not belong to user %', new.project_id, new.user_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists generations_enforce_ownership on public.generations;
create trigger generations_enforce_ownership
  before insert on public.generations
  for each row execute function public.enforce_generation_ownership();

-- -----------------------------------------------------------------------------
-- RATE LIMITING: máx. 2 generaciones / mes calendario (UTC) en plan Free
-- Cuenta por usuario y, si hay IP, también por IP (evita multi-cuentas).
-- Las generaciones 'failed' no consumen cuota.
-- -----------------------------------------------------------------------------
create or replace function public.monthly_generation_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.generations g
  where g.user_id = p_user_id
    and g.status <> 'failed'
    and g.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;

create or replace function public.enforce_generation_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan        public.plan_type;
  v_user_count  integer;
  v_ip_count    integer := 0;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
begin
  select plan into v_plan from public.users where id = new.user_id;

  if v_plan is null then
    raise exception 'User profile % not found', new.user_id using errcode = 'P0002';
  end if;

  if v_plan = 'pro' then
    return new;
  end if;

  -- Serializa inserciones concurrentes del mismo usuario (evita race conditions)
  perform pg_advisory_xact_lock(hashtext('gen_quota_' || new.user_id::text));

  v_user_count := public.monthly_generation_count(new.user_id);

  if new.ip_address is not null then
    select count(*)::int into v_ip_count
    from public.generations g
    join public.users u on u.id = g.user_id
    where g.ip_address = new.ip_address
      and u.plan = 'free'
      and g.status <> 'failed'
      and g.created_at >= v_month_start;
  end if;

  if v_user_count >= public.free_monthly_limit()
     or v_ip_count >= public.free_monthly_limit() then
    raise exception 'RATE_LIMIT_EXCEEDED: Free plan allows % generations per month',
      public.free_monthly_limit()
      using errcode = 'P0429',
            hint = 'Upgrade to Pro for unlimited generations.';
  end if;

  return new;
end;
$$;

drop trigger if exists generations_enforce_quota on public.generations;
create trigger generations_enforce_quota
  before insert on public.generations
  for each row execute function public.enforce_generation_quota();

-- Consulta de cuota restante para la UI (null = ilimitado)
create or replace function public.get_remaining_generations()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan public.plan_type;
begin
  select plan into v_plan from public.users where id = auth.uid();
  if v_plan is null then
    return 0;
  elsif v_plan = 'pro' then
    return null;
  end if;
  return greatest(public.free_monthly_limit() - public.monthly_generation_count(auth.uid()), 0);
end;
$$;

grant execute on function public.get_remaining_generations() to authenticated;
revoke execute on function public.monthly_generation_count(uuid) from public, anon;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.users       enable row level security;
alter table public.projects    enable row level security;
alter table public.generations enable row level security;

-- users: lectura y edición del propio perfil (el plan NO es editable por el cliente)
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select to authenticated using (id = auth.uid());

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Bloquea escalado de plan desde el cliente (solo service_role / backend de pagos)
create or replace function public.prevent_plan_change()
returns trigger
language plpgsql
as $$
begin
  if new.plan is distinct from old.plan
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Plan changes are not allowed from the client' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists users_prevent_plan_change on public.users;
create trigger users_prevent_plan_change
  before update on public.users
  for each row execute function public.prevent_plan_change();

-- projects: CRUD completo sobre los propios
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete to authenticated using (user_id = auth.uid());

-- generations: el cliente solo lee/borra; las inserta el backend (service_role)
drop policy if exists "generations_select_own" on public.generations;
create policy "generations_select_own" on public.generations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "generations_delete_own" on public.generations;
create policy "generations_delete_own" on public.generations
  for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- STORAGE: bucket privado sketches_audio
-- Estructura de rutas: {user_id}/{project_id}/{archivo}
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sketches_audio',
  'sketches_audio',
  false,
  10485760, -- 10 MB
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/heic',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sketches_audio_select_own" on storage.objects;
create policy "sketches_audio_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'sketches_audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "sketches_audio_insert_own" on storage.objects;
create policy "sketches_audio_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sketches_audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "sketches_audio_update_own" on storage.objects;
create policy "sketches_audio_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'sketches_audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'sketches_audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "sketches_audio_delete_own" on storage.objects;
create policy "sketches_audio_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sketches_audio' and (storage.foldername(name))[1] = auth.uid()::text);
