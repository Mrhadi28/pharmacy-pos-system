import crypto from "node:crypto";

function secret(): string {
  return process.env.SESSION_SECRET || "pharma-pos-secret-2024";
}

export interface WsTokenPayload {
  userId: number;
  pharmacyId: number;
  exp: number;
}

export function signWsToken(payload: WsTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyWsToken(
  token: string | null,
): { ok: true; pharmacyId: number; userId: number } | { ok: false } {
  if (!token?.includes(".")) return { ok: false };
  const i = token.lastIndexOf(".");
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!body || !sig) return { ok: false };
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return { ok: false };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false };
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as WsTokenPayload;
    if (typeof payload.pharmacyId !== "number" || typeof payload.userId !== "number") return { ok: false };
    if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false };
    return { ok: true, pharmacyId: payload.pharmacyId, userId: payload.userId };
  } catch {
    return { ok: false };
  }
}
