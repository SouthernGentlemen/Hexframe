import { describe, expect, it } from "vitest";

import { DEFAULT_MOVE_LOADOUT, MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import {
  actionSlotLabel,
  describeMoveFrame,
  equippedSummary,
  routeForMove,
} from "../../src/lab/move-presentation";

describe("player-facing move presentation", () => {
  it("derives equipped locations and duplicate counts from the active loadout", () => {
    const loadout = DEFAULT_MOVE_LOADOUT.slice();
    loadout[8] = MoveId.PrismBurst;
    loadout[9] = MoveId.PrismBurst;
    expect(equippedSummary(loadout, MoveId.PrismBurst)).toContain("EQUIPPED × 2");
    expect(equippedSummary(loadout, MoveId.PrismBurst)).toContain(actionSlotLabel(8));
    expect(equippedSummary(loadout, MoveId.PrismBurst)).toContain(actionSlotLabel(9));
    expect(equippedSummary(loadout, MoveId.ThunderClap)).toBe("NOT EQUIPPED");
  });

  it("builds the visible route from authored cancel targets", () => {
    const ember = TEST_FIGHTER.moves.find((move) => move.id === MoveId.EmberPalm)!;
    const bastion = TEST_FIGHTER.moves.find((move) => move.id === MoveId.BastionBreak)!;
    expect(routeForMove(ember, TEST_FIGHTER).map((move) => move.key)).toEqual([
      "ember_palm", "ashen_sweep", "phoenix_drive",
    ]);
    expect(routeForMove(bastion, TEST_FIGHTER).map((move) => move.key)).toEqual([
      "storm_knuckle", "static_rush", "bastion_break",
    ]);
  });

  it("describes exact authoritative hitbox, cancel, armor, and movement frames", () => {
    const rift = TEST_FIGHTER.moves.find((move) => move.id === MoveId.RiftUppercut)!;
    expect(describeMoveFrame(rift, 0, TEST_FIGHTER)).toContain("Invulnerability: Strike");
    expect(describeMoveFrame(rift, rift.hitboxes[0].startFrame, TEST_FIGHTER)).toContain("Hitbox: x");
    expect(describeMoveFrame(rift, rift.cancelWindows[0].startFrame, TEST_FIGHTER)).toContain("Cancel: astral jab");

    const bastion = TEST_FIGHTER.moves.find((move) => move.id === MoveId.BastionBreak)!;
    expect(describeMoveFrame(bastion, 0, TEST_FIGHTER)).toContain("Armor: 1 hit");
  });
});
