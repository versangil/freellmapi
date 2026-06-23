const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const TOKEN_KEY = 'freellmapi_dashboard_token';

// Dashboard session token (#35). Stored in localStorage; sent as a Bearer on
// every /api request and cleared on a 401.
export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export const UNAUTHORIZED_EVENT = 'freellmapi:unauthorized';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    // `...options` first so an explicit method/body/signal applies, but headers
    // are merged last — otherwise an options.headers would clobber the
    // Content-Type and Authorization we set here.
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    // Session missing/expired — drop the token and let the AuthGate re-render.
    clearToken();
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  }
  // A 200 whose body isn't JSON means this request never reached the API — the
  // usual cause is a reverse proxy (or static host) serving the dashboard's
  // index.html for /api/* instead of forwarding it to the backend. Without this
  // guard the raw res.json() throws an opaque "Unexpected token '<'", which on
  // the setup/login form surfaces as "sign up page cannot work". Say what's
  // actually wrong. (#257)
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Expected JSON from ${path} but got a non-JSON response. The API isn't reachable at this origin — ` +
      `make sure the backend is running and that /api is forwarded to it, not served as the dashboard's static files.`,
    );
  }
}

export async function logout(): Promise<void> {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  clearToken();
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
}

export function estimateTokenCost(
  platform: string | undefined,
  _modelId: string | undefined,
  promptTokens: number | undefined,
  completionTokens: number | undefined,
): number | undefined {
  if (!promptTokens || !completionTokens) return undefined;
  const pricing: Record<string, { input: number; output: number }> = {
    openai: { input: 2.5, output: 10 },
    groq: { input: 0.5, output: 2 },
    google: { input: 1, output: 5 },
    anthropic: { input: 3, output: 15 },
    cerebras: { input: 0.04, output: 0.18 },
    cloudflare: { input: 0.1, output: 0.32 },
    cohere: { input: 2.5, output: 10 },
    github: { input: 2, output: 8 },
    huggingface: { input: 0.11, output: 0.8 },
    kilo: { input: 0.09, output: 0.45 },
    llm7: { input: 0.3, output: 0.9 },
    mistral: { input: 0.5, output: 1.5 },
    nvidia: { input: 0.1, output: 0.32 },
    ollama: { input: 0.12, output: 0.37 },
    openrouter: { input: 0.1, output: 0.32 },
    pollinations: { input: 0.03, output: 0.14 },
    zhipu: { input: 0.06, output: 0.4 },
    opencode: { input: 0.1, output: 0.2 },
  };
  const p = pricing[platform ?? ''] ?? { input: 0.2, output: 0.8 };
  const inputPerM = p.input;
  const outputPerM = p.output;
  const cost = (promptTokens / 1e6) * inputPerM + (completionTokens / 1e6) * outputPerM;
  return Math.round(cost * 10000) / 10000;
}
