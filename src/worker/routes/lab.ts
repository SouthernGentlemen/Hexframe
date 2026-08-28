/**
 * The gate in front of the laboratory.
 *
 * `run_worker_first` is set in `wrangler.jsonc` precisely so that this function runs
 * before the asset server does. Nothing under `/lab` is served — not the HTML, not a
 * sub-path, not a 404 that would confirm a file exists — until a session cookie verifies.
 * The laboratory bundle itself holds no secret; it is private because it is a development
 * instrument that should not be poked at from outside, and because an unguarded debug
 * console is the sort of thing that quietly becomes an incident later.
 */
import type { Env } from "../env";
import { credentialsConfigured } from "../auth/credentials";
import { verifySessionCookie } from "../auth/session";
import { credentialsUnavailable, safeNextPath } from "./login";

/** The built shell for the laboratory, produced by the `lab` entry in `vite.config.ts`. */
const LAB_DOCUMENT = "/lab/index.html";

function loginRedirect(url: URL): Response {
  const next = safeNextPath(`${url.pathname}${url.search}`);
  const location = `/login?next=${encodeURIComponent(next)}`;
  return new Response(`Sign in required. Redirecting to ${location}\n`, {
    status: 302,
    headers: {
      location,
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

/**
 * Serve one file out of the assets binding.
 *
 * The outgoing request is rebuilt as a bare GET rather than forwarded, so no cookie,
 * `Range`, conditional header or method from the client reaches the asset server. The
 * gate has already decided; the asset fetch is an internal detail.
 */
async function asset(env: Env, url: URL, path: string): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL(path, url.origin), { method: "GET" }));
}

/**
 * `GET /lab` and everything beneath it.
 *
 * A path that names a file (its last segment has an extension) is looked up in the assets
 * binding directly, so a laboratory asset added later is served as itself. Anything else
 * gets the laboratory document, which keeps a deep link such as `/lab/moves/1` working
 * without the Worker needing to know the client's routes.
 */
export async function handleLab(request: Request, env: Env, url: URL): Promise<Response> {
  if (!credentialsConfigured(env)) return credentialsUnavailable(env);

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const session = await verifySessionCookie(env, request.headers.get("cookie"));
  if (!session) return loginRedirect(url);

  const lastSegment = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  const wantsFile = lastSegment.includes(".");

  const upstream = await asset(env, url, wantsFile ? url.pathname : LAB_DOCUMENT);

  if (upstream.status === 404) {
    // A missing file gets a 404 rather than the document. Handing back HTML for a missing
    // script would turn a build mistake into a mystifying parse error in the console.
    const message = wantsFile
      ? `Not found: ${url.pathname}\n`
      : "The laboratory bundle is missing. Run `npm run build`.\n";
    return new Response(message, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // Copied rather than mutated in place: an asset response's headers are immutable.
  const headers = new Headers(upstream.headers);
  // A private page must never be held in a shared cache, and a 12-hour session means a
  // browser-cached copy could otherwise outlive the session that earned it.
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("x-frame-options", "DENY");

  const body = request.method === "HEAD" ? null : upstream.body;
  return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers });
}
