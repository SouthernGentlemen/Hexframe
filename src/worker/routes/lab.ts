/**
 * Compatibility redirect from the retired laboratory product route.
 *
 * Lab is now the advanced end of Training. A verified operator is redirected with the
 * developer-tools flag; everyone else reaches ordinary Training. The Worker makes that
 * decision before the unified client is served, so typing `debug=1` does not bypass the
 * session gate.
 */
import type { Env } from "../env";
import { credentialsConfigured } from "../auth/credentials";
import { verifySessionCookie } from "../auth/session";

export async function handleLab(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const session = credentialsConfigured(env)
    ? await verifySessionCookie(env, request.headers.get("cookie"))
    : null;
  const suffix = url.pathname.slice("/lab".length);
  const query = new URLSearchParams(url.searchParams);
  query.set("mode", "training");
  if (session) query.set("debug", "1");
  else query.delete("debug");
  const serialized = query.toString();
  const location = `/training${suffix}${serialized ? `?${serialized}` : ""}`;
  return new Response(request.method === "HEAD" ? null : `Opening Training at ${location}\n`, {
    status: 302,
    headers: {
      location,
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
