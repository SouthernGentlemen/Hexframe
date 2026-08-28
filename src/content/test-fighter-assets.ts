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
import crouchJson from "../../characters/test_fighter/animations/crouch.json";
import jumpJson from "../../characters/test_fighter/animations/jump.json";
import standingLightJson from "../../characters/test_fighter/animations/standing_light.json";
import crouchingLightJson from "../../characters/test_fighter/animations/crouching_light.json";

import type { RawAnimation, RawRig } from "./raw-types";
import { validateAnimation, validateRig } from "./validate";

export const TEST_FIGHTER_MODEL: string = modelSvg;

export const TEST_FIGHTER_RIG: RawRig = validateRig(rigJson);

/** Clips by name. `MoveDef.animation` and the state-to-clip mapping both index this. */
export const TEST_FIGHTER_ANIMATIONS: Record<string, RawAnimation> = {
  idle: validateAnimation(idleJson),
  walk_forward: validateAnimation(walkForwardJson),
  walk_backward: validateAnimation(walkBackwardJson),
  crouch: validateAnimation(crouchJson),
  jump: validateAnimation(jumpJson),
  standing_light: validateAnimation(standingLightJson),
  crouching_light: validateAnimation(crouchingLightJson),
};
