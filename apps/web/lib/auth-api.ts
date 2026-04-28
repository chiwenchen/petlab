import { API_BASE } from "./env";

interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  created_at: number;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  data?: { token: string; user: AuthUser };
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function requestOtp(email: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/auth/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<unknown>;
  if (!res.ok || !body.success) return { ok: false, error: body.error ?? `http_${res.status}` };
  return { ok: true };
}

export async function verifyOtp(email: string, code: string): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<{ token: string; user: AuthUser }>;
  if (!res.ok || !body.success || !body.data) {
    return { ok: false, error: body.error ?? `http_${res.status}` };
  }
  return { ok: true, data: body.data };
}

export async function fetchMe(token: string): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as ApiEnvelope<{ user: AuthUser }>;
  return body.success && body.data ? body.data.user : null;
}
