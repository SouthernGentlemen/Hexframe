import { ACTION_SLOT_COUNT } from "../combat/types";

const KEYBOARD_KEYS = ["↑", "←", "→", "↓"] as const;
const GAMEPAD_KEYS = ["Y", "X", "B", "A"] as const;
const KEYBOARD_MODIFIERS = ["", "Shift+", "Space+", "Shift+Space+"] as const;
const GAMEPAD_MODIFIERS = ["", "LT+", "RT+", "LT+RT+"] as const;

export interface ActionSlotLabel {
  slot: number;
  keyboard: string;
  gamepad: string;
}

export function actionSlotLabel(slot: number): ActionSlotLabel {
  const safe = Math.max(0, Math.min(ACTION_SLOT_COUNT - 1, Math.trunc(slot)));
  const bank = Math.trunc(safe / 4);
  const position = safe % 4;
  return {
    slot: safe,
    keyboard: `${KEYBOARD_MODIFIERS[bank]}${KEYBOARD_KEYS[position]}`,
    gamepad: `${GAMEPAD_MODIFIERS[bank]}${GAMEPAD_KEYS[position]}`,
  };
}

export const ACTION_SLOT_LABELS: readonly ActionSlotLabel[] = Array.from(
  { length: ACTION_SLOT_COUNT },
  (_, slot) => actionSlotLabel(slot),
);
