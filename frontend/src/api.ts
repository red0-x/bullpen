import { storage } from "@/src/utils/storage";

export const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const BASE = `${BACKEND}/api`;
const TOKEN_KEY = "auth_token";
const REFRESH_KEY = "refresh_token";

let token: string | null = null;
let onLoggedOut: (() => void) | null = null;

export class ApiError extends Error {
  status: number;
  detail: any;
  constructor(status: number, detail: any) {
    super(typeof detail === "string" ? detail : "Request failed");
    this.status = status;
    this.detail = detail;
  }
}

export const getToken = () => token;
export const setLoggedOutHandler = (fn: () => void) => { onLoggedOut = fn; };

export async function loadTokens() {
  token = await storage.secureGet(TOKEN_KEY, null as string | null);
  return token;
}

export async function saveTokens(access: string, refresh?: string) {
  token = access;
  await storage.secureSet(TOKEN_KEY, access);
  if (refresh) await storage.secureSet(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  token = null;
  await storage.secureRemove(TOKEN_KEY);
  await storage.secureRemove(REFRESH_KEY);
}

async function tryRefresh(): Promise<boolean> {
  const refresh = await storage.secureGet(REFRESH_KEY, null as string | null);
  if (!refresh) return false;
  try {
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!r.ok) return false;
    const d = await r.json();
    await saveTokens(d.access_token, d.refresh_token);
    return true;
  } catch {
    return false;
  }
}

type Opts = { method?: string; body?: any; params?: Record<string, any>; timeout?: number; retried?: boolean };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, params, timeout = 20000 } = opts;
  const qs = params
    ? "?" + Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
    : "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e: any) {
    throw new ApiError(0, e?.name === "AbortError" ? "That took too long. Please try again." : "You seem to be offline. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  const auth = path.startsWith("/auth/login") || path.startsWith("/auth/register") || path.startsWith("/auth/refresh");
  if (res.status === 401 && !auth && !opts.retried) {
    if (await tryRefresh()) return api<T>(path, { ...opts, retried: true });
    await clearTokens();
    onLoggedOut?.();
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? "Something went wrong. Please try again.");
  return data as T;
}

export function errorText(err: any): string {
  const detail = err?.detail;
  if (!detail) return err?.message || "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || "").filter(Boolean).join(" ") || "Please check the form.";
  return detail.msg || String(detail);
}

export const photoSource = (path?: string | null) =>
  path ? { uri: `${BACKEND}${path}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined } : null;
