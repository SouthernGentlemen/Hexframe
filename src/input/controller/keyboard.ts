/**
 * The one browser-facing file in `src/input`. Nothing under `src/combat` may import it,
 * and nothing here may reach back into the simulation: this collects what the player is
 * physically holding and hands over a bitmask, and the caller decides what frame that
 * mask belongs to.
 */

import type { InputFrame } from "../../combat/types";
import { actionBit, INPUT_MASK } from "../../combat/types";
import type { ActionKeyMap, KeyMap } from "./keymap";

export class KeyboardController {
  private readonly target: EventTarget;
  private readonly map: KeyMap;
  private readonly actionMap: ActionKeyMap;
  /** Own keys of `map`, so a code like `constructor` cannot match through the prototype. */
  private readonly mapped: Set<string>;
  /**
   * Held keys are tracked by code rather than by accumulated bits, because two codes may
   * carry the same bit and releasing one of them must not clear a bit the other still
   * holds down.
   */
  private readonly held = new Set<string>();
  /** A tap that began and ended between two samples still belongs to the next frame. */
  private readonly pressed = new Set<string>();
  private disposed = false;

  private readonly onKeyDown = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (!this.captures(e)) return;
    this.held.add(e.code);
    this.pressed.add(e.code);
    e.preventDefault();
  };

  private readonly onKeyUp = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (!this.captures(e)) return;
    this.held.delete(e.code);
    e.preventDefault();
  };

  /**
   * A key held while the window loses focus never delivers its keyup, so without this the
   * fighter walks into the corner forever the moment the player alt-tabs.
   */
  private readonly onBlur = (): void => {
    this.held.clear();
    this.pressed.clear();
  };

  constructor(target: EventTarget, map: KeyMap, actionMap: ActionKeyMap = {}) {
    this.target = target;
    this.map = map;
    this.actionMap = actionMap;
    this.mapped = new Set([
      ...Object.keys(map),
      ...Object.keys(actionMap),
      "ShiftLeft",
      "ShiftRight",
      "KeyE",
    ]);
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  /** The bitmask for held keys plus taps queued since the previous sample. */
  sample(): InputFrame {
    let bits = 0;
    const active = new Set([...this.held, ...this.pressed]);
    for (const code of active) bits |= this.map[code] ?? 0;

    const shift = active.has("ShiftLeft") || active.has("ShiftRight");
    const alternate = active.has("KeyE");
    const bank = (shift ? 1 : 0) + (alternate ? 2 : 0);
    for (const [code, position] of Object.entries(this.actionMap)) {
      if (active.has(code)) bits |= actionBit(bank * 4 + position);
    }
    this.pressed.clear();
    return bits & INPUT_MASK;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
    this.held.clear();
    this.pressed.clear();
  }

  /**
   * Whether this event is ours to swallow. Only mapped codes are taken, so the page's own
   * shortcuts and the browser's keep working, and a mapped code held with a modifier is
   * left alone as well — Ctrl+L belongs to the address bar, not to heavy punch.
   */
  private captures(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const target = e.target;
    if (
      typeof Element !== "undefined" && target instanceof Element &&
      target.closest("button, a, input, select, textarea, [contenteditable='true']")
    ) {
      return false;
    }
    return this.mapped.has(e.code);
  }
}
