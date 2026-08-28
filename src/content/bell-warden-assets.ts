import {
  TEST_FIGHTER_ANIMATIONS,
  TEST_FIGHTER_PLAYBACK,
  TEST_FIGHTER_RIG,
} from "./test-fighter-assets";

/** Presentation-only cathedral beast skin; combat geometry lives in `bell-warden.ts`. */
export const BELL_WARDEN_MODEL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-70 -140 140 155">
  <g id="leg_upper_l" fill="#30343d"><path d="M-15 0 10 2 7 29-12 34Z"/></g>
  <g id="leg_lower_l" fill="#242831"><path d="M-11 0 8 0 13 28-15 28Z"/></g>
  <g id="foot_l" fill="#171a20"><path d="M-12 0 24 0 31 9-16 10Z"/></g>
  <g id="arm_upper_l" fill="#3a3e48"><path d="M-13-3 13 0 11 27-10 31Z"/><path d="M-15 3-28 13-13 16Z" fill="#6a5d42"/></g>
  <g id="arm_lower_l" fill="#2b2f38"><path d="M-11 0 11 0 13 28-10 31Z"/><path d="M-14 12H18V17H-14Z" fill="#8b774c"/></g>
  <g id="hand_l" fill="#16191e"><path d="M-11-1 13 0 18 13-15 13Z"/></g>
  <g id="pelvis" fill="#3a3e46"><path d="M-25-12 25-12 31 4 19 16-20 16-31 3Z"/><circle cx="0" cy="3" r="11" fill="#7c6135"/></g>
  <g id="torso" fill="#474b54"><path d="M-35-48 34-48 47-25 30 4-30 4-48-25Z"/><path d="M-24-34H24L31-6H-31Z" fill="#292d35"/><path d="M0-42 13-23 0-4-13-23Z" fill="#a67a36"/><path d="M-42-34-65-50-47-18ZM42-34 65-50 47-18Z" fill="#5b5e65"/></g>
  <g id="head" fill="#32363e"><path d="M-24-13-15-37 0-45 17-36 27-11 16 8-15 8Z"/><path d="M-18-31-36-47-27-20ZM18-31 38-48 29-19Z" fill="#77726a"/><circle cx="-9" cy="-14" r="4" fill="#f0c65a"/><circle cx="11" cy="-14" r="4" fill="#f0c65a"/><path d="M-14-1Q0 12 15-1" fill="none" stroke="#111" stroke-width="5"/></g>
  <g id="leg_upper_r" fill="#444851"><path d="M-15 0 11 2 8 30-12 34Z"/></g>
  <g id="leg_lower_r" fill="#343842"><path d="M-11 0 9 0 14 28-15 28Z"/></g>
  <g id="foot_r" fill="#20232a"><path d="M-12 0 25 0 33 9-16 10Z"/></g>
  <g id="arm_upper_r" fill="#555962"><path d="M-14-3 14 0 12 28-11 32Z"/><path d="M-15 3-29 14-13 17Z" fill="#8b774c"/></g>
  <g id="arm_lower_r" fill="#3b3f48"><path d="M-12 0 12 0 14 29-11 32Z"/><path d="M-15 12H19V18H-15Z" fill="#a78b50"/></g>
  <g id="hand_r" fill="#22252b"><path d="M-12-1 14 0 20 14-16 14Z"/></g>
</svg>`;

export const BELL_WARDEN_RIG = TEST_FIGHTER_RIG;
export const BELL_WARDEN_ANIMATIONS = TEST_FIGHTER_ANIMATIONS;
export const BELL_WARDEN_PLAYBACK = TEST_FIGHTER_PLAYBACK;
