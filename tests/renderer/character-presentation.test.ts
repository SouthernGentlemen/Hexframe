import { describe, expect, it } from "vitest";

import idle from "../../characters/test_fighter/animations/idle.json";
import standingLight from "../../characters/test_fighter/animations/standing_light.json";
import walkBackward from "../../characters/test_fighter/animations/walk_backward.json";
import walkForward from "../../characters/test_fighter/animations/walk_forward.json";
import playerRig from "../../characters/test_fighter/rig.json";
import { BELL_WARDEN } from "../../src/content/bell-warden";
import { BELL_WARDEN_ANIMATIONS, BELL_WARDEN_RIG } from "../../src/content/bell-warden-assets";
import { ADDITIONAL_ANIMATIONS } from "../../src/content/additional-animations";
import { STATE_ANIMATIONS } from "../../src/content/state-animations";

const READY = {
  arm_upper_l: -14,
  arm_lower_l: -34,
  arm_upper_r: -20,
  arm_lower_r: -46,
} as const;

function armRotations(animation: { keyframes: readonly { bones: unknown }[] }): Record<keyof typeof READY, number | undefined> {
  const bones = animation.keyframes[0].bones as Record<string, { rotation?: number } | undefined>;
  return Object.fromEntries(Object.keys(READY).map((bone) => [bone, bones[bone]?.rotation])) as Record<keyof typeof READY, number | undefined>;
}

describe("character presentation authoring", () => {
  it("keeps every generated attack on the same authored player reference pose", () => {
    const parts = Object.fromEntries(playerRig.parts.map((part) => [part.name, part]));
    expect(parts.arm_upper_l.pivot.x).toBe(-2);
    expect(parts.arm_upper_r.pivot.x).toBe(2);
    expect(armRotations(idle)).toEqual(READY);
    expect(armRotations(standingLight).arm_upper_r).toBe(READY.arm_upper_r);
    expect(armRotations(standingLight).arm_lower_r).toBe(READY.arm_lower_r);
    for (const animation of Object.values(ADDITIONAL_ANIMATIONS)) {
      expect(armRotations(animation)).toEqual(READY);
    }

    // Both guards must put both hands in front of the torso. Negative lower-arm
    // rotations turn the nested forearms backward and caused the sideways flail.
    for (const name of ["block_stand", "block_crouch"] as const) {
      const block = armRotations(STATE_ANIMATIONS[name]);
      expect(block.arm_upper_l).toBeGreaterThan(0);
      expect(block.arm_lower_l).toBeGreaterThan(0);
      expect(block.arm_upper_r).toBeGreaterThan(0);
      expect(block.arm_lower_r).toBeGreaterThan(0);
    }

    expect(walkForward.keyframes).toHaveLength(9);
    expect(walkBackward.keyframes).toHaveLength(9);
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
