/**
 * SHARED WIZARDGANG TEMPLATE — build-time deployment identity.
 *
 * Writes `version.json` into the build output so the running system can state exactly
 * which code it is. The version string is never typed by hand: it is derived from the
 * release tag being built and the commit being built, so production identity cannot drift
 * from the repository.
 *
 * Usage:  node scripts/version-stamp.mjs <product> <outDir>
 * Env:    RELEASE  release tag being deployed (falls back to the nearest tag, then 0.0.0-dev)
 *         CHANGE   optional change ID this deployment carries
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [product = "Unknown", outDir = "dist"] = process.argv.slice(2);

const git = (...args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

// A dirty tree must never be mistaken for the tagged state it was built from.
const dirty = git("status", "--porcelain") !== "";
const commit = git("rev-parse", "HEAD") || "unknown";
const release = process.env.RELEASE || git("describe", "--tags", "--abbrev=0") || "0.0.0-dev";

const identity = {
  product,
  release: dirty ? `${release}+dirty` : release,
  commit,
  change: process.env.CHANGE || null,
  builtAt: new Date().toISOString(),
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "version.json"), JSON.stringify(identity, null, 2) + "\n");
console.log(`version.json → ${outDir}`, identity);
