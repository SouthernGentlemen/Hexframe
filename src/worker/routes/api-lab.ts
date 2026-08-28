/**
 * `/api/lab/*` — the laboratory's own API, behind the same session gate as the page.
 *
 * The surface is deliberately two endpoints. Everything the laboratory does is computed
 * in the browser from a deterministic simulation, so the server has nothing to offer it:
 * no state, no authority, no scoring. What is left is the pair of things only the server
 * can do — tell the page whether its session is still alive, and be somewhere a desync
 * report can go. Anything richer than that belongs to the `MatchRoom` Durable Object in
 * 0.2, and adding it here first would only build a second place for match state to live.
 */
import type { Env } from "../env";
import { missingCredentialBindings } from "../env";
import { credentialsConfigured } from "../auth/credentials";
import { verifySessionCookie } from "../auth/session";

/** A desync report is a frame number, two hashes and a short note. */
const MAX_DESYNC_BODY_BYTES = 2048;

/** Truncation point for the free-text note, applied before it ever reaches a log line. */
const MAX_NOTE_CHARS = 240;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

/**
 * The laboratory API.
 *
 * Every failure is JSON, because the caller is `fetch` from a script and an HTML error
 * page would arrive as an unreadable parse error at exactly the moment something is
 * already wrong.
 */
export async function handleLabApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (!credentialsConfigured(env)) {
    return json(
      { error: "unavailable", missing: missingCredentialBindings(env) },
      503,
    );
  }

  const session = await verifySessionCookie(env, request.headers.get("cookie"));
  if (!session) return json({ error: "unauthorized" }, 401);

  if (url.pathname === "/api/lab/session") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    // The username is echoed only to a caller that already presented a valid session for
    // that username, so this reveals nothing it did not arrive holding. The password and
    // the signing secret never leave the Worker in any form.
    return json({ username: session.username, expires: session.expires }, 200);
  }

  if (url.pathname === "/api/lab/desync") {
    if (request.method !== "POST") return methodNotAllowed("POST");
    return handleDesync(request);
  }

  return json({ error: "not_found" }, 404);
}

function methodNotAllowed(allow: string): Response {
  const response = json({ error: "method_not_allowed", allow }, 405);
  const headers = new Headers(response.headers);
  headers.set("allow", allow);
  return new Response(response.body, { status: 405, headers });
}

/**
 * Record one desync report.
 *
 * The body is read as bytes and measured before it is parsed, because `Content-Length` is
 * a claim by the client and a chunked body carries no length at all. The report is logged
 * and nothing else: a desync is a bug in the simulation, and what it needs is a frame
 * number and two hashes in front of whoever is debugging it, not a database row. Nothing
 * from the session — username included — goes into the log line.
 */
async function handleDesync(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_DESYNC_BODY_BYTES) {
    return json({ error: "payload_too_large", limit: MAX_DESYNC_BODY_BYTES }, 413);
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_DESYNC_BODY_BYTES) {
    return json({ error: "payload_too_large", limit: MAX_DESYNC_BODY_BYTES }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return json({ error: "invalid_report" }, 400);
  }

  const raw = parsed as Record<string, unknown>;
  const frame = raw["frame"];
  if (typeof frame !== "number" || !Number.isSafeInteger(frame) || frame < 0) {
    return json({ error: "invalid_report", field: "frame" }, 400);
  }

  const localHash = hashField(raw["localHash"]);
  if (localHash === null) return json({ error: "invalid_report", field: "localHash" }, 400);
  const remoteHash = hashField(raw["remoteHash"]);
  if (remoteHash === null) return json({ error: "invalid_report", field: "remoteHash" }, 400);

  const rawNote = raw["note"];
  const note = typeof rawNote === "string" ? rawNote.slice(0, MAX_NOTE_CHARS) : "";

  console.log(
    JSON.stringify({ event: "lab.desync", frame, localHash, remoteHash, note }),
  );

  return json({ ok: true, frame }, 200);
}

/**
 * A state hash may arrive as the unsigned 32-bit number the hasher returns or as the
 * eight hex digits `hashToHex` produces. Both are accepted and both are normalised to the
 * hex form, so two reports of the same desync read the same in the log.
 */
function hashField(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) return null;
    return value.toString(16).padStart(8, "0");
  }
  if (typeof value === "string" && /^[0-9a-fA-F]{1,8}$/.test(value)) {
    return value.toLowerCase().padStart(8, "0");
  }
  return null;
}
