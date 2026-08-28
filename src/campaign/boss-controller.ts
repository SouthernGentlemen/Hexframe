import type { InputFrame, SimState } from "../combat/types";
import { StateId, actionBit } from "../combat/types";

/** Deterministic four-move phase sequencer for the Bell Warden. */
export class BellWardenController {
  constructor(private readonly fighterIndex = 1) {}

  reset(): void {}

  inputFor(state: SimState): InputFrame {
    if (state.stage.bossActive === 0 || state.roundOver === 1) return 0;
    const boss = state.fighters[this.fighterIndex];
    if (!boss) return 0;
    const actionable = boss.state === StateId.Idle || boss.state === StateId.WalkForward || boss.state === StateId.WalkBackward || boss.state === StateId.Crouch;
    if (!actionable) return 0;

    const phaseTwo = boss.health * 100 <= 58 * 1800;
    const openingDelay = phaseTwo ? 12 : 50;
    if (state.frame - state.stage.bossActivatedFrame < openingDelay) return 0;
    if (boss.stateFrame < (phaseTwo ? 12 : 34)) return 0;

    const phaseOneOrder = [0, 1, 3, 2] as const;
    const phaseTwoOrder = [3, 0, 1, 2, 0, 3] as const;
    const order = phaseTwo ? phaseTwoOrder : phaseOneOrder;
    const elapsed = state.frame - state.stage.bossActivatedFrame;
    const slot = order[Math.trunc(elapsed / (phaseTwo ? 79 : 113)) % order.length];
    return actionBit(slot);
  }
}
