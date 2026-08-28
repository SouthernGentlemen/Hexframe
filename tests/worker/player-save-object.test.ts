import { describe, expect, it } from "vitest";

import { PlayerSaveObject } from "../../src/worker/player-save-object";
import type { Env } from "../../src/worker/env";

function saveObject(): PlayerSaveObject {
  const values = new Map<string, unknown>();
  const state = {
    storage: {
      get: async <T>(key: string): Promise<T | undefined> => values.get(key) as T | undefined,
      put: async (key: string, value: unknown): Promise<void> => { values.set(key, structuredClone(value)); },
    },
  } as unknown as DurableObjectState;
  const env = { ENVIRONMENT: "test", ASSETS: {} as Fetcher } satisfies Env;
  return new PlayerSaveObject(state, env);
}

describe("player save authority", () => {
  it("grants a boss reward exactly once and advances the revision", async () => {
    const object = saveObject();
    const first = await object.fetch(request("/api/save/progression/boss", "POST", {
      stageId: "black-belfry",
      bossId: "bell-warden",
      revision: 0,
    }));
    const firstBody = await first.json() as any;
    expect(firstBody.save.revision).toBe(1);
    expect(firstBody.save.unlocks.moves).toContain(29);
    expect(firstBody.save.inventory.materials["warden-core"]).toBe(1);

    const repeated = await object.fetch(request("/api/save/progression/boss", "POST", {
      stageId: "black-belfry",
      bossId: "bell-warden",
      revision: 1,
    }));
    const repeatedBody = await repeated.json() as any;
    expect(repeatedBody.alreadyClaimed).toBe(true);
    expect(repeatedBody.save.revision).toBe(1);
    expect(repeatedBody.save.inventory.materials["warden-core"]).toBe(1);
  });

  it("ignores client-authored economy values on profile saves", async () => {
    const object = saveObject();
    const current = await (await object.fetch(request("/api/save"))).json() as any;
    current.inventory.materials["warden-core"] = 999;
    const response = await object.fetch(request("/api/save", "PUT", current));
    const body = await response.json() as any;
    expect(body.save.inventory.materials["warden-core"]).toBe(0);
    expect(body.save.revision).toBe(1);
  });

  it("rejects locked techniques, unowned gear, and spoofed checkpoint progress", async () => {
    const object = saveObject();
    const current = await (await object.fetch(request("/api/save"))).json() as any;
    current.loadouts.byId["loadout-01"].loadout[0] = 29;
    current.loadouts.byId["loadout-01"].equipment.arms = "warden-arms";
    current.campaign.stages["black-belfry"].checkpointId = 202;
    current.campaign.stages["black-belfry"].discovered = ["entity:202"];

    const response = await object.fetch(request("/api/save", "PUT", current));
    const body = await response.json() as any;
    expect(body.save.loadouts.byId["loadout-01"].loadout[0]).not.toBe(29);
    expect(body.save.loadouts.byId["loadout-01"].equipment.arms).toBe("");
    expect(body.save.campaign.stages["black-belfry"].checkpointId).toBe(0);
    expect(body.save.campaign.stages["black-belfry"].discovered).toEqual([]);
  });

  it("validates deterministic stage entities before granting loot", async () => {
    const object = saveObject();
    const response = await object.fetch(request("/api/save/progression/stage-event", "POST", {
      stageId: "black-belfry",
      entityId: 101,
      revision: 0,
    }));
    const body = await response.json() as any;
    expect(body.save.inventory.materials["iron-scrap"]).toBe(3);
    expect(body.save.campaign.stages["black-belfry"].discovered).toContain("entity:101");
  });
});

function request(path: string, method = "GET", body?: unknown): Request {
  return new Request(`https://save.internal${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
