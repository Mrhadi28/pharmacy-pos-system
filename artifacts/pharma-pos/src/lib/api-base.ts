/** Browser calls same-origin `/api/...` (Vite dev proxy → API server). */
export function getApiBase(): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return `${base}/api`;
}

/** Absolute API origin for generated client base URL overrides. */
export function getApiOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.origin;
}

export async function readJsonError(res: Response): Promise<string> {
  const raw = await res.text();
  const st = res.status;
  if (!raw) {
    if (st === 502 || st === 503 || st === 504) {
      return `Cannot reach API (${st}). Start the API server (port 8080) and ensure PostgreSQL is running — see .env DATABASE_URL.`;
    }
    return res.statusText || `Request failed (${st})`;
  }
  try {
    const data = JSON.parse(raw) as { error?: string; message?: string; hint?: string };
    const main = data.error || data.message;
    if (main && data.hint) return `${main} — ${data.hint}`;
    if (main) return main;
  } catch {
    /* not JSON */
  }
  if (st === 502 || st === 503 || st === 504) {
    return `Cannot reach API (${st}). Start: api-server on :8080, PostgreSQL on :5432 (docker compose up -d), then: pnpm --filter @workspace/db run push`;
  }
  if (/^\s*<!DOCTYPE/i.test(raw) || /<html[\s>]/i.test(raw)) {
    return `Server error (${st}). If API is running: create tables with pnpm --filter @workspace/db run push. If not: start PostgreSQL first (docker compose up -d).`;
  }
  return raw.slice(0, 280).trim() || `Request failed (${st})`;
}
