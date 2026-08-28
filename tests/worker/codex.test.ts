import { describe, expect, it } from "vitest";

import { createSessionCookie } from "../../src/worker/auth/session";
import type { Env } from "../../src/worker/env";
import { handleCodex } from "../../src/worker/routes/codex";

function environment(paths: string[]): Env {
  const assets = {
    fetch: async (input: Request): Promise<Response> => {
      const path = new URL(input.url).pathname;
      paths.push(path);
      if (path === "/codex/index.html") {
        return new Response('<script src="/codex/assets/codex.js"></script>', {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (path === "/codex/assets/codex.js") {
        return new Response("export {};", { headers: { "content-type": "text/javascript" } });
      }
      return new Response("missing", { status: 404 });
    },
  } as unknown as Fetcher;
  return {
    ASSETS: assets,
    ENVIRONMENT: "test",
    ADMIN_USERNAME: "operator",
    ADMIN_PASSWORD: "test-password",
    ADMIN_SESSION_SECRET: "test-session-secret-that-is-long-enough",
  };
}

describe("developer move Codex route", () => {
  it("preserves a deep move URL through sign in without a redirect body", async () => {
    const paths: string[] = [];
    const env = environment(paths);
    const url = new URL("https://hexframe.test/codex/moves/12/");
    const response = await handleCodex(new Request(url), env, url);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?next=%2Fcodex%2Fmoves%2F12%2F");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(await response.text()).toBe("");
    expect(paths).toEqual([]);
  });

  it("serves the animated Codex document to a verified operator", async () => {
    const paths: string[] = [];
    const env = environment(paths);
    const url = new URL("https://hexframe.test/codex/moves/12/");
    const cookie = await createSessionCookie(env, "operator", 60, url);
    const response = await handleCodex(new Request(url, { headers: { cookie } }), env, url);

    expect(response.status).toBe(200);
    expect(paths).toEqual(["/codex/index.html"]);
    expect(await response.text()).toContain("/codex/assets/codex.js");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("serves Codex assets immutably behind the same session", async () => {
    const paths: string[] = [];
    const env = environment(paths);
    const url = new URL("https://hexframe.test/codex/assets/codex.js");
    const cookie = await createSessionCookie(env, "operator", 60, url);
    const response = await handleCodex(new Request(url, { headers: { cookie } }), env, url);

    expect(response.status).toBe(200);
    expect(paths).toEqual(["/codex/assets/codex.js"]);
    expect(response.headers.get("cache-control")).toContain("immutable");
  });
});
