import type { Env } from "../env";
import { credentialsConfigured } from "../auth/credentials";
import { verifySessionCookie } from "../auth/session";

const CODEX_DOCUMENT = "/codex/index.html";

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location,
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

async function asset(env: Env, url: URL, path: string): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL(path, url.origin), { method: "GET" }));
}

export async function handleCodex(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const session = credentialsConfigured(env)
    ? await verifySessionCookie(env, request.headers.get("cookie"))
    : null;
  if (!session) {
    const next = `${url.pathname}${url.search}`;
    return redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const lastSegment = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  const wantsFile = lastSegment.includes(".");
  const assetPath = wantsFile ? url.pathname : CODEX_DOCUMENT;
  const upstream = await asset(env, url, assetPath);
  if (upstream.status === 404) {
    return new Response(wantsFile ? `Not found: ${url.pathname}\n` : "The Codex bundle is unavailable.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const headers = new Headers(upstream.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("cache-control", wantsFile ? "public, max-age=31536000, immutable" : "no-store");
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
