import { describe, expect, it } from "vitest";

import { aiSlot, defaultSession, readGameSession, sessionUrl, STAGE_CATALOG } from "../../src/game/session";

describe("game session contract", () => {
  it("launches every mode through an explicit shared contract", () => {
    expect(defaultSession("campaign").stageId).toBe("black-belfry-campaign");
    expect(defaultSession("fight").stageId).toBe("black-belfry-arena");
    expect(defaultSession("training").stageId).toBe("training-grid");
    expect(Object.keys(STAGE_CATALOG)).toEqual([
      "black-belfry-campaign",
      "black-belfry-arena",
      "training-grid",
    ]);
    expect(STAGE_CATALOG["training-grid"].stage.id).toBe("training-grid");
  });

  it("round-trips a selected loadout and validates stage variants", () => {
    const fight = defaultSession("fight", "loadout-03");
    const url = new URL(sessionUrl(fight), "https://hexframe.test");
    expect(readGameSession(url)).toEqual(fight);

    url.searchParams.set("stage", "black-belfry-campaign");
    expect(readGameSession(url)?.stageId).toBe("black-belfry-arena");

    url.searchParams.set("opponent", "training-dummy");
    expect(readGameSession(url)?.encounterId).toBe("bell-warden");
  });

  it("round-trips AI party slots as loadout consumers", () => {
    const fight = defaultSession("fight", "loadout-01");
    fight.party.push(aiSlot("loadout-02", 2, "master"));
    const restored = readGameSession(new URL(sessionUrl(fight), "https://hexframe.test"));
    expect(restored).toEqual(fight);
    expect(restored?.party[1].controller).toBe("ai");
    expect(restored?.party[1].aiProfile?.difficulty).toBe("master");
  });

  it("treats the menu route as no active session", () => {
    expect(readGameSession(new URL("https://hexframe.test/play/"))).toBeNull();
  });

  it("round-trips an explicit Training tutorial session", () => {
    const tutorial = defaultSession("training", "loadout-02");
    tutorial.options.tutorial = true;
    const url = sessionUrl(tutorial);
    expect(url).toMatch(/^\/play\/\?/);
    expect(readGameSession(new URL(url, "https://hexframe.test"))).toEqual(tutorial);
  });
});
