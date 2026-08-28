import type { RawAnimation, RawBonePose } from "./raw-types";

type Pose = Record<string, RawBonePose>;

interface AuthoredAttack {
  duration: number;
  contact: number;
  activeEnd: number;
  anticipation: Pose;
  strike: Pose;
  followThrough: Pose;
  start?: Pose;
  end?: Pose;
}

const READY: Pose = {
  torso: { rotation: 0 }, head: { rotation: 0 }, pelvis: { x: 0, y: 0, rotation: 0 },
  arm_upper_l: { rotation: -14 }, arm_lower_l: { rotation: -34 }, hand_l: { rotation: 0 },
  arm_upper_r: { rotation: -20 }, arm_lower_r: { rotation: -46 }, hand_r: { rotation: 0 },
  leg_upper_l: { rotation: 6 }, leg_lower_l: { rotation: -8 }, foot_l: { rotation: 0 },
  leg_upper_r: { rotation: -8 }, leg_lower_r: { rotation: 6 }, foot_r: { rotation: 0 },
};

const CROUCH_READY: Pose = {
  pelvis: { x: 0, y: -20, rotation: 0 }, torso: { rotation: 12 }, head: { rotation: -8 },
  leg_upper_l: { rotation: 62 }, leg_lower_l: { rotation: -78 }, foot_l: { rotation: 14 },
  leg_upper_r: { rotation: -54 }, leg_lower_r: { rotation: 70 }, foot_r: { rotation: -12 },
  arm_upper_l: { rotation: -30 }, arm_lower_l: { rotation: -50 },
  arm_upper_r: { rotation: -34 }, arm_lower_r: { rotation: -60 },
};

const AIR_READY: Pose = {
  pelvis: { x: 0, y: 0, rotation: 0 }, torso: { rotation: 7 }, head: { rotation: -4 },
  leg_upper_l: { rotation: 48 }, leg_lower_l: { rotation: -62 }, foot_l: { rotation: 12 },
  leg_upper_r: { rotation: 38 }, leg_lower_r: { rotation: -56 }, foot_r: { rotation: 10 },
  arm_upper_l: { rotation: -42 }, arm_lower_l: { rotation: -58 },
  arm_upper_r: { rotation: -48 }, arm_lower_r: { rotation: -62 },
};

/**
 * Every technique owns its anticipation, contact and follow-through silhouettes. This is
 * intentionally verbose authoring data: move names no longer collapse onto a handful of
 * modulo-selected pose templates, and presentation can evolve without touching MoveDef.
 */
const AUTHORED_ATTACKS: Record<string, AuthoredAttack> = {
  ember_palm: {
    duration: 22, contact: 6, activeEnd: 8,
    anticipation: { pelvis: { x: -3 }, torso: { rotation: -13 }, head: { rotation: 6 }, arm_upper_r: { rotation: -48 }, arm_lower_r: { rotation: -78 }, hand_r: { rotation: -22 }, arm_upper_l: { rotation: -22 }, arm_lower_l: { rotation: -62 } },
    strike: { pelvis: { x: 7 }, torso: { rotation: 16 }, head: { rotation: -7 }, arm_upper_r: { rotation: 84 }, arm_lower_r: { rotation: -1 }, hand_r: { rotation: 28 }, arm_upper_l: { rotation: -46 }, arm_lower_l: { rotation: -56 }, leg_upper_r: { rotation: -18 }, foot_r: { rotation: 0 } },
    followThrough: { pelvis: { x: 5 }, torso: { rotation: 21 }, arm_upper_r: { rotation: 102 }, arm_lower_r: { rotation: 10 }, hand_r: { rotation: 34 }, arm_upper_l: { rotation: -34 } },
  },
  venom_fang: {
    duration: 19, contact: 5, activeEnd: 8,
    anticipation: { pelvis: { y: -10, x: -4 }, torso: { rotation: 24 }, head: { rotation: -15 }, arm_upper_r: { rotation: -68 }, arm_lower_r: { rotation: -20 }, hand_r: { rotation: 22 }, arm_upper_l: { rotation: -8 }, leg_upper_r: { rotation: 28 }, leg_lower_r: { rotation: -42 } },
    strike: { pelvis: { y: -12, x: 8 }, torso: { rotation: 29 }, head: { rotation: -18 }, arm_upper_r: { rotation: 96 }, arm_lower_r: { rotation: 2 }, hand_r: { rotation: -26 }, arm_upper_l: { rotation: -58 }, arm_lower_l: { rotation: -70 }, leg_upper_l: { rotation: 34 }, leg_lower_l: { rotation: -48 } },
    followThrough: { pelvis: { y: -8, x: 5 }, torso: { rotation: 18 }, arm_upper_r: { rotation: 112 }, arm_lower_r: { rotation: 14 }, hand_r: { rotation: -18 }, leg_upper_l: { rotation: 18 } },
  },
  frost_heel: {
    duration: 28, contact: 9, activeEnd: 11,
    anticipation: { pelvis: { y: -8, x: -4 }, torso: { rotation: 18 }, head: { rotation: -10 }, leg_upper_r: { rotation: 34 }, leg_lower_r: { rotation: -76 }, foot_r: { rotation: 22 }, leg_upper_l: { rotation: -18 }, arm_upper_l: { rotation: -54 }, arm_upper_r: { rotation: -62 } },
    strike: { pelvis: { y: 6, x: 4 }, torso: { rotation: -26 }, head: { rotation: 15 }, leg_upper_r: { rotation: 102 }, leg_lower_r: { rotation: -4 }, foot_r: { rotation: 12 }, leg_upper_l: { rotation: -32 }, leg_lower_l: { rotation: 22 }, foot_l: { rotation: -8 }, arm_upper_l: { rotation: -116 }, arm_lower_l: { rotation: -12 }, arm_upper_r: { rotation: -78 }, arm_lower_r: { rotation: -24 } },
    followThrough: { pelvis: { y: 1, x: 3 }, torso: { rotation: -12 }, leg_upper_r: { rotation: 78 }, leg_lower_r: { rotation: -24 }, foot_r: { rotation: 18 }, arm_upper_l: { rotation: -92 } },
  },
  storm_knuckle: {
    duration: 22, contact: 7, activeEnd: 9,
    anticipation: { pelvis: { x: -5, y: -3 }, torso: { rotation: -18 }, head: { rotation: 10 }, arm_upper_r: { rotation: -52 }, arm_lower_r: { rotation: -64 }, arm_upper_l: { rotation: 14 }, arm_lower_l: { rotation: -86 }, leg_upper_r: { rotation: 18 }, leg_upper_l: { rotation: -20 } },
    strike: { pelvis: { x: 10, y: -4 }, torso: { rotation: 31 }, head: { rotation: -21 }, arm_upper_r: { rotation: 76 }, arm_lower_r: { rotation: 1 }, hand_r: { rotation: -8 }, arm_upper_l: { rotation: -78 }, arm_lower_l: { rotation: -26 }, leg_upper_r: { rotation: -30 }, leg_lower_r: { rotation: 18 }, leg_upper_l: { rotation: 38 }, leg_lower_l: { rotation: -48 } },
    followThrough: { pelvis: { x: 8, y: -5 }, torso: { rotation: 36 }, head: { rotation: -24 }, arm_upper_r: { rotation: 96 }, arm_lower_r: { rotation: 12 }, arm_upper_l: { rotation: -64 } },
  },
  crimson_arc: {
    duration: 27, contact: 8, activeEnd: 11,
    anticipation: { pelvis: { x: -4, rotation: -8 }, torso: { rotation: -34 }, head: { rotation: 22 }, arm_upper_r: { rotation: -138 }, arm_lower_r: { rotation: -24 }, hand_r: { rotation: -18 }, arm_upper_l: { rotation: -80 }, leg_upper_l: { rotation: -24 }, leg_upper_r: { rotation: 26 } },
    strike: { pelvis: { x: 7, rotation: 14 }, torso: { rotation: 38 }, head: { rotation: -26 }, arm_upper_r: { rotation: 142 }, arm_lower_r: { rotation: 4 }, hand_r: { rotation: 24 }, arm_upper_l: { rotation: 74 }, arm_lower_l: { rotation: -8 }, leg_upper_l: { rotation: 35 }, leg_lower_l: { rotation: -44 }, leg_upper_r: { rotation: -32 }, leg_lower_r: { rotation: 20 } },
    followThrough: { pelvis: { x: 5, rotation: 18 }, torso: { rotation: 51 }, head: { rotation: -31 }, arm_upper_r: { rotation: 176 }, arm_lower_r: { rotation: 18 }, arm_upper_l: { rotation: 98 } },
  },
  rift_uppercut: {
    duration: 33, contact: 8, activeEnd: 12,
    anticipation: { pelvis: { y: -21, x: -3 }, torso: { rotation: 24 }, head: { rotation: -15 }, leg_upper_l: { rotation: 64 }, leg_lower_l: { rotation: -82 }, leg_upper_r: { rotation: -58 }, leg_lower_r: { rotation: 76 }, arm_upper_r: { rotation: -72 }, arm_lower_r: { rotation: -28 }, arm_upper_l: { rotation: -36 } },
    strike: { pelvis: { y: 8, x: 5 }, torso: { rotation: -8 }, head: { rotation: 5 }, arm_upper_r: { rotation: -164 }, arm_lower_r: { rotation: -2 }, hand_r: { rotation: 8 }, arm_upper_l: { rotation: -112 }, arm_lower_l: { rotation: -18 }, leg_upper_r: { rotation: -38 }, leg_lower_r: { rotation: 12 }, leg_upper_l: { rotation: 32 }, leg_lower_l: { rotation: -40 } },
    followThrough: { pelvis: { y: 12, x: 7 }, torso: { rotation: -15 }, arm_upper_r: { rotation: -184 }, arm_lower_r: { rotation: 8 }, leg_upper_l: { rotation: 48 }, leg_lower_l: { rotation: -62 } },
  },
  bastion_break: {
    duration: 40, contact: 14, activeEnd: 17,
    anticipation: { pelvis: { y: -8, x: -5 }, torso: { rotation: -20 }, head: { rotation: 12 }, arm_upper_l: { rotation: -154 }, arm_lower_l: { rotation: -18 }, hand_l: { rotation: -12 }, arm_upper_r: { rotation: -160 }, arm_lower_r: { rotation: -14 }, hand_r: { rotation: 12 }, leg_upper_l: { rotation: 34 }, leg_lower_l: { rotation: -42 }, foot_l: { rotation: 0 }, leg_upper_r: { rotation: -30 }, leg_lower_r: { rotation: 36 }, foot_r: { rotation: 0 } },
    strike: { pelvis: { y: -12, x: 5 }, torso: { rotation: 30 }, head: { rotation: -19 }, arm_upper_l: { rotation: 64 }, arm_lower_l: { rotation: -8 }, arm_upper_r: { rotation: 71 }, arm_lower_r: { rotation: -4 }, leg_upper_l: { rotation: 42 }, leg_lower_l: { rotation: -52 }, leg_upper_r: { rotation: -38 }, leg_lower_r: { rotation: 46 }, foot_l: { rotation: 0 }, foot_r: { rotation: 0 } },
    followThrough: { pelvis: { y: -18, x: 7 }, torso: { rotation: 42 }, head: { rotation: -28 }, arm_upper_l: { rotation: 92 }, arm_lower_l: { rotation: 12 }, arm_upper_r: { rotation: 98 }, arm_lower_r: { rotation: 16 } },
  },
  shadow_step: {
    duration: 20, contact: 6, activeEnd: 7,
    anticipation: { pelvis: { y: -8, x: -6, rotation: -6 }, torso: { rotation: 28 }, head: { rotation: -18 }, arm_upper_l: { rotation: -70 }, arm_upper_r: { rotation: -78 }, leg_upper_l: { rotation: 42 }, leg_lower_l: { rotation: -60 }, leg_upper_r: { rotation: -38 }, leg_lower_r: { rotation: 34 } },
    strike: { pelvis: { y: 1, x: 13, rotation: 25 }, torso: { rotation: 46 }, head: { rotation: -33 }, arm_upper_l: { rotation: -118 }, arm_lower_l: { rotation: -8 }, arm_upper_r: { rotation: 86 }, arm_lower_r: { rotation: -2 }, leg_upper_l: { rotation: -38 }, leg_lower_l: { rotation: 12 }, leg_upper_r: { rotation: -58 }, leg_lower_r: { rotation: 8 } },
    followThrough: { pelvis: { y: -3, x: 11, rotation: 18 }, torso: { rotation: 38 }, arm_upper_r: { rotation: 112 }, arm_upper_l: { rotation: -96 }, leg_upper_r: { rotation: -28 } },
  },
  ashen_sweep: {
    duration: 26, contact: 8, activeEnd: 11, start: CROUCH_READY, end: CROUCH_READY,
    anticipation: { pelvis: { y: -27, x: -4, rotation: -8 }, torso: { rotation: -17 }, head: { rotation: 12 }, leg_upper_r: { rotation: 68 }, leg_lower_r: { rotation: -88 }, leg_upper_l: { rotation: -12 }, leg_lower_l: { rotation: 18 }, arm_upper_l: { rotation: 32 }, arm_upper_r: { rotation: -74 } },
    strike: { pelvis: { y: -29, x: 4, rotation: 20 }, torso: { rotation: 34 }, head: { rotation: -23 }, leg_upper_r: { rotation: 112 }, leg_lower_r: { rotation: -4 }, foot_r: { rotation: 18 }, leg_upper_l: { rotation: 46 }, leg_lower_l: { rotation: -60 }, foot_l: { rotation: 0 }, arm_upper_l: { rotation: -92 }, arm_upper_r: { rotation: 56 } },
    followThrough: { pelvis: { y: -25, x: 5, rotation: 16 }, torso: { rotation: 28 }, leg_upper_r: { rotation: 136 }, leg_lower_r: { rotation: 12 }, arm_upper_l: { rotation: -74 } },
  },
  glacier_spike: {
    duration: 31, contact: 11, activeEnd: 13,
    anticipation: { pelvis: { y: -9 }, torso: { rotation: 18 }, head: { rotation: -12 }, arm_upper_l: { rotation: 48 }, arm_lower_l: { rotation: -108 }, arm_upper_r: { rotation: 54 }, arm_lower_r: { rotation: -114 }, leg_upper_l: { rotation: 40 }, leg_lower_l: { rotation: -50 }, leg_upper_r: { rotation: -34 }, leg_lower_r: { rotation: 42 } },
    strike: { pelvis: { y: 6, x: 3 }, torso: { rotation: -15 }, head: { rotation: 10 }, arm_upper_l: { rotation: -142 }, arm_lower_l: { rotation: -4 }, hand_l: { rotation: -12 }, arm_upper_r: { rotation: -150 }, arm_lower_r: { rotation: 0 }, hand_r: { rotation: 12 }, leg_upper_l: { rotation: -14 }, leg_upper_r: { rotation: 18 } },
    followThrough: { pelvis: { y: 2, x: 5 }, torso: { rotation: -5 }, arm_upper_l: { rotation: -172 }, arm_upper_r: { rotation: -178 }, leg_upper_l: { rotation: 10 } },
  },
  static_rush: {
    duration: 23, contact: 5, activeEnd: 9,
    anticipation: { pelvis: { y: -10, x: -6 }, torso: { rotation: 32 }, head: { rotation: -24 }, arm_upper_l: { rotation: -88 }, arm_lower_l: { rotation: -18 }, arm_upper_r: { rotation: 16 }, arm_lower_r: { rotation: -86 }, leg_upper_l: { rotation: 48 }, leg_lower_l: { rotation: -62 }, leg_upper_r: { rotation: -44 }, leg_lower_r: { rotation: 28 } },
    strike: { pelvis: { y: -12, x: 14 }, torso: { rotation: 48 }, head: { rotation: -37 }, arm_upper_l: { rotation: -112 }, arm_lower_l: { rotation: -6 }, arm_upper_r: { rotation: 28 }, arm_lower_r: { rotation: -96 }, leg_upper_l: { rotation: -30 }, leg_lower_l: { rotation: 14 }, leg_upper_r: { rotation: -38 }, leg_lower_r: { rotation: 8 } },
    followThrough: { pelvis: { y: -8, x: 12 }, torso: { rotation: 41 }, head: { rotation: -30 }, arm_upper_l: { rotation: -96 }, arm_upper_r: { rotation: 42 }, leg_upper_l: { rotation: -18 } },
  },
  toxic_bloom: {
    duration: 34, contact: 10, activeEnd: 15,
    anticipation: { pelvis: { y: -14 }, torso: { rotation: 3 }, head: { rotation: -3 }, arm_upper_l: { rotation: -12 }, arm_lower_l: { rotation: -116 }, hand_l: { rotation: 24 }, arm_upper_r: { rotation: -18 }, arm_lower_r: { rotation: -122 }, hand_r: { rotation: -24 }, leg_upper_l: { rotation: 42 }, leg_lower_l: { rotation: -54 }, leg_upper_r: { rotation: -38 }, leg_lower_r: { rotation: 48 } },
    strike: { pelvis: { y: -4 }, torso: { rotation: 0 }, head: { rotation: 0 }, arm_upper_l: { rotation: -96 }, arm_lower_l: { rotation: 1 }, hand_l: { rotation: -28 }, arm_upper_r: { rotation: 96 }, arm_lower_r: { rotation: -1 }, hand_r: { rotation: 28 }, leg_upper_l: { rotation: -42 }, leg_lower_l: { rotation: 22 }, leg_upper_r: { rotation: 42 }, leg_lower_r: { rotation: -48 } },
    followThrough: { pelvis: { y: 1 }, torso: { rotation: -4 }, arm_upper_l: { rotation: -124 }, arm_lower_l: { rotation: 12 }, arm_upper_r: { rotation: 124 }, arm_lower_r: { rotation: -12 }, leg_upper_l: { rotation: -24 }, leg_upper_r: { rotation: 24 } },
  },
  blood_moon: {
    duration: 36, contact: 12, activeEnd: 15,
    anticipation: { pelvis: { x: -5, rotation: -14 }, torso: { rotation: -42 }, head: { rotation: 28 }, arm_upper_l: { rotation: -146 }, arm_lower_l: { rotation: -16 }, arm_upper_r: { rotation: -128 }, arm_lower_r: { rotation: -24 }, leg_upper_l: { rotation: -30 }, leg_upper_r: { rotation: 32 } },
    strike: { pelvis: { x: 8, rotation: 22 }, torso: { rotation: 52 }, head: { rotation: -36 }, arm_upper_l: { rotation: 132 }, arm_lower_l: { rotation: 8 }, arm_upper_r: { rotation: 158 }, arm_lower_r: { rotation: 14 }, leg_upper_l: { rotation: 42 }, leg_lower_l: { rotation: -52 }, leg_upper_r: { rotation: -38 }, leg_lower_r: { rotation: 24 } },
    followThrough: { pelvis: { x: 6, rotation: 28 }, torso: { rotation: 63 }, head: { rotation: -42 }, arm_upper_l: { rotation: 174 }, arm_upper_r: { rotation: 192 }, leg_upper_l: { rotation: 28 } },
  },
  void_hook: {
    duration: 28, contact: 9, activeEnd: 12,
    anticipation: { pelvis: { x: -4 }, torso: { rotation: -24 }, head: { rotation: 15 }, arm_upper_r: { rotation: -102 }, arm_lower_r: { rotation: -88 }, hand_r: { rotation: 20 }, arm_upper_l: { rotation: 24 }, arm_lower_l: { rotation: -84 }, leg_upper_l: { rotation: -18 }, leg_upper_r: { rotation: 22 } },
    strike: { pelvis: { x: 8 }, torso: { rotation: 24 }, head: { rotation: -16 }, arm_upper_r: { rotation: 108 }, arm_lower_r: { rotation: -68 }, hand_r: { rotation: -34 }, arm_upper_l: { rotation: -62 }, arm_lower_l: { rotation: -44 }, leg_upper_l: { rotation: 28 }, leg_upper_r: { rotation: -26 } },
    followThrough: { pelvis: { x: 4 }, torso: { rotation: -8 }, arm_upper_r: { rotation: 34 }, arm_lower_r: { rotation: -118 }, hand_r: { rotation: -42 }, arm_upper_l: { rotation: -22 } },
  },
  iron_reversal: {
    duration: 36, contact: 6, activeEnd: 9,
    anticipation: { pelvis: { y: -18 }, torso: { rotation: 9 }, head: { rotation: -6 }, arm_upper_l: { rotation: 44 }, arm_lower_l: { rotation: -116 }, arm_upper_r: { rotation: 50 }, arm_lower_r: { rotation: -122 }, leg_upper_l: { rotation: 58 }, leg_lower_l: { rotation: -72 }, leg_upper_r: { rotation: -52 }, leg_lower_r: { rotation: 68 } },
    strike: { pelvis: { y: 6, x: 4 }, torso: { rotation: -12 }, head: { rotation: 8 }, arm_upper_l: { rotation: -126 }, arm_lower_l: { rotation: -4 }, arm_upper_r: { rotation: -136 }, arm_lower_r: { rotation: 2 }, leg_upper_l: { rotation: -22 }, leg_upper_r: { rotation: 24 } },
    followThrough: { pelvis: { y: 2, x: 5 }, torso: { rotation: -20 }, arm_upper_l: { rotation: -158 }, arm_upper_r: { rotation: -168 }, leg_upper_l: { rotation: 12 } },
  },
  phoenix_drive: {
    duration: 36, contact: 9, activeEnd: 13,
    anticipation: { pelvis: { y: -24, x: -4 }, torso: { rotation: 22 }, head: { rotation: -14 }, leg_upper_l: { rotation: 68 }, leg_lower_l: { rotation: -84 }, leg_upper_r: { rotation: -62 }, leg_lower_r: { rotation: 78 }, arm_upper_r: { rotation: -74 }, arm_lower_r: { rotation: -24 }, arm_upper_l: { rotation: -48 } },
    strike: { pelvis: { y: 12, x: 7 }, torso: { rotation: -10 }, head: { rotation: 7 }, arm_upper_r: { rotation: -174 }, arm_lower_r: { rotation: -2 }, arm_upper_l: { rotation: -118 }, arm_lower_l: { rotation: -18 }, leg_upper_r: { rotation: 72 }, leg_lower_r: { rotation: -88 }, foot_r: { rotation: 18 }, leg_upper_l: { rotation: -34 }, leg_lower_l: { rotation: 10 } },
    followThrough: { pelvis: { y: 16, x: 9 }, torso: { rotation: -18 }, arm_upper_r: { rotation: -196 }, leg_upper_r: { rotation: 88 }, leg_lower_r: { rotation: -102 }, arm_upper_l: { rotation: -140 } },
  },
  permafrost: {
    duration: 36, contact: 12, activeEnd: 18, start: CROUCH_READY, end: CROUCH_READY,
    anticipation: { pelvis: { y: -29, x: -4 }, torso: { rotation: 28 }, head: { rotation: -18 }, arm_upper_l: { rotation: -64 }, arm_lower_l: { rotation: -74 }, arm_upper_r: { rotation: -70 }, arm_lower_r: { rotation: -80 }, leg_upper_l: { rotation: 76 }, leg_lower_l: { rotation: -92 }, leg_upper_r: { rotation: -66 }, leg_lower_r: { rotation: 84 } },
    strike: { pelvis: { y: -25, x: 5 }, torso: { rotation: 38 }, head: { rotation: -25 }, arm_upper_l: { rotation: 82 }, arm_lower_l: { rotation: -2 }, hand_l: { rotation: -16 }, arm_upper_r: { rotation: 92 }, arm_lower_r: { rotation: 2 }, hand_r: { rotation: 16 }, leg_upper_l: { rotation: 58 }, leg_lower_l: { rotation: -76 }, leg_upper_r: { rotation: -54 }, leg_lower_r: { rotation: 70 } },
    followThrough: { pelvis: { y: -27, x: 7 }, torso: { rotation: 46 }, arm_upper_l: { rotation: 112 }, arm_upper_r: { rotation: 122 }, head: { rotation: -31 } },
  },
  plague_touch: {
    duration: 26, contact: 7, activeEnd: 11,
    anticipation: { pelvis: { x: -3 }, torso: { rotation: -10 }, head: { rotation: 6 }, arm_upper_r: { rotation: 18 }, arm_lower_r: { rotation: -112 }, hand_r: { rotation: 36 }, arm_upper_l: { rotation: -34 }, arm_lower_l: { rotation: -62 }, leg_upper_l: { rotation: -14 }, leg_upper_r: { rotation: 18 } },
    strike: { pelvis: { x: 5 }, torso: { rotation: 11 }, head: { rotation: -5 }, arm_upper_r: { rotation: 72 }, arm_lower_r: { rotation: -8 }, hand_r: { rotation: 48 }, arm_upper_l: { rotation: -44 }, arm_lower_l: { rotation: -72 }, leg_upper_l: { rotation: 24 }, leg_upper_r: { rotation: -20 } },
    followThrough: { pelvis: { x: 4 }, torso: { rotation: 15 }, arm_upper_r: { rotation: 82 }, arm_lower_r: { rotation: -4 }, hand_r: { rotation: 58 }, arm_upper_l: { rotation: -40 } },
  },
  thunder_clap: {
    duration: 32, contact: 10, activeEnd: 12,
    anticipation: { pelvis: { y: -10 }, torso: { rotation: -4 }, head: { rotation: 3 }, arm_upper_l: { rotation: -84 }, arm_lower_l: { rotation: -96 }, hand_l: { rotation: -24 }, arm_upper_r: { rotation: 84 }, arm_lower_r: { rotation: -96 }, hand_r: { rotation: 24 }, leg_upper_l: { rotation: 42 }, leg_lower_l: { rotation: -54 }, leg_upper_r: { rotation: -38 }, leg_lower_r: { rotation: 48 } },
    strike: { pelvis: { y: -3, x: 3 }, torso: { rotation: 8 }, head: { rotation: -5 }, arm_upper_l: { rotation: 68 }, arm_lower_l: { rotation: -10 }, hand_l: { rotation: 18 }, arm_upper_r: { rotation: 76 }, arm_lower_r: { rotation: 8 }, hand_r: { rotation: -18 }, leg_upper_l: { rotation: 24 }, leg_upper_r: { rotation: -22 } },
    followThrough: { pelvis: { y: 1, x: 4 }, torso: { rotation: 13 }, arm_upper_l: { rotation: 82 }, arm_lower_l: { rotation: 0 }, arm_upper_r: { rotation: 90 }, arm_lower_r: { rotation: 18 } },
  },
  reaper_kick: {
    duration: 43, contact: 15, activeEnd: 18,
    anticipation: { pelvis: { y: -9, x: -4, rotation: -14 }, torso: { rotation: -34 }, head: { rotation: 23 }, leg_upper_r: { rotation: -58 }, leg_lower_r: { rotation: 70 }, foot_r: { rotation: -12 }, leg_upper_l: { rotation: 42 }, leg_lower_l: { rotation: -56 }, arm_upper_l: { rotation: -138 }, arm_upper_r: { rotation: -104 } },
    strike: { pelvis: { y: 8, x: 5, rotation: 30 }, torso: { rotation: -36 }, head: { rotation: 24 }, leg_upper_r: { rotation: 138 }, leg_lower_r: { rotation: -2 }, foot_r: { rotation: 26 }, leg_upper_l: { rotation: -48 }, leg_lower_l: { rotation: 22 }, foot_l: { rotation: -10 }, arm_upper_l: { rotation: 72 }, arm_lower_l: { rotation: -12 }, arm_upper_r: { rotation: 102 }, arm_lower_r: { rotation: 8 } },
    followThrough: { pelvis: { y: 3, x: 7, rotation: 38 }, torso: { rotation: -44 }, leg_upper_r: { rotation: 182 }, leg_lower_r: { rotation: 18 }, foot_r: { rotation: 32 }, arm_upper_l: { rotation: 94 }, arm_upper_r: { rotation: 126 } },
  },
  eclipse_breaker: {
    duration: 41, contact: 13, activeEnd: 17,
    anticipation: { pelvis: { y: -10, x: -6 }, torso: { rotation: -26 }, head: { rotation: 17 }, arm_upper_l: { rotation: -168 }, arm_lower_l: { rotation: -10 }, hand_l: { rotation: -14 }, arm_upper_r: { rotation: -174 }, arm_lower_r: { rotation: -6 }, hand_r: { rotation: 14 }, leg_upper_l: { rotation: 38 }, leg_lower_l: { rotation: -48 }, leg_upper_r: { rotation: -34 }, leg_lower_r: { rotation: 42 } },
    strike: { pelvis: { y: -14, x: 9 }, torso: { rotation: 42 }, head: { rotation: -28 }, arm_upper_l: { rotation: 76 }, arm_lower_l: { rotation: -2 }, hand_l: { rotation: 18 }, arm_upper_r: { rotation: 84 }, arm_lower_r: { rotation: 2 }, hand_r: { rotation: -18 }, leg_upper_l: { rotation: 46 }, leg_lower_l: { rotation: -56 }, foot_l: { rotation: 0 }, leg_upper_r: { rotation: -42 }, leg_lower_r: { rotation: 52 }, foot_r: { rotation: 0 } },
    followThrough: { pelvis: { y: -20, x: 11 }, torso: { rotation: 56 }, head: { rotation: -38 }, arm_upper_l: { rotation: 112 }, arm_lower_l: { rotation: 14 }, arm_upper_r: { rotation: 120 }, arm_lower_r: { rotation: 18 } },
  },
  prism_burst: {
    duration: 44, contact: 12, activeEnd: 19,
    anticipation: { pelvis: { y: -22 }, torso: { rotation: 0 }, head: { rotation: 0 }, arm_upper_l: { rotation: -8 }, arm_lower_l: { rotation: -126 }, hand_l: { rotation: 30 }, arm_upper_r: { rotation: -12 }, arm_lower_r: { rotation: -132 }, hand_r: { rotation: -30 }, leg_upper_l: { rotation: 66 }, leg_lower_l: { rotation: -82 }, leg_upper_r: { rotation: -60 }, leg_lower_r: { rotation: 76 } },
    strike: { pelvis: { y: 8 }, torso: { rotation: 0 }, head: { rotation: 0 }, arm_upper_l: { rotation: -112 }, arm_lower_l: { rotation: 0 }, hand_l: { rotation: -22 }, arm_upper_r: { rotation: 112 }, arm_lower_r: { rotation: 0 }, hand_r: { rotation: 22 }, leg_upper_l: { rotation: -58 }, leg_lower_l: { rotation: 12 }, foot_l: { rotation: -14 }, leg_upper_r: { rotation: 58 }, leg_lower_r: { rotation: -12 }, foot_r: { rotation: 14 } },
    followThrough: { pelvis: { y: 12 }, torso: { rotation: 4 }, arm_upper_l: { rotation: -142 }, arm_lower_l: { rotation: 12 }, arm_upper_r: { rotation: 142 }, arm_lower_r: { rotation: -12 }, leg_upper_l: { rotation: -72 }, leg_upper_r: { rotation: 72 } },
  },
  astral_jab: {
    duration: 15, contact: 4, activeEnd: 6, start: AIR_READY, end: AIR_READY,
    anticipation: { pelvis: { rotation: -8 }, torso: { rotation: -14 }, head: { rotation: 8 }, arm_upper_r: { rotation: -62 }, arm_lower_r: { rotation: -76 }, leg_upper_l: { rotation: 58 }, leg_lower_l: { rotation: -74 }, leg_upper_r: { rotation: 46 }, leg_lower_r: { rotation: -64 } },
    strike: { pelvis: { x: 4, rotation: 8 }, torso: { rotation: 24 }, head: { rotation: -15 }, arm_upper_r: { rotation: 94 }, arm_lower_r: { rotation: -1 }, hand_r: { rotation: -8 }, arm_upper_l: { rotation: -72 }, arm_lower_l: { rotation: -42 }, leg_upper_l: { rotation: 36 }, leg_lower_l: { rotation: -48 }, leg_upper_r: { rotation: 54 }, leg_lower_r: { rotation: -70 } },
    followThrough: { pelvis: { x: 3, rotation: 12 }, torso: { rotation: 29 }, arm_upper_r: { rotation: 112 }, arm_lower_r: { rotation: 8 }, leg_upper_l: { rotation: 30 } },
  },
  witch_knee: {
    duration: 21, contact: 6, activeEnd: 9, start: AIR_READY, end: AIR_READY,
    anticipation: { pelvis: { rotation: -18, x: -3 }, torso: { rotation: -24 }, head: { rotation: 16 }, leg_upper_r: { rotation: -38 }, leg_lower_r: { rotation: 16 }, leg_upper_l: { rotation: 34 }, leg_lower_l: { rotation: -48 }, arm_upper_l: { rotation: -92 }, arm_upper_r: { rotation: -22 } },
    strike: { pelvis: { rotation: 24, x: 5 }, torso: { rotation: 30 }, head: { rotation: -20 }, leg_upper_r: { rotation: 92 }, leg_lower_r: { rotation: -112 }, foot_r: { rotation: 24 }, leg_upper_l: { rotation: -44 }, leg_lower_l: { rotation: 18 }, arm_upper_l: { rotation: 64 }, arm_lower_l: { rotation: -20 }, arm_upper_r: { rotation: -94 }, arm_lower_r: { rotation: -12 } },
    followThrough: { pelvis: { rotation: 31, x: 6 }, torso: { rotation: 37 }, leg_upper_r: { rotation: 108 }, leg_lower_r: { rotation: -126 }, arm_upper_l: { rotation: 78 } },
  },
  meteor_heel: {
    duration: 30, contact: 9, activeEnd: 13, start: AIR_READY, end: AIR_READY,
    anticipation: { pelvis: { y: 4, rotation: -12 }, torso: { rotation: -22 }, head: { rotation: 14 }, leg_upper_r: { rotation: 72 }, leg_lower_r: { rotation: -96 }, foot_r: { rotation: 26 }, leg_upper_l: { rotation: 44 }, leg_lower_l: { rotation: -58 }, arm_upper_l: { rotation: -112 }, arm_upper_r: { rotation: -120 } },
    strike: { pelvis: { y: -4, x: 5, rotation: 18 }, torso: { rotation: 28 }, head: { rotation: -18 }, leg_upper_r: { rotation: -22 }, leg_lower_r: { rotation: 8 }, foot_r: { rotation: -28 }, leg_upper_l: { rotation: 62 }, leg_lower_l: { rotation: -78 }, foot_l: { rotation: 18 }, arm_upper_l: { rotation: 22 }, arm_lower_l: { rotation: -12 }, arm_upper_r: { rotation: 16 }, arm_lower_r: { rotation: -8 } },
    followThrough: { pelvis: { y: -8, x: 7, rotation: 24 }, torso: { rotation: 36 }, leg_upper_r: { rotation: -42 }, leg_lower_r: { rotation: 18 }, foot_r: { rotation: -34 }, arm_upper_l: { rotation: 38 }, arm_upper_r: { rotation: 32 } },
  },
  void_dive: {
    duration: 36, contact: 11, activeEnd: 16, start: AIR_READY, end: AIR_READY,
    anticipation: { pelvis: { y: 4, x: -4, rotation: -22 }, torso: { rotation: -32 }, head: { rotation: 22 }, leg_upper_l: { rotation: 68 }, leg_lower_l: { rotation: -86 }, leg_upper_r: { rotation: 58 }, leg_lower_r: { rotation: -78 }, arm_upper_l: { rotation: -132 }, arm_upper_r: { rotation: -140 } },
    strike: { pelvis: { y: -5, x: 11, rotation: 34 }, torso: { rotation: 52 }, head: { rotation: -38 }, leg_upper_l: { rotation: -48 }, leg_lower_l: { rotation: 14 }, foot_l: { rotation: -12 }, leg_upper_r: { rotation: -58 }, leg_lower_r: { rotation: 8 }, foot_r: { rotation: -16 }, arm_upper_l: { rotation: 88 }, arm_lower_l: { rotation: -4 }, arm_upper_r: { rotation: 104 }, arm_lower_r: { rotation: 4 } },
    followThrough: { pelvis: { y: -9, x: 13, rotation: 42 }, torso: { rotation: 61 }, head: { rotation: -44 }, leg_upper_l: { rotation: -62 }, leg_upper_r: { rotation: -72 }, arm_upper_l: { rotation: 112 }, arm_upper_r: { rotation: 128 } },
  },
};

function buildAnimation(name: string, spec: AuthoredAttack): RawAnimation {
  return {
    name,
    loop: false,
    duration: spec.duration,
    note: "Authored anticipation, contact and follow-through silhouettes; combat timing remains separate.",
    keyframes: [
      { frame: 0, bones: spec.start ?? READY },
      { frame: Math.max(1, spec.contact - 2), bones: spec.anticipation },
      { frame: spec.contact, bones: spec.strike },
      { frame: Math.min(spec.duration, spec.activeEnd + 3), bones: spec.followThrough },
      { frame: spec.duration, bones: spec.end ?? READY },
    ],
  };
}

export const ADDITIONAL_ANIMATIONS: Record<string, RawAnimation> = Object.fromEntries(
  Object.entries(AUTHORED_ATTACKS).map(([name, spec]) => [name, buildAnimation(name, spec)]),
);
