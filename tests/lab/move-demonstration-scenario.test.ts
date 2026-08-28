import { describe, expect, it } from "vitest";

import { ContactKind } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { buildMoveDemonstrationScenario } from "../../src/lab/move-demonstration-scenario";

describe("authoritative move demonstrations", () => {
  const ember = TEST_FIGHTER.moves.find((move) => move.id === MoveId.EmberPalm)!;

  it("emits one real hit event followed by hitstop, reaction, and aftermath", () => {
    const scenario = buildMoveDemonstrationScenario(TEST_FIGHTER, ember, "hit");
    const contacts = scenario.frames.flatMap((frame) => frame.report?.contacts ?? []);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].kind).toBe(ContactKind.Hit);
    expect(scenario.frames.map((frame) => frame.phase)).toEqual(expect.arrayContaining([
      "lead-in", "startup", "contact", "hitstop", "reaction", "aftermath",
    ]));
    expect(scenario.frames.at(-1)?.state.fighters[1].health).toBeLessThan(TEST_FIGHTER.health);
  });

  it("uses the simulation's real block resolution in Block mode", () => {
    const scenario = buildMoveDemonstrationScenario(TEST_FIGHTER, ember, "block");
    const contacts = scenario.frames.flatMap((frame) => frame.report?.contacts ?? []);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].kind).toBe(ContactKind.Block);
    expect(scenario.frames.at(-1)?.state.fighters[1].health).toBe(TEST_FIGHTER.health);
  });

  it("can start and resolve an authored airborne move without parallel physics", () => {
    const dive = TEST_FIGHTER.moves.find((move) => move.id === MoveId.VoidDive)!;
    const scenario = buildMoveDemonstrationScenario(TEST_FIGHTER, dive, "hit");
    expect(scenario.frames.some((frame) => frame.report?.moveStarts.some((event) => event.moveId === dive.id))).toBe(true);
    expect(scenario.frames.some((frame) => frame.state.fighters[0].airborne === 1)).toBe(true);
  });

  it("produces the selected contact result for every catalog move", () => {
    for (const move of TEST_FIGHTER.moves) {
      const hit = buildMoveDemonstrationScenario(TEST_FIGHTER, move, "hit");
      expect(hit.frames.flatMap((frame) => frame.report?.contacts ?? []).map((contact) => contact.kind), move.key).toContain(ContactKind.Hit);
      const block = buildMoveDemonstrationScenario(TEST_FIGHTER, move, "block");
      expect(block.frames.flatMap((frame) => frame.report?.contacts ?? []).map((contact) => contact.kind), move.key).toContain(ContactKind.Block);
    }
  });
});
