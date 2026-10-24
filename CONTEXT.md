# DevStory AI — Memoria Técnica
SaaS B2B: voz (ES) / texto / boceto a mano → PRD Markdown + historias Jira/Trello (JSON) + diagrama Mermaid + código React/Tailwind. Infra objetivo: $0 (Free Tiers), 24/7.

## Stack
- **Frontend**: Next.js 14 App Router + TS + Tailwind 3 + lucide-react → Vercel. `/frontend`
- **Auth/DB/Storage**: Supabase (OAuth Google + GitHub, PostgreSQL, bucket `sketches_audio`).
- **Backend**: FastAPI (Python) → Render Free. `/backend`. Orquesta Gemini con salida estructurada.
- **IA**: `google-genai`. `gemini-2.5-flash` (multimodal rápido: audio/imagen) · `gemini-2.5-pro` (PRD/código complejo).
- **Anti-sleep**: UptimeRobot → `GET|HEAD /health` cada 5 min.

## Flujo
Browser (MediaRecorder / Drag&Drop / texto) → Storage `sketches_audio/{user_id}/{project_id}/*` → `POST` backend (JWT Supabase) → check cuota → Gemini (`response_schema=DevStoryOutput`) → insert `generations` → UI.

## Datos (`/supabase/schema.sql`)
- `users(id=auth.users.id, email, full_name, avatar_url, plan['free'|'pro'], created_at)` — autocreado por trigger en `auth.users`.
- `projects(id, user_id, name, description, created_at, updated_at)`
- `generations(id, project_id, user_id, input_type['text'|'audio'|'image'|'mixed'], input_text, sketch_path, audio_path, model_used, status['pending'|'completed'|'failed'], title, prd_markdown, jira_json jsonb, mermaid_diagram, react_code, ip_address inet, tokens_used, error_message, created_at)`
- RLS: cada usuario solo ve/edita lo suyo (`auth.uid()`). Storage: carpeta raíz = `auth.uid()`.

## Contrato IA (`backend/app/schemas.py`)
`DevStoryOutput { title: str, prd_markdown: str, jira_json: list[JiraStory], mermaid_diagram: str, react_code: str }`
`JiraStory { summary, description, acceptance_criteria[], story_points, priority, issue_type }`

## Módulos UI
- **Documentador** (`DocumentadorPRD`): PRD (Objetivo, Historias, Criterios de Aceptación, Flujos) vía react-markdown + render Mermaid.
- **Canvas/UI** (`CanvasPreview`): iframe `sandbox` con Babel standalone + Tailwind CDN; renderiza `react_code` en vivo.
- **Exportador** (`Exportador`): descarga `.md`, `.json` (Jira/Trello), copiar código React.
- **Input** (`MultimodalInput`): texto + MediaRecorder + Drag&Drop imagen.

## Reglas técnicas
1. Rate limit: Free = máx 5 generaciones/mes calendario (trigger `enforce_generation_quota` en DB, por usuario y por IP). Pro = ilimitado.
2. Toda inferencia usa salida estructurada Pydantic/JSON Schema; nunca parsear texto libre.
3. Validar sintaxis de `react_code` antes de inyectarlo al sandbox (Babel transform en try/catch).
4. `/health` ligero (sin DB/IA), soporta GET y HEAD.
5. Backend usa `SUPABASE_SERVICE_ROLE_KEY` solo en servidor; frontend solo `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Plan Free: bocetos + export Markdown. Pro: audio continuo, export React y Jira API.

## Fase 7: Modo Invitado Efímero, Refinamiento IA, Editor Hot-Reload y PWA
- **Modo Invitado 100% Efímero**: Inferencia en memoria RAM sin persistencia ni Storage; rescate automático en DB al registrarse con `POST /api/projects/save`. Límite de 1 generación de prueba sin cuenta.
- **Refinamiento Iterativo con IA**: `POST /api/refine` orquesta cascada resiliente con Gemini para alterar prototipo según instrucciones del usuario.
- **Editor de Código en Vivo**: Vista dual con debounce de 400ms para Babel Standalone y modo Pantalla Completa.
- **Entregables Adicionales**: Descarga de prototipo autocontenido `.html` y diagrama de arquitectura vectorial `.svg`.
- **PWA y Responsividad Blindada**: Soporte manifest standalone, viewport móvil anti-overflow (`overflow-x-hidden`, `min-w-0`), y pizarra táctil con `ResizeObserver` + `touch-none`.

## Fase 8: Corrección Supabase SDK, Eliminación de Demo y Navbar Móvil Cero-Overflow
- **Corrección SDK Supabase**: Sintaxis corregida de `supabase.table` a `supabase.from("users")` (0 errores TypeScript en `npx tsc --noEmit`).
- **Limpieza de UI**: Eliminación del indicador "Backend 24/7" y borrado definitivo de la función/botón "Dibujar Demo" en la pizarra para herramientas de dibujo 100% reales.
- **Navbar Móvil Responsivo Cero-Overflow**: Eliminado `overflow-x-auto` en la barra superior; arquitectura desktop limpia y menú desplegable móvil (`md:hidden`) con cuota, referidos y Modo Focus.
- **Controles Multimodales Móviles**: Apilado responsivo (`flex-col sm:flex-row`) y rejilla al 100% en pantallas móviles para selectores de modelo y herramientas de boceto.
