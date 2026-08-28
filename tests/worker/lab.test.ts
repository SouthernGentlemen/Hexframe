import { describe, expect, it } from "vitest";

import { createSessionCookie } from "../../src/worker/auth/session";
import type { Env } from "../../src/worker/env";
import { handleLab } from "../../src/worker/routes/lab";

function environment(): Env {
  return {
    ASSETS: { fetch: async () => new Response("unused") } as unknown as Fetcher,
    ENVIRONMENT: "test",
    ADMIN_USERNAME: "operator",
    ADMIN_PASSWORD: "test-password",
    ADMIN_SESSION_SECRET: "test-session-secret-that-is-long-enough",
  };
}

describe("retired laboratory route", () => {
  it("sends an unauthenticated visitor to ordinary Training", async () => {
    const url = new URL("https://hexframe.test/lab/");
    const response = await handleLab(new Request(url), environment(), url);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/training/?mode=training");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("preserves deep paths and query parameters in the public redirect", async () => {
    const url = new URL("https://hexframe.test/lab/moves/1?slot=2");
    const response = await handleLab(new Request(url), environment(), url);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/training/moves/1?slot=2&mode=training");
  });

  it("redirects a verified operator to Training developer tools", async () => {
    const env = environment();
    const url = new URL("https://hexframe.test/lab/");
    const cookie = await createSessionCookie(env, "operator", 60, url);
    const response = await handleLab(new Request(url, { headers: { cookie } }), env, url);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/training/?mode=training&debug=1");
  });

  it("still redirects safely when operator credentials are not configured", async () => {
    const env = {
      ASSETS: { fetch: async () => new Response("unused") } as unknown as Fetcher,
      ENVIRONMENT: "test",
    };
    const url = new URL("https://hexframe.test/lab/");
    const response = await handleLab(new Request(url), env, url);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/training/?mode=training");
  });
});
