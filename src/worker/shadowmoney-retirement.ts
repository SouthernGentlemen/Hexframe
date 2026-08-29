const DESTINATION = "https://hexframe.wizardgang.ai";

// Cloudflare retains the historical Durable Object namespace even though retirement
// traffic no longer binds or calls it. Keeping the class export preserves stored saves
// and keeps the previous application version recoverable without a destructive migration.
export { PlayerSaveObject } from "./player-save-object";

const SECURITY_HEADERS = {
  "cache-control": "public, max-age=3600",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
} as const;

/**
 * Permanent, path-preserving retirement boundary for the former product hostname.
 *
 * The destination is fixed rather than derived from the request host, so Host/header
 * manipulation cannot turn this Worker into an open redirect. Query strings are retained
 * for old bookmarks and deep links; request bodies and credentials are never forwarded.
 */
export function shadowMoneyRetirementRedirect(request: Request): Response {
  const incoming = new URL(request.url);
  const destination = new URL(incoming.pathname, DESTINATION);
  destination.search = incoming.search;

  return new Response(null, {
    status: 308,
    headers: { ...SECURITY_HEADERS, location: destination.toString() },
  });
}

export default {
  fetch(request: Request): Response {
    return shadowMoneyRetirementRedirect(request);
  },
};
