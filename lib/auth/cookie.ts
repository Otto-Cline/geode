// HMAC-signed auth cookie. Web Crypto API so this runs in both the Edge
// runtime (middleware) and Node runtime (route handlers).

export const AUTH_COOKIE_NAME = "geode_auth";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  const decoded = atob(b64 + "=".repeat(pad));
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

export async function makeAuthCookieValue(secret: string): Promise<string> {
  const ts = Date.now().toString();
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(ts),
  );
  return `${ts}.${toBase64Url(sig)}`;
}

export async function verifyAuthCookieValue(
  value: string,
  secret: string,
): Promise<boolean> {
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [ts, sigB64] = parts;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Date.now() - tsNum > TTL_MS) return false;
  try {
    const key = await importKey(secret);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sigB64),
      new TextEncoder().encode(ts),
    );
  } catch {
    return false;
  }
}
