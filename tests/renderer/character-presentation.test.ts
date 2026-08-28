import { describe, expect, it } from "vitest";

import idle from "../../characters/test_fighter/animations/idle.json";
import standingLight from "../../characters/test_fighter/animations/standing_light.json";
import walkBackward from "../../characters/test_fighter/animations/walk_backward.json";
import walkForward from "../../characters/test_fighter/animations/walk_forward.json";
import playerRig from "../../characters/test_fighter/rig.json";
import { BELL_WARDEN } from "../../src/content/bell-warden";
import { BELL_WARDEN_ANIMATIONS, BELL_WARDEN_RIG } from "../../src/content/bell-warden-assets";
import { ADDITIONAL_ANIMATIONS } from "../../src/content/additional-animations";

const GUARD = {
  arm_upper_l: 28,
  arm_lower_l: 66,
  arm_upper_r: 40,
  arm_lower_r: 68,
} as const;

function armRotations(animation: { keyframes: readonly { bones: unknown }[] }): Record<keyof typeof GUARD, number | undefined> {
  const bones = animation.keyframes[0].bones as Record<string, { rotation?: number } | undefined>;
  return Object.fromEntries(Object.keys(GUARD).map((bone) => [bone, bones[bone]?.rotation])) as Record<keyof typeof GUARD, number | undefined>;
}

describe("character presentation authoring", () => {
  it("uses separated shoulders and one forward-guard reference for core player clips", () => {
    const parts = Object.fromEntries(playerRig.parts.map((part) => [part.name, part]));
    expect(parts.arm_upper_l.pivot.x).toBe(-8);
    expect(parts.arm_upper_r.pivot.x).toBe(8);
    expect(armRotations(idle)).toEqual(GUARD);
    expect(armRotations(walkForward)).toEqual(GUARD);
    expect(armRotations(walkBackward)).toEqual(GUARD);
    expect(armRotations(standingLight)).toEqual(GUARD);
    for (const animation of Object.values(ADDITIONAL_ANIMATIONS)) {
      expect(armRotations(animation)).toEqual(GUARD);
    }
  });

  it("gives the Bell Warden a dedicated broad rig and every required clip", () => {
    const parts = Object.fromEntries(BELL_WARDEN_RIG.parts.map((part) => [part.name, part]));
    expect(parts.arm_upper_l.pivot.x).toBeLessThan(-40);
    expect(parts.arm_upper_r.pivot.x).toBeGreaterThan(40);
    expect(BELL_WARDEN_RIG.root).toBe("pelvis");
    expect(Object.keys(BELL_WARDEN_ANIMATIONS)).toEqual(expect.arrayContaining([
      "idle", "walk_forward", "hit_stand", "stagger", "phase_transition", "defeat",
      ...BELL_WARDEN.moves.map((move) => move.animation),
    ]));
    expect(BELL_WARDEN_ANIMATIONS.idle.keyframes).not.toEqual(ADDITIONAL_ANIMATIONS.ember_palm.keyframes);
  });
});
