import { describe, expect, it } from "vitest";
import { formatIdentity, parseIdentity } from "../../src/client/version-badge";

const IDENTITY = { product: "Hexframe", release: "v0.6.0", commit: "abc123def456", change: "HF-062" };

describe("deployment identity", () => {
  it("reads as product, release and short commit", () => {
    expect(formatIdentity(IDENTITY)).toBe("Hexframe v0.6.0 · abc123d");
  });

  it("leaves a commit that is not a hash alone rather than truncating it", () => {
    expect(formatIdentity({ ...IDENTITY, commit: "unknown" })).toBe("Hexframe v0.6.0 · unknown");
  });

  it("accepts a well-formed identity", () => {
    expect(parseIdentity(IDENTITY)).toMatchObject({ release: "v0.6.0", commit: "abc123def456" });
  });

  it("rejects anything that is not one, rather than displaying a half-identity", () => {
    for (const bad of [null, "v0.6.0", {}, { product: "Hexframe" }, { ...IDENTITY, commit: "" }]) {
      expect(parseIdentity(bad)).toBeNull();
    }
  });
});
