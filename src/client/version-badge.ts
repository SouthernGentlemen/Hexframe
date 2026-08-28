/**
 * Deployment identity, shown where a person can read it.
 *
 * The string is never typed by hand: `scripts/version-stamp.mjs` writes `version.json`
 * into the build output from the release tag and commit being built, and this reads it
 * back. A version that is edited by a human is a version that eventually lies.
 */

export interface DeploymentIdentity {
  product: string;
  release: string;
  commit: string;
  change?: string | null;
  builtAt?: string;
}

/** Short commit, the way a person cites one. */
function shortCommit(commit: string): string {
  return /^[0-9a-f]{7,40}$/i.test(commit) ? commit.slice(0, 7) : commit;
}

/** `Hexframe v0.6.0 · abc123d` — the whole point is that it is boring and correct. */
export function formatIdentity(identity: DeploymentIdentity): string {
  return `${identity.product} ${identity.release} · ${shortCommit(identity.commit)}`;
}

/**
 * Anything may be on the other end of a fetch, including an index.html served by a
 * misconfigured fallback. A shape that is not an identity is treated as no identity.
 */
export function parseIdentity(value: unknown): DeploymentIdentity | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.product !== "string" || typeof raw.release !== "string") return null;
  if (typeof raw.commit !== "string" || raw.commit === "") return null;
  return {
    product: raw.product,
    release: raw.release,
    commit: raw.commit,
    change: typeof raw.change === "string" ? raw.change : null,
    builtAt: typeof raw.builtAt === "string" ? raw.builtAt : undefined,
  };
}

/**
 * Render the badge into `host`, replacing any previous one.
 *
 * `appendChild` and `removeChild` are used rather than `append` and `remove`: this project
 * compiles with `@cloudflare/workers-types` alongside the DOM lib, and the Worker types
 * shadow those two names with incompatible signatures.
 */
export function renderVersionBadge(host: HTMLElement, identity: DeploymentIdentity): HTMLElement {
  const previous = host.querySelector(".version-badge");
  if (previous && previous.parentNode) previous.parentNode.removeChild(previous);

  const el = host.ownerDocument.createElement("p");
  el.className = "version-badge";
  el.textContent = formatIdentity(identity);
  // Informational, and announced as such rather than read as part of the interface.
  el.setAttribute("role", "contentinfo");
  el.setAttribute("aria-label", `Deployed version: ${formatIdentity(identity)}`);
  host.appendChild(el);
  return el;
}

/**
 * Fetch the identity and show it. A missing or malformed `version.json` is not an error
 * worth breaking a page over: the game is what the visitor came for.
 */
export async function attachVersionBadge(host: HTMLElement): Promise<HTMLElement | null> {
  try {
    const response = await fetch("/version.json", { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const identity = parseIdentity(await response.json());
    return identity ? renderVersionBadge(host, identity) : null;
  } catch {
    return null;
  }
}
