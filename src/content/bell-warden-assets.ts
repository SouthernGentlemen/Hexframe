import type { RawAnimation, RawBonePose, RawRig } from "./raw-types";
import { validateAnimation, validateRig } from "./validate";

/** Presentation-only cathedral construct skin; combat geometry lives in `bell-warden.ts`. */
export const BELL_WARDEN_MODEL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-90 -210 180 225">
  <g id="leg_upper_l" fill="#30343d"><path d="M-15 0 10 2 7 34-12 38Z"/></g>
  <g id="leg_lower_l" fill="#242831"><path d="M-11 0 8 0 13 34-15 34Z"/></g>
  <g id="foot_l" fill="#171a20"><path d="M-12 0 28 0 36 10-17 11Z"/></g>
  <g id="arm_upper_l" fill="#3a3e48"><path d="M-13-3 13 0 11 35-10 39Z"/><path d="M-15 3-30 14-13 18Z" fill="#6a5d42"/></g>
  <g id="arm_lower_l" fill="#2b2f38"><path d="M-11 0 11 0 13 35-10 39Z"/><path d="M-14 16H18V22H-14Z" fill="#8b774c"/></g>
  <g id="hand_l" fill="#16191e"><path d="M-12-1 14 0 20 16-16 16Z"/></g>
  <g id="pelvis" fill="#3a3e46"><path d="M-28-13 28-13 35 5 21 18-22 18-35 4Z"/><circle cx="0" cy="3" r="12" fill="#7c6135"/></g>
  <g id="torso" fill="#474b54"><path d="M-42-62 42-62 58-31 36 5-36 5-58-31Z"/><path d="M-29-45H29L37-7H-37Z" fill="#292d35"/><path d="M0-52 15-28 0-5-15-28Z" fill="#a67a36"/><path d="M-50-43-78-61-56-20ZM50-43 78-61 56-20Z" fill="#5b5e65"/></g>
  <g id="head" fill="#32363e"><path d="M-27-16-17-42 0-51 20-41 30-14 18 9-17 9Z"/><path d="M-20-36-43-55-30-22ZM20-36 44-56 32-21Z" fill="#77726a"/><circle cx="-10" cy="-16" r="4" fill="#f0c65a"/><circle cx="12" cy="-16" r="4" fill="#f0c65a"/><path d="M-15-2Q0 13 17-2" fill="none" stroke="#111" stroke-width="5"/></g>
  <g id="leg_upper_r" fill="#444851"><path d="M-15 0 11 2 8 35-12 39Z"/></g>
  <g id="leg_lower_r" fill="#343842"><path d="M-11 0 9 0 14 34-15 34Z"/></g>
  <g id="foot_r" fill="#20232a"><path d="M-12 0 29 0 38 10-17 11Z"/></g>
  <g id="arm_upper_r" fill="#555962"><path d="M-14-3 14 0 12 36-11 40Z"/><path d="M-15 3-31 15-13 19Z" fill="#8b774c"/></g>
  <g id="arm_lower_r" fill="#3b3f48"><path d="M-12 0 12 0 14 36-11 40Z"/><path d="M-15 16H19V22H-15Z" fill="#a78b50"/></g>
  <g id="hand_r" fill="#22252b"><path d="M-13-1 15 0 22 17-17 17Z"/></g>
</svg>`;

/** A broad, upright skeleton authored for the Warden's proportions. */
export const BELL_WARDEN_RIG: RawRig = validateRig({
  root: "pelvis",
  parts: [
    { name: "pelvis", parent: null, pivot: { x: 0, y: 72 }, z: 20 },
    { name: "torso", parent: "pelvis", pivot: { x: 0, y: 4 }, z: 22 },
    { name: "head", parent: "torso", pivot: { x: 0, y: 61 }, z: 24 },
    { name: "arm_upper_l", parent: "torso", pivot: { x: -45, y: 50 }, z: 8 },
    { name: "arm_lower_l", parent: "arm_upper_l", pivot: { x: 0, y: -35 }, z: 9 },
    { name: "hand_l", parent: "arm_lower_l", pivot: { x: 0, y: -35 }, z: 10 },
    { name: "leg_upper_l", parent: "pelvis", pivot: { x: -18, y: 0 }, z: 14 },
    { name: "leg_lower_l", parent: "leg_upper_l", pivot: { x: 0, y: -35 }, z: 15 },
    { name: "foot_l", parent: "leg_lower_l", pivot: { x: 0, y: -34 }, z: 16 },
    { name: "leg_upper_r", parent: "pelvis", pivot: { x: 18, y: 0 }, z: 26 },
    { name: "leg_lower_r", parent: "leg_upper_r", pivot: { x: 0, y: -35 }, z: 27 },
    { name: "foot_r", parent: "leg_lower_r", pivot: { x: 0, y: -34 }, z: 28 },
    { name: "arm_upper_r", parent: "torso", pivot: { x: 45, y: 50 }, z: 30 },
    { name: "arm_lower_r", parent: "arm_upper_r", pivot: { x: 0, y: -36 }, z: 31 },
    { name: "hand_r", parent: "arm_lower_r", pivot: { x: 0, y: -36 }, z: 32 },
  ],
}, "bellWarden.rig");

const NEUTRAL: Record<string, RawBonePose> = {
  pelvis: { y: -2 }, torso: { rotation: 1 }, head: { rotation: -1 },
  arm_upper_l: { rotation: 8 }, arm_lower_l: { rotation: 5 },
  arm_upper_r: { rotation: 12 }, arm_lower_r: { rotation: 7 },
  leg_upper_l: { rotation: 5 }, leg_lower_l: { rotation: -7 },
  leg_upper_r: { rotation: -5 }, leg_lower_r: { rotation: 7 },
};

function clip(name: string, duration: number, loop: boolean, keyframes: RawAnimation["keyframes"]): RawAnimation {
  return validateAnimation({ name, duration, loop, keyframes }, `bellWarden.animations.${name}`);
}

function reaction(name: string, pose: Record<string, RawBonePose>): RawAnimation {
  return clip(name, 12, false, [{ frame: 0, bones: NEUTRAL }, { frame: 4, bones: pose }, { frame: 12, bones: NEUTRAL }]);
}

/** Dedicated Warden clips. None inherit the player's rig, poses, or playback. */
export const BELL_WARDEN_ANIMATIONS: Record<string, RawAnimation> = {
  idle: clip("idle", 72, true, [
    { frame: 0, bones: NEUTRAL },
    { frame: 36, bones: { pelvis: { y: -4 }, torso: { rotation: 0 }, head: { rotation: 1 }, arm_upper_l: { rotation: 6 }, arm_upper_r: { rotation: 10 } } },
    { frame: 72, bones: NEUTRAL },
  ]),
  walk_forward: clip("walk_forward", 32, true, [
    { frame: 0, bones: { ...NEUTRAL, torso: { rotation: 5 }, leg_upper_l: { rotation: 19 }, leg_lower_l: { rotation: -16 }, leg_upper_r: { rotation: -18 }, leg_lower_r: { rotation: 10 } } },
    { frame: 16, bones: { ...NEUTRAL, torso: { rotation: 5 }, leg_upper_l: { rotation: -18 }, leg_lower_l: { rotation: 10 }, leg_upper_r: { rotation: 19 }, leg_lower_r: { rotation: -16 } } },
    { frame: 32, bones: { ...NEUTRAL, torso: { rotation: 5 }, leg_upper_l: { rotation: 19 }, leg_lower_l: { rotation: -16 }, leg_upper_r: { rotation: -18 }, leg_lower_r: { rotation: 10 } } },
  ]),
  walk_backward: clip("walk_backward", 36, true, [
    { frame: 0, bones: { ...NEUTRAL, torso: { rotation: -4 }, leg_upper_l: { rotation: -13 }, leg_upper_r: { rotation: 14 } } },
    { frame: 18, bones: { ...NEUTRAL, torso: { rotation: -4 }, leg_upper_l: { rotation: 14 }, leg_upper_r: { rotation: -13 } } },
    { frame: 36, bones: { ...NEUTRAL, torso: { rotation: -4 }, leg_upper_l: { rotation: -13 }, leg_upper_r: { rotation: 14 } } },
  ]),
  dash_forward: reaction("dash_forward", { pelvis: { x: 10, y: -8 }, torso: { rotation: 16 }, head: { rotation: -10 }, arm_upper_l: { rotation: -18 }, arm_upper_r: { rotation: -22 } }),
  dash_backward: reaction("dash_backward", { pelvis: { x: -9, y: -5 }, torso: { rotation: -13 }, head: { rotation: 9 }, arm_upper_l: { rotation: 20 }, arm_upper_r: { rotation: 24 } }),
  jump_squat: reaction("jump_squat", { pelvis: { y: -24 }, torso: { rotation: 10 }, leg_upper_l: { rotation: 42 }, leg_lower_l: { rotation: -52 }, leg_upper_r: { rotation: -40 }, leg_lower_r: { rotation: 50 } }),
  jump_rise: reaction("jump_rise", { pelvis: { y: 5 }, torso: { rotation: -5 }, leg_upper_l: { rotation: 22 }, leg_upper_r: { rotation: -25 } }),
  jump_apex: reaction("jump_apex", { pelvis: { y: 3 }, leg_upper_l: { rotation: 36 }, leg_lower_l: { rotation: -44 }, leg_upper_r: { rotation: 30 }, leg_lower_r: { rotation: -40 } }),
  jump_fall: reaction("jump_fall", { torso: { rotation: -4 }, leg_upper_l: { rotation: -10 }, leg_upper_r: { rotation: 8 } }),
  landing: reaction("landing", { pelvis: { y: -20 }, torso: { rotation: 9 }, leg_upper_l: { rotation: 38 }, leg_lower_l: { rotation: -48 }, leg_upper_r: { rotation: -36 }, leg_lower_r: { rotation: 46 } }),
  crouch_enter: reaction("crouch_enter", { pelvis: { y: -28 }, torso: { rotation: 8 }, leg_upper_l: { rotation: 48 }, leg_lower_l: { rotation: -60 }, leg_upper_r: { rotation: -46 }, leg_lower_r: { rotation: 58 } }),
  crouch_idle: clip("crouch_idle", 40, true, [{ frame: 0, bones: { ...NEUTRAL, pelvis: { y: -28 }, torso: { rotation: 8 }, leg_upper_l: { rotation: 48 }, leg_lower_l: { rotation: -60 }, leg_upper_r: { rotation: -46 }, leg_lower_r: { rotation: 58 } } }, { frame: 20, bones: { pelvis: { y: -30 }, torso: { rotation: 10 } } }, { frame: 40, bones: { ...NEUTRAL, pelvis: { y: -28 }, torso: { rotation: 8 }, leg_upper_l: { rotation: 48 }, leg_lower_l: { rotation: -60 }, leg_upper_r: { rotation: -46 }, leg_lower_r: { rotation: 58 } } }]),
  block_stand: reaction("block_stand", { torso: { rotation: -8 }, arm_upper_l: { rotation: 72 }, arm_lower_l: { rotation: 42 }, arm_upper_r: { rotation: 82 }, arm_lower_r: { rotation: 36 } }),
  block_crouch: reaction("block_crouch", { pelvis: { y: -24 }, torso: { rotation: -3 }, arm_upper_l: { rotation: 64 }, arm_lower_l: { rotation: 54 }, arm_upper_r: { rotation: 72 }, arm_lower_r: { rotation: 48 } }),
  hit_stand: reaction("hit_stand", { pelvis: { x: -8 }, torso: { rotation: -20 }, head: { rotation: 18 }, arm_upper_l: { rotation: -34 }, arm_upper_r: { rotation: -25 } }),
  hit_crouch: reaction("hit_crouch", { pelvis: { x: -7, y: -24 }, torso: { rotation: -18 }, head: { rotation: 15 } }),
  hit_air: reaction("hit_air", { torso: { rotation: -26 }, head: { rotation: 21 }, leg_upper_l: { rotation: 38 }, leg_upper_r: { rotation: 28 } }),
  stagger: reaction("stagger", { pelvis: { x: -13, y: -9 }, torso: { rotation: -28 }, head: { rotation: 24 }, arm_upper_l: { rotation: -46 }, arm_upper_r: { rotation: -38 }, leg_upper_l: { rotation: -20 }, leg_upper_r: { rotation: 26 } }),
  knockdown: reaction("knockdown", { pelvis: { y: -55, rotation: -72 }, torso: { rotation: -15 }, head: { rotation: 20 } }),
  getup: reaction("getup", { pelvis: { y: -25, rotation: -25 }, torso: { rotation: 12 }, leg_upper_l: { rotation: 40 }, leg_upper_r: { rotation: -38 } }),
  chain_sweep: clip("chain_sweep", 115, false, [{ frame: 0, bones: NEUTRAL }, { frame: 28, bones: { torso: { rotation: -14 }, arm_upper_r: { rotation: -24 }, arm_lower_r: { rotation: 18 } } }, { frame: 42, bones: { torso: { rotation: 22 }, arm_upper_r: { rotation: 88 }, arm_lower_r: { rotation: -6 }, pelvis: { x: 12, y: -8 } } }, { frame: 55, bones: { torso: { rotation: 29 }, arm_upper_r: { rotation: 116 }, arm_lower_r: { rotation: -18 } } }, { frame: 115, bones: NEUTRAL }]),
  bell_hammer: clip("bell_hammer", 115, false, [{ frame: 0, bones: NEUTRAL }, { frame: 24, bones: { torso: { rotation: -8 }, arm_upper_l: { rotation: 154 }, arm_lower_l: { rotation: -18 }, arm_upper_r: { rotation: 142 }, arm_lower_r: { rotation: -12 } } }, { frame: 38, bones: { pelvis: { y: -18 }, torso: { rotation: 25 }, arm_upper_l: { rotation: 48 }, arm_lower_l: { rotation: 12 }, arm_upper_r: { rotation: 56 }, arm_lower_r: { rotation: 8 } } }, { frame: 115, bones: NEUTRAL }]),
  grave_pulse: clip("grave_pulse", 101, false, [{ frame: 0, bones: NEUTRAL }, { frame: 25, bones: { pelvis: { y: -15 }, torso: { rotation: 0 }, arm_upper_l: { rotation: -70 }, arm_lower_l: { rotation: 4 }, arm_upper_r: { rotation: 70 }, arm_lower_r: { rotation: -4 } } }, { frame: 36, bones: { pelvis: { y: 5 }, torso: { rotation: -5 }, arm_upper_l: { rotation: -92 }, arm_upper_r: { rotation: 92 } } }, { frame: 101, bones: NEUTRAL }]),
  chain_hook: clip("chain_hook", 89, false, [{ frame: 0, bones: NEUTRAL }, { frame: 20, bones: { torso: { rotation: -12 }, arm_upper_r: { rotation: -28 }, arm_lower_r: { rotation: 64 } } }, { frame: 31, bones: { pelvis: { x: 8 }, torso: { rotation: 17 }, arm_upper_r: { rotation: 82 }, arm_lower_r: { rotation: 6 } } }, { frame: 45, bones: { torso: { rotation: 25 }, arm_upper_r: { rotation: 112 }, arm_lower_r: { rotation: -18 } } }, { frame: 89, bones: NEUTRAL }]),
  phase_transition: clip("phase_transition", 48, false, [{ frame: 0, bones: NEUTRAL }, { frame: 20, bones: { pelvis: { y: -14 }, torso: { rotation: -8 }, head: { rotation: 12 }, arm_upper_l: { rotation: -82 }, arm_upper_r: { rotation: 82 } } }, { frame: 48, bones: NEUTRAL }]),
  defeat: clip("defeat", 70, false, [{ frame: 0, bones: NEUTRAL }, { frame: 28, bones: { pelvis: { y: -34, rotation: -28 }, torso: { rotation: -35 }, head: { rotation: 26 }, leg_upper_l: { rotation: 42 }, leg_upper_r: { rotation: -34 } } }, { frame: 70, bones: { pelvis: { y: -68, rotation: -88 }, torso: { rotation: -18 }, head: { rotation: 22 }, arm_upper_l: { rotation: 52 }, arm_upper_r: { rotation: -46 } } }]),
};

export const BELL_WARDEN_PLAYBACK = {
  walk_forward: { phaseMode: "distance", strideDistance: 72 },
  walk_backward: { phaseMode: "distance", strideDistance: 64 },
} as const;
