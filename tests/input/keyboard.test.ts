import { describe, expect, it } from "vitest";

import { InputBit } from "../../src/combat/types";
import { KeyboardController } from "../../src/input/controller/keyboard";
import { DEFAULT_ACTION_KEYMAP, DEFAULT_KEYMAP_P1 } from "../../src/input/controller/keymap";

function key(target: EventTarget, type: "keydown" | "keyup", code: string): void {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    code: { value: code },
    ctrlKey: { value: false },
    metaKey: { value: false },
    altKey: { value: false },
  });
  target.dispatchEvent(event);
}

describe("keyboard input adapter", () => {
  it("queues an ultra-fast action tap for exactly one sample", () => {
    const target = new EventTarget();
    const keyboard = new KeyboardController(target, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
    key(target, "keydown", "ArrowUp");
    key(target, "keyup", "ArrowUp");

    expect(keyboard.sample()).toBe(InputBit.Action1);
    expect(keyboard.sample()).toBe(0);
    keyboard.dispose();
  });

  it("continues sampling a movement key while it is held", () => {
    const target = new EventTarget();
    const keyboard = new KeyboardController(target, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
    key(target, "keydown", "KeyD");

    expect(keyboard.sample()).toBe(InputBit.Right);
    expect(keyboard.sample()).toBe(InputBit.Right);
    key(target, "keyup", "KeyD");
    expect(keyboard.sample()).toBe(0);
    keyboard.dispose();
  });

  it("reserves Space for the frame transport and uses E for action bank three", () => {
    const target = new EventTarget();
    const keyboard = new KeyboardController(target, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
    key(target, "keydown", "KeyE");
    key(target, "keydown", "ArrowUp");

    expect(keyboard.sample()).toBe(InputBit.Action9);
    key(target, "keyup", "ArrowUp");
    key(target, "keyup", "KeyE");
    key(target, "keydown", "Space");
    key(target, "keydown", "ArrowUp");
    expect(keyboard.sample()).toBe(InputBit.Action1);
    keyboard.dispose();
  });
});
