import { describe, expect, it } from "vitest";

import { shadowMoneyRetirementRedirect } from "../../src/worker/shadowmoney-retirement";

describe("ShadowMoney retirement boundary", () => {
  it.each(["/", "/play/", "/training/", "/lab/", "/codex/", "/loadouts/"])(
    "preserves %s on the Hexframe hostname",
    (path) => {
      const response = shadowMoneyRetirementRedirect(
        new Request(`https://shadowmoney.wizardgang.ai${path}`),
      );

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(`https://hexframe.wizardgang.ai${path}`);
    },
  );

  it("preserves queries without forwarding request credentials", () => {
    const response = shadowMoneyRetirementRedirect(new Request(
      "https://shadowmoney.wizardgang.ai/training/?mode=training&slot=2",
      { headers: { authorization: "Bearer old-origin-only" } },
    ));

    expect(response.headers.get("location")).toBe(
      "https://hexframe.wizardgang.ai/training/?mode=training&slot=2",
    );
    expect(response.headers.has("authorization")).toBe(false);
  });

  it("uses the retirement security policy", () => {
    const response = shadowMoneyRetirementRedirect(
      new Request("https://shadowmoney.wizardgang.ai/play/"),
    );

    expect(response.headers.get("strict-transport-security")).toContain("includeSubDomains");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
