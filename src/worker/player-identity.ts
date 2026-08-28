import type { Env } from "./env";
import { cookieSecureFor, timingSafeEqual } from "./auth/session";

const PLAYER_COOKIE = "hf_player";
const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signature(secret: string, playerId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(playerId)));
}

function cookieValue(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === PLAYER_COOKIE) return rest.join("=");
  }
  return null;
}

export async function resolvePlayerIdentity(
  request: Request,
  env: Env,
  url: URL,
): Promise<{ playerId: string; setCookie?: string } | null> {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const existing = cookieValue(request.headers.get("cookie"));
  if (existing) {
    const separator = existing.lastIndexOf(".");
    if (separator > 0) {
      const playerId = existing.slice(0, separator);
      const mac = existing.slice(separator + 1);
      if (PLAYER_ID_PATTERN.test(playerId)) {
        const expected = await signature(secret, playerId);
        if (timingSafeEqual(mac, expected)) return { playerId };
      }
    }
  }

  const playerId = crypto.randomUUID();
  const mac = await signature(secret, playerId);
  const secure = cookieSecureFor(url) ? "; Secure" : "";
  return {
    playerId,
    setCookie: `${PLAYER_COOKIE}=${playerId}.${mac}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict${secure}`,
  };
}
