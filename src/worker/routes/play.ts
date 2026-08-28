/**
 * Public playtest surface.
 *
 * `/play/` deliberately reuses the browser-only laboratory bundle: the bundle contains
 * combat content and local UI, but no credentials or privileged server capability. The
 * operator document and API remain gated at `/lab/*` and `/api/lab/*`.
 */
import type { Env } from "../env";

const LAB_DOCUMENT = "/lab/index.html";
const PLAY_ASSET_PREFIX = "/play/assets/";

async function asset(env: Env, url: URL, path: string): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL(path, url.origin), { method: "GET" }));
}

export async function handlePlay(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const lastSegment = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  const wantsFile = lastSegment.includes(".");
  if (wantsFile && !url.pathname.startsWith(PLAY_ASSET_PREFIX)) {
    return new Response(`Not found: ${url.pathname}\n`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const assetPath = wantsFile ? url.pathname.replace(/^\/play\//, "/lab/") : LAB_DOCUMENT;
  const upstream = await asset(env, url, assetPath);
  if (upstream.status === 404) {
    return new Response(wantsFile ? `Not found: ${url.pathname}\n` : "The playtest bundle is unavailable.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const headers = new Headers(upstream.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("cache-control", wantsFile ? "public, max-age=31536000, immutable" : "no-store");

  if (request.method === "HEAD") return new Response(null, { status: upstream.status, headers });
  if (wantsFile) return new Response(upstream.body, { status: upstream.status, headers });

  const html = (await upstream.text()).replaceAll('"/lab/assets/', '"/play/assets/');
  headers.delete("content-length");
  return new Response(html, { status: upstream.status, headers });
}
