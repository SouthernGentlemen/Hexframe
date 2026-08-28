/**
 * The Test Fighter's presentation: the model, the skeleton and the clips.
 *
 * Separate from `test-fighter.ts` for one practical reason and one structural one. The
 * practical: the model arrives through Vite's `?raw` suffix, which a plain Node test run
 * has no idea what to do with, and the simulation suites must be able to import a fighter
 * without one. The structural: this file is exactly the set of things the renderer needs
 * and the simulation must never touch, and a file boundary states that more plainly than
 * a comment could.
 */

import modelSvg from "../../characters/test_fighter/model.svg?raw";
import rigJson from "../../characters/test_fighter/rig.json";

import idleJson from "../../characters/test_fighter/animations/idle.json";
import walkForwardJson from "../../characters/test_fighter/animations/walk_forward.json";
import walkBackwardJson from "../../characters/test_fighter/animations/walk_backward.json";
import standingLightJson from "../../characters/test_fighter/animations/standing_light.json";
import crouchingLightJson from "../../characters/test_fighter/animations/crouching_light.json";
import { ADDITIONAL_ANIMATIONS } from "./additional-animations";
import { STATE_ANIMATIONS } from "./state-animations";
import {
  normalizeIdlePresentation,
  normalizeMovePresentation,
  normalizeStatePresentation,
  normalizeWalkPresentation,
} from "./player-presentation";

import type { RawAnimation, RawRig } from "./raw-types";
import { validateAnimation, validateRig } from "./validate";

export const TEST_FIGHTER_MODEL: string = modelSvg;

export const TEST_FIGHTER_RIG: RawRig = validateRig(rigJson);

/**
 * Clips by name. `MoveDef.animation` and the state-to-clip mapping both index this.
 *
 * The raw files stay readable as authored source material, while a tiny presentation-only
 * normalization layer guarantees that neutral hands remain fighter-forward on both facings.
 * Combat never imports this module, so the correction cannot alter boxes or frame data.
 */
export const TEST_FIGHTER_ANIMATIONS: Record<string, RawAnimation> = {
  idle: validateAnimation(normalizeIdlePresentation(validateAnimation(idleJson)), "animations.idle"),
  walk_forward: validateAnimation(normalizeWalkPresentation(validateAnimation(walkForwardJson)), "animations.walk_forward"),
  walk_backward: validateAnimation(normalizeWalkPresentation(validateAnimation(walkBackwardJson), true), "animations.walk_backward"),
  standing_light: validateAnimation(normalizeMovePresentation(validateAnimation(standingLightJson)), "animations.standing_light"),
  crouching_light: validateAnimation(normalizeMovePresentation(validateAnimation(crouchingLightJson)), "animations.crouching_light"),
  ...Object.fromEntries(
    Object.entries(STATE_ANIMATIONS).map(([name, animation]) => [
      name,
      validateAnimation(normalizeStatePresentation(name, validateAnimation(animation, `animations.${name}`)), `animations.${name}`),
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(ADDITIONAL_ANIMATIONS).map(([name, animation]) => [
      name,
      validateAnimation(normalizeMovePresentation(validateAnimation(animation, `animations.${name}`)), `animations.${name}`),
    ]),
  ),
};

/** Distance-derived locomotion phases keep planted feet attached through chill effects. */
export const TEST_FIGHTER_PLAYBACK = {
  walk_forward: { phaseMode: "distance", strideDistance: 48 },
  walk_backward: { phaseMode: "distance", strideDistance: 36 },
} as const;
