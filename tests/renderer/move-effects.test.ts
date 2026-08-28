import { describe, expect, it } from "vitest";

import { TEST_FIGHTER } from "../../src/content/test-fighter";
import { moveEffectProfile } from "../../src/renderer/svg/move-effects";

describe("move particle profiles", () => {
  it("gives every move a distinct deterministic visual signature", () => {
    const signatures = TEST_FIGHTER.moves.map((move) => {
      const profile = moveEffectProfile(move.id, move.tags, move.key);
      return [profile.kind, profile.effect, profile.trail, profile.impact].join(":");
    });
    expect(signatures).toHaveLength(29);
    expect(new Set(signatures).size).toBe(29);
  });

  it("assigns technique-specific visual verbs within the same element family", () => {
    expect(moveEffectProfile(3, ["fire", "burn"], "ember_palm").effect).toBe("palm_burst");
    expect(moveEffectProfile(11, ["fire", "burn"], "ashen_sweep").effect).toBe("ground_arc");
    expect(moveEffectProfile(18, ["fire", "burn"], "phoenix_drive").effect).toBe("rising_spiral");
  });

  it("maps status families to readable effect themes", () => {
    expect(moveEffectProfile(3, ["fire", "burn"]).kind).toBe("fire");
    expect(moveEffectProfile(4, ["chaos", "poison"]).kind).toBe("poison");
    expect(moveEffectProfile(5, ["cold", "freeze"]).kind).toBe("freeze");
    expect(moveEffectProfile(6, ["lightning", "shock"]).kind).toBe("shock");
    expect(moveEffectProfile(24, ["elemental", "burn", "freeze", "shock"]).kind).toBe("prism");
  });
});
