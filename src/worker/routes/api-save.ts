import type { Env } from "../env";
import { resolvePlayerIdentity } from "../player-identity";

export async function handleSaveApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.PLAYER_SAVES || !env.ADMIN_SESSION_SECRET) {
    return Response.json({ error: "save_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!allowed(request.method, url.pathname)) {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { allow: url.pathname === "/api/save" ? "GET, PUT" : "POST", "cache-control": "no-store" } });
  }
  const identity = await resolvePlayerIdentity(request, env, url);
  if (!identity) return Response.json({ error: "save_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  const id = env.PLAYER_SAVES.idFromName(identity.playerId);
  const response = await env.PLAYER_SAVES.get(id).fetch(request);
  if (!identity.setCookie) return response;
  const headers = new Headers(response.headers);
  headers.append("set-cookie", identity.setCookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function allowed(method: string, path: string): boolean {
  if (path === "/api/save") return method === "GET" || method === "PUT";
  return method === "POST" && [
    "/api/save/progression/boss",
    "/api/save/progression/stage-event",
    "/api/save/armory/craft",
    "/api/save/campaign/reset",
  ].includes(path);
}
