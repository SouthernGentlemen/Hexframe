/**
 * The Hexframe Worker.
 *
 * `run_worker_first` is on, so every request in the deployment arrives here — including
 * ones for static files. That lets the Worker validate Training's developer flag, route
 * player saves, and preserve compatibility redirects before an asset is handed out.
 *
 * This file is a router and nothing else. It holds no combat logic, and it never will:
 * the simulation is deterministic and runs in the browser, so the server has no opinion
 * about whether an attack hit. When networked matches arrive in 0.2 they arrive as a
 * Durable Object relaying inputs, not as authority moving here.
 */
import type { Env } from "./env";
import { handleLogin, handleLogout } from "./routes/login";
import { handleLab } from "./routes/lab";
import { handleLabApi } from "./routes/api-lab";
import { handlePlay, handleTraining } from "./routes/play";
import { handleSaveApi } from "./routes/api-save";
export { PlayerSaveObject } from "./player-save-object";

/**
 * Headers put on everything, gated or not.
 *
 * `Set-Cookie` is carried across explicitly with `getSetCookie()`. Ordinary header
 * iteration folds repeated `Set-Cookie` lines into one comma-joined value, which is a
 * silent way to lose a session cookie the day a second one is added.
 */
function harden(response: Response): Response {
  const headers = new Headers(response.headers);
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) {
    headers.delete("set-cookie");
    for (const cookie of cookies) headers.append("set-cookie", cookie);
  }
  headers.set("x-content-type-options", "nosniff");
  if (!headers.has("referrer-policy")) headers.set("referrer-policy", "no-referrer");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function notFound(pathname: string): Response {
  // A real body rather than an empty 404: an empty response during development is
  // indistinguishable from a Worker that crashed, and the two want different fixes.
  return new Response(`Not found: ${pathname}\n`, {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Everything that is not a route: the built client, its hashed bundles, and any file the
 * public shell asks for.
 *
 * The upstream request is rebuilt as a bare GET so that no client header — cookie
 * included — is forwarded to the asset server; there is nothing it needs from one.
 */
async function passThrough(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const upstream = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  if (upstream.status === 404) return notFound(url.pathname);

  const body = request.method === "HEAD" ? null : upstream.body;
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: new Headers(upstream.headers),
  });
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === "/") return handleLab(request, env, url);

  if (path === "/login") return handleLogin(request, env);

  if (path === "/logout") {
    if (request.method !== "POST") {
      return new Response("Method not allowed\n", {
        status: 405,
        headers: { allow: "POST", "content-type": "text/plain; charset=utf-8" },
      });
    }
    return handleLogout(url);
  }

  if (path === "/play" || path.startsWith("/play/")) return handlePlay(request, env, url);

  if (path === "/training" || path.startsWith("/training/")) return handleTraining(request, env, url);

  if (
    path === "/campaign" || path.startsWith("/campaign/") ||
    path === "/fight" || path.startsWith("/fight/") ||
    path === "/loadouts" || path.startsWith("/loadouts/") ||
    path === "/forge" || path.startsWith("/forge/") ||
    path === "/codex" || path.startsWith("/codex/") ||
    path === "/settings" || path.startsWith("/settings/")
  ) return handlePlay(request, env, url);

  if (path === "/lab" || path.startsWith("/lab/")) return handleLab(request, env, url);

  if (path === "/api/lab" || path.startsWith("/api/lab/")) {
    return handleLabApi(request, env, url);
  }

  if (path === "/api/save" || path.startsWith("/api/save/")) {
    return handleSaveApi(request, env, url);
  }

  if (path === "/api" || path.startsWith("/api/")) {
    // Any other /api path is answered as JSON rather than falling through to the assets,
    // where a missing file would come back as an HTML page an API client cannot read.
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  return passThrough(request, env, url);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      return harden(await route(request, env, url));
    } catch (error) {
      // The message is logged, never returned: an internal error string can name a
      // binding, a path or a stack frame, and none of that is the client's business.
      console.error("worker.error", url.pathname, error);
      return harden(
        new Response("Internal error\n", {
          status: 500,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        }),
      );
    }
  },
} satisfies ExportedHandler<Env>;
