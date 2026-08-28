/**
 * The built Test Fighter, and the match it starts in.
 *
 * The JSON goes through the validator before the loader on the way in, every time. It
 * costs microseconds once at module load and it means a malformed character is a clear
 * error at a known place rather than an `undefined` that surfaces four frames into a
 * hitbox comparison.
 *
 * Deliberately free of any browser-only import: the whole test suite builds this fighter
 * under Node. The model SVG, the rig and the animations live in `test-fighter-assets.ts`
 * next door, so that importing a fighter never drags a `?raw` asset into a test run.
 */

import characterJson from "../../characters/test_fighter/character.json";
import standingLightJson from "../../characters/test_fighter/moves/standing_light.json";
import crouchingLightJson from "../../characters/test_fighter/moves/crouching_light.json";

import type { CharacterDef, SimConfig } from "../combat/types";
import { px } from "../combat/constants";
import { loadCharacter } from "./loader";
import { validateCharacter, validateMove } from "./validate";

export const TEST_FIGHTER: CharacterDef = loadCharacter(validateCharacter(characterJson), [
  validateMove(standingLightJson),
  validateMove(crouchingLightJson),
]);

/** Move ids by name, so callers never spell a bare number. */
export const MoveId = {
  StandingLight: 1,
  CrouchingLight: 2,
} as const;

/**
 * A match of Test Fighter against itself.
 *
 * 240 px apart: comfortably outside standing light's 88 px reach, so nothing can connect
 * until somebody walks in and the first frame of a test is never already a hit. Both
 * players share one `CharacterDef` object because character data is read-only — the
 * simulation writes only to `SimState`.
 */
export function testFighterSimConfig(seed = 0x5eed): SimConfig {
  return {
    characters: [TEST_FIGHTER, TEST_FIGHTER],
    startX: [px(-120), px(120)],
    seed,
  };
}
