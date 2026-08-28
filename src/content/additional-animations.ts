import type { RawAnimation, RawBonePose } from "./raw-types";

const MOVE_NAMES = [
  "ember_palm", "venom_fang", "frost_heel", "storm_knuckle", "crimson_arc", "rift_uppercut",
  "bastion_break", "shadow_step", "ashen_sweep", "glacier_spike", "static_rush", "toxic_bloom",
  "blood_moon", "void_hook", "iron_reversal", "phoenix_drive", "permafrost", "plague_touch",
  "thunder_clap", "reaper_kick", "eclipse_breaker", "prism_burst",
] as const;

type Pose = Record<string, RawBonePose>;

function strikePose(style: number, amount: number): Pose {
  const lean = 5 + (amount % 9);
  switch (style) {
    case 0:
      return { torso: { rotation: lean }, arm_upper_r: { rotation: 72 + amount }, arm_lower_r: { rotation: -8 }, arm_upper_l: { rotation: -34 }, head: { rotation: -4 } };
    case 1:
      return { torso: { rotation: -lean }, arm_upper_l: { rotation: -82 }, arm_lower_l: { rotation: 18 + amount }, arm_upper_r: { rotation: 38 }, pelvis: { x: 4 } };
    case 2:
      return { torso: { rotation: lean }, leg_upper_r: { rotation: 88 + amount }, leg_lower_r: { rotation: -12 }, arm_upper_l: { rotation: -62 }, pelvis: { y: 5 } };
    case 3:
      return { pelvis: { y: -18 }, torso: { rotation: 16 }, leg_upper_r: { rotation: 70 }, leg_lower_r: { rotation: -76 }, arm_upper_r: { rotation: 54 + amount } };
    case 4:
      return { torso: { rotation: -8 }, arm_upper_r: { rotation: 150 - amount }, arm_lower_r: { rotation: -20 }, arm_upper_l: { rotation: -118 }, arm_lower_l: { rotation: -16 }, pelvis: { y: 3 } };
    default:
      return { torso: { rotation: lean }, arm_upper_r: { rotation: 104 }, arm_lower_r: { rotation: 20 }, leg_upper_l: { rotation: -30 - amount }, leg_upper_r: { rotation: 28 + amount } };
  }
}

function recoveryPose(style: number): Pose {
  return style === 3
    ? { pelvis: { y: -10 }, torso: { rotation: 7 }, leg_upper_r: { rotation: 28 }, leg_lower_r: { rotation: -34 } }
    : { torso: { rotation: 2 }, arm_upper_r: { rotation: -8 }, arm_lower_r: { rotation: -38 }, arm_upper_l: { rotation: -18 }, leg_upper_r: { rotation: -4 } };
}

function buildAnimation(name: string, index: number): RawAnimation {
  const style = index % 6;
  const duration = 20 + (index % 5) * 3;
  const impact = 5 + (index % 5);
  return {
    name,
    loop: false,
    duration,
    note: `Distinct generated presentation clip ${index + 3}; combat timing remains authored separately.`,
    keyframes: [
      { frame: 0, bones: recoveryPose(style) },
      { frame: Math.max(2, impact - 2), bones: { torso: { rotation: -6 - (index % 7) }, arm_upper_r: { rotation: -38 - index }, pelvis: { x: -2 } } },
      { frame: impact, bones: strikePose(style, index % 13) },
      { frame: Math.min(duration, impact + 4), bones: recoveryPose(style) },
      { frame: duration, bones: { torso: { rotation: 0 }, arm_upper_r: { rotation: -20 }, arm_lower_r: { rotation: -46 }, arm_upper_l: { rotation: -14 }, pelvis: { x: 0, y: 0 } } },
    ],
  };
}

export const ADDITIONAL_ANIMATIONS: Record<string, RawAnimation> = Object.fromEntries(
  MOVE_NAMES.map((name, index) => [name, buildAnimation(name, index)]),
);
