import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { DevStoryOutput } from "@/types/devstory";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const STORAGE_BUCKET = "sketches_audio";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function checkBackendHealth(): Promise<{ ok: boolean; status?: string; version?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, status: data.status, version: data.version };
  } catch {
    return { ok: false };
  }
}

export async function fetchProjects(
  userId?: string,
  token?: string
): Promise<Array<any>> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const url = userId
      ? `${API_BASE_URL}/api/projects?user_id=${encodeURIComponent(userId)}`
      : `${API_BASE_URL}/api/projects`;

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function requestUpgradePlan(
  userId: string,
  token?: string,
  plan: string = "pro"
): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("plan", plan);

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/api/upgrade-plan`, {
      method: "POST",
      headers,
      body: formData,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveEphemeralProject(
  output: DevStoryOutput,
  userId: string,
  token?: string
): Promise<{ ok: boolean; project_id?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/api/projects/save`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: userId,
        output,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.detail || "Error al guardar proyecto" };
    }

    const data = await res.json();
    return { ok: true, project_id: data.project_id };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error de red al guardar proyecto" };
  }
}

export async function refineProject(
  currentOutput: DevStoryOutput,
  instruction: string,
  userId?: string,
  projectId?: string,
  modelTier: string = "flash",
  token?: string
): Promise<{ ok: boolean; data?: DevStoryOutput; error?: string }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/api/refine`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        current_output: currentOutput,
        instruction,
        user_id: userId,
        project_id: projectId,
        model_tier: modelTier,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.detail || "Error al refinar prototipo" };
    }

    const data = await res.json();
    return { ok: true, data: data.data };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error de conexión al refinar" };
  }
}

export async function deleteProjectApi(
  projectId: string,
  userId?: string,
  token?: string
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = userId
      ? `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}?user_id=${encodeURIComponent(userId)}`
      : `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}
