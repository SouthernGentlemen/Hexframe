/**
 * The signed session cookie that gates advanced Training developer tools.
 *
 * There is no session store. The cookie carries its own username and expiry and is
 * authenticated by an HMAC over both, keyed with `ADMIN_SESSION_SECRET`, so a Worker
 * isolate that has never seen a request before can still decide whether a cookie is
 * genuine. The cost of that choice is that a session cannot be revoked before it expires;
 * with one operator and a twelve-hour lifetime that is an acceptable trade, and the day
 * it stops being acceptable the answer is a Durable Object holding real sessions rather
 * than a longer cookie.
 *
 * Wire format, all one cookie value:
 *
 *     base64url(username) "." expiry "." base64url(HMAC-SHA256(base64url(username) "." expiry))
 *
 * The MAC covers the exact bytes that travel, not a re-encoding of them, which is what
 * stops a decode-then-verify mismatch from ever becoming a forgery.
 */
import type { Env } from "../env";

export const SESSION_COOKIE = "sm_session";

/** How long a login lasts. Long enough for a working day, short enough to expire. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Returns `null` rather than throwing, because malformed input here is a hostile cookie. */
function base64urlDecode(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await hmacKey(secret);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64urlEncode(new Uint8Array(mac));
}

/**
 * Compare two strings without letting the time taken reveal where they first differ.
 *
 * The loop always runs over the longer string and folds a length mismatch into the same
 * accumulator, so an attacker learns neither the length of the expected value nor the
 * position of the first wrong character. It is not a hardware-level guarantee — the
 * engine's string representation is out of our hands — but it removes the obvious signal.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

/**
 * Whether the `Secure` attribute belongs on a cookie set for this URL.
 *
 * It is derived from the request, never from `ENVIRONMENT` or any other variable, because
 * a variable can be set wrongly in production and this flag is exactly the one that must
 * not be. The single exemption is plain http on a loopback host, which is what
 * `wrangler dev` serves and what browsers refuse to store a `Secure` cookie from. Any
 * other http origin still gets `Secure` — the cookie will then fail to stick, which is
 * the correct outcome for a deployment that is not on https.
 */
export function cookieSecureFor(url: URL): boolean {
  if (url.protocol !== "http:") return true;
  const host = url.hostname;
  return !(host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1");
}

function cookieAttributes(secure: boolean): string {
  // HttpOnly keeps the cookie out of reach of any script on the page, and SameSite=Strict
  // means a link or form from another site never carries it — the developer surface has no
  // cross-site flows at all, so the strictest setting costs nothing.
  return `Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

/**
 * Build the `Set-Cookie` header value for a freshly authenticated session.
 *
 * `url` is optional only so that the contracted three-argument call stays valid; when it
 * is omitted the cookie is marked `Secure`, because failing closed is the right default
 * for a flag whose absence is the vulnerability.
 */
export async function createSessionCookie(
  env: Env,
  username: string,
  ttlSeconds: number,
  url?: URL,
): Promise<string> {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const encodedUser = base64urlEncode(encoder.encode(username));
  const payload = `${encodedUser}.${expires}`;
  const mac = await sign(secret, payload);

  const secure = url ? cookieSecureFor(url) : true;
  return `${SESSION_COOKIE}=${payload}.${mac}; Max-Age=${ttlSeconds}; ${cookieAttributes(secure)}`;
}

/** Pull one cookie's value out of a raw `Cookie` header. */
function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return part.slice(eq + 1).trim();
  }
  return null;
}

/**
 * Verify a `Cookie` header and return the session it carries, or `null`.
 *
 * Every failure — no header, no cookie, wrong shape, bad base64, non-numeric expiry, bad
 * MAC, expired — returns the same `null`. The caller has no way to tell them apart and
 * neither has the client, which is deliberate: a response that distinguished "signature
 * wrong" from "expired" would tell a forger that their signature was right.
 */
export async function verifySessionCookie(
  env: Env,
  header: string | null,
): Promise<{ username: string; expires: number } | null> {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret || !header) return null;

  const raw = readCookie(header, SESSION_COOKIE);
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [encodedUser, expiryText, mac] = parts as [string, string, string];

  // A strict decimal test rather than Number(): "0x10", "1e3" and " 1" all parse as
  // numbers and none of them is a value this Worker ever wrote.
  if (!/^[0-9]{1,15}$/.test(expiryText)) return null;
  const expires = Number(expiryText);

  const expected = await sign(secret, `${encodedUser}.${expiryText}`);
  if (!timingSafeEqual(expected, mac)) return null;

  // Expiry is checked after the MAC so that an unauthenticated cookie can never reach
  // this branch at all; the order does not leak anything, since both paths return null.
  if (expires <= Math.floor(Date.now() / 1000)) return null;

  const userBytes = base64urlDecode(encodedUser);
  if (!userBytes) return null;

  return { username: decoder.decode(userBytes), expires };
}

/**
 * The `Set-Cookie` header value that removes the session.
 *
 * `url` is optional for the same reason as in `createSessionCookie`, but here the default
 * matters in the other direction: a browser on http://localhost rejects a `Secure`
 * cookie outright, so a logout that always sent `Secure` would silently fail to log
 * anyone out during local development.
 */
export function clearSessionCookie(url?: URL): string {
  const secure = url ? cookieSecureFor(url) : true;
  return `${SESSION_COOKIE}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${cookieAttributes(secure)}`;
}
