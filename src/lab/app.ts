import { px } from "../combat/constants";
import { ACTION_SLOT_COUNT } from "../combat/types";
import type { FrameReport, SimConfig } from "../combat/types";
import { Simulation } from "../combat/simulation/simulation";
import {
  commandsForLoadout,
  DEFAULT_MOVE_LOADOUT,
  testFighterWithLoadout,
} from "../content/test-fighter";
import {
  TEST_FIGHTER_ANIMATIONS,
  TEST_FIGHTER_MODEL,
  TEST_FIGHTER_RIG,
} from "../content/test-fighter-assets";
import { ACTION_SLOT_LABELS } from "../input/action-layout";
import { GamepadController } from "../input/controller/gamepad";
import type { GamepadUiState } from "../input/controller/gamepad";
import { KeyboardController } from "../input/controller/keyboard";
import {
  DEFAULT_ACTION_KEYMAP,
  DEFAULT_KEYMAP_P1,
  DEFAULT_KEYMAP_P2,
  NO_ACTION_KEYMAP,
} from "../input/controller/keymap";
import { hashState } from "../rollback/hashing/fnv";
import type { DebugToggles } from "../renderer/svg/debug-overlay";
import { Renderer } from "../renderer/svg/renderer";
import { DebugPanel } from "./debugger/panel";
import { DummyController, DummyMode } from "./dummy/dummy";
import type { DummyModeValue } from "./dummy/dummy";
import { Timeline } from "./timeline/timeline";
import type { LabSpeed } from "./timeline/timeline";

const FRAME_MS = 1000 / 60;
const LOADOUT_STORAGE_KEY = "hexframe.move-loadout.v1";

const DUMMY_OPTIONS: readonly [DummyModeValue, string][] = [
  [DummyMode.Stand, "Stand"],
  [DummyMode.Crouch, "Crouch"],
  [DummyMode.Jump, "Jump"],
  [DummyMode.BlockNone, "Block none"],
  [DummyMode.BlockAll, "Block all"],
  [DummyMode.BlockAfterFirstHit, "Block after first hit"],
  [DummyMode.Record, "Record P2"],
  [DummyMode.Playback, "Playback"],
  [DummyMode.Counterattack, "Counterattack"],
  [DummyMode.Reversal, "Reversal"],
];

type MenuTab = "loadout" | "training" | "debug";

function safeLoadout(validMoveIds: ReadonlySet<number>): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LOADOUT_STORAGE_KEY) ?? "null");
    if (!Array.isArray(value) || value.length !== ACTION_SLOT_COUNT) {
      return DEFAULT_MOVE_LOADOUT.slice();
    }
    return value.map((moveId, slot) =>
      typeof moveId === "number" && validMoveIds.has(moveId)
        ? moveId
        : DEFAULT_MOVE_LOADOUT[slot],
    );
  } catch {
    return DEFAULT_MOVE_LOADOUT.slice();
  }
}

function edge(now: GamepadUiState, before: GamepadUiState, key: keyof GamepadUiState): boolean {
  return now[key] && !before[key];
}

/** Mounts the controller-first combat laboratory and returns its teardown. */
export function startLab(mount: HTMLElement): () => void {
  const catalogCharacter = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
  const validMoveIds = new Set(catalogCharacter.moves.map((move) => move.id));
  const loadout = safeLoadout(validMoveIds);
  const playerCharacter = testFighterWithLoadout(loadout);
  const dummyCharacter = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
  const config: SimConfig = {
    characters: [playerCharacter, dummyCharacter],
    startX: [px(-120), px(120)],
    seed: 0x5eed,
  };

  const moveOptions = playerCharacter.moves
    .map((move) => `<option value="${move.id}">${move.id.toString().padStart(2, "0")} · ${move.key.replaceAll("_", " ")} · ${move.tags.join(" / ")}</option>`)
    .join("");
  const loadoutRows = ACTION_SLOT_LABELS.map((label) => {
    const selected = loadout[label.slot];
    return `<label class="loadout-row" data-gamepad-nav tabindex="0">
      <span class="slot-number">${String(label.slot + 1).padStart(2, "0")}</span>
      <kbd>${label.keyboard}</kbd><kbd class="pad-key">${label.gamepad}</kbd>
      <select data-loadout-slot="${label.slot}" aria-label="Move for action ${label.slot + 1}">
        ${moveOptions.replace(`value="${selected}"`, `value="${selected}" selected`)}
      </select>
    </label>`;
  }).join("");
  const moveLibrary = playerCharacter.moves.map((move) => `<article class="move-card">
    <span>${String(move.id).padStart(2, "0")}</span>
    <div><h3>${move.key.replaceAll("_", " ")}</h3><p>${move.description}</p><ul>${move.tags.map((tag) => `<li>${tag}</li>`).join("")}</ul></div>
  </article>`).join("");

  mount.innerHTML = `<main class="lab-shell">
    <header class="lab-header">
      <div class="brand"><p class="eyebrow">HEXFRAME / LAB</p><h1>Build your route.</h1></div>
      <div class="header-actions">
        <span class="controller-state" id="controller-state">Keyboard</span>
        <button class="primary" type="button" data-action="pause">Pause</button>
        <button type="button" data-action="menu" aria-haspopup="dialog">Build & settings</button>
      </div>
    </header>

    <section class="playfield-card">
      <div class="hud" aria-label="Fighter health">
        <div class="hud-player"><span>YOU</span><div class="health-track"><i id="health-p1"></i></div><strong id="health-text-p1">1000</strong></div>
        <div class="frame-readout"><span id="play-state">LIVE</span><strong id="frame-readout">0</strong></div>
        <div class="hud-player hud-player-right"><strong id="health-text-p2">1000</strong><div class="health-track"><i id="health-p2"></i></div><span>DUMMY</span></div>
      </div>
      <div id="stage" class="stage"></div>
      <div class="current-route"><span>ACTIVE</span><strong id="active-move">Ready</strong><em id="active-tags">Choose any 16 of 24 moves</em></div>
    </section>

    <footer class="control-legend">
      <span><b>MOVE</b> WASD / left stick</span>
      <span><b>ACTIONS</b> arrows / Y X B A</span>
      <span><b>BANK 2</b> Shift / LT</span>
      <span><b>BANK 3</b> Space / RT</span>
      <span><b>MENU</b> Esc / View</span>
      <span><b>PAUSE</b> P / Start</span>
    </footer>

    <div class="menu-scrim" id="menu-scrim" hidden>
      <aside class="lab-menu" id="lab-menu" role="dialog" aria-modal="true" aria-labelledby="menu-title">
        <header class="menu-header"><div><p class="eyebrow">LOADOUT SYSTEM</p><h2 id="menu-title">Build & settings</h2></div><button type="button" data-action="close-menu" data-gamepad-nav>Close</button></header>
        <nav class="menu-tabs" aria-label="Settings sections">
          <button class="active" type="button" data-menu-tab="loadout" data-gamepad-nav>Move loadout</button>
          <button type="button" data-menu-tab="training" data-gamepad-nav>Training</button>
          <button type="button" data-menu-tab="debug" data-gamepad-nav>Debug</button>
        </nav>

        <section class="menu-page active" data-menu-page="loadout">
          <div class="page-intro"><div><h2>16 action inputs. 24 possible moves.</h2><p>Assign a move to every keyboard/gamepad chord. Matching tags are the vocabulary for building your own combo routes.</p></div><button type="button" data-action="default-loadout" data-gamepad-nav>Reset assignments</button></div>
          <div class="loadout-grid">${loadoutRows}</div>
          <div class="library-heading"><h2>Move library</h2><span>24 unique attacks</span></div>
          <div class="move-library">${moveLibrary}</div>
        </section>

        <section class="menu-page" data-menu-page="training" hidden>
          <div class="settings-grid">
            <label data-gamepad-nav tabindex="0"><span>Simulation speed</span><select data-control="speed"><option value="25">25%</option><option value="50">50%</option><option value="100" selected>100%</option><option value="200">200%</option></select></label>
            <label data-gamepad-nav tabindex="0"><span>Training dummy</span><select data-control="dummy">${DUMMY_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
          </div>
          <div class="timeline-tools">
            <button type="button" data-action="back" data-gamepad-nav>Step −1</button>
            <button type="button" data-action="forward" data-gamepad-nav>Step +1</button>
            <button type="button" data-action="reset" data-gamepad-nav>Reset match</button>
            <span id="timeline-status">Frame 0</span>
          </div>
          <div class="save-states"><h3>Save states</h3>${[1, 2, 3].map((slot) => `<div><span>Slot ${slot}</span><button type="button" data-save="${slot}" data-gamepad-nav>Save</button><button type="button" data-load="${slot}" data-gamepad-nav disabled>Load</button></div>`).join("")}</div>
        </section>

        <section class="menu-page" data-menu-page="debug" hidden>
          <p class="debug-warning">These tools expose engine internals. They do not affect combat state.</p>
          <div class="toggle-grid">
            ${[
              ["hitboxes", "Hitboxes"], ["hurtboxes", "Hurtboxes"], ["pushboxes", "Pushboxes"],
              ["origins", "Origins"], ["skeleton", "Skeleton"], ["boneNames", "Bone names"], ["velocity", "Velocity"],
            ].map(([key, label]) => `<label class="toggle" data-gamepad-nav tabindex="0"><input type="checkbox" data-debug="${key}"><span>${label}</span></label>`).join("")}
          </div>
          <div class="debug-card"><div class="card-heading"><span>Authoritative state</span><em>LIVE</em></div><div id="debug-panel"></div></div>
        </section>

        <footer class="menu-footer"><span>D-pad navigate · A select · B close · LB/RB tabs</span><form method="post" action="/logout"><button class="ghost" type="submit" data-gamepad-nav>Sign out <span id="session-label"></span></button></form></footer>
      </aside>
    </div>
  </main>`;

  const sim = new Simulation(config);
  const timeline = new Timeline(sim, 900);
  const dummy = new DummyController();
  const keyboard = new KeyboardController(window, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
  const secondKeyboard = new KeyboardController(window, DEFAULT_KEYMAP_P2, NO_ACTION_KEYMAP);
  const gamepad = new GamepadController();
  const renderer = new Renderer(required("stage"), sim.characters(), {
    fighters: [0, 1].map(() => ({ model: TEST_FIGHTER_MODEL, rig: TEST_FIGHTER_RIG, animations: TEST_FIGHTER_ANIMATIONS })),
  });
  const panel = new DebugPanel(required("debug-panel"));
  const toggles: DebugToggles = {
    hitboxes: false, hurtboxes: false, pushboxes: false, origins: false,
    skeleton: false, boneNames: false, velocity: false,
  };

  timeline.inputProvider = () => {
    if (menuOpen()) return [0, 0];
    const secondPlayer = secondKeyboard.sample();
    dummy.capture(secondPlayer);
    return [keyboard.sample() | gamepad.sample(), dummy.inputFor(sim.getState(), 1, timeline.lastReport)];
  };

  let disposed = false;
  let animationId = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let lastReport: FrameReport | null = null;
  let activeTab: MenuTab = "loadout";
  let resumeAfterMenu = false;
  let previousUi = gamepad.sampleUi();

  const render = (): void => {
    const state = sim.getState();
    renderer.render(state, lastReport ?? timeline.lastReport, toggles);
    panel.update(state, sim.characters(), lastReport ?? timeline.lastReport, hashState(state));
    required("frame-readout").textContent = String(state.frame);
    required("play-state").textContent = timeline.paused ? "PAUSED" : "LIVE";
    required("timeline-status").textContent = timeline.lastMessage ?? `Frame ${state.frame}${timeline.paused ? " · paused" : ""}`;
    required("controller-state").textContent = gamepad.connected ? `Gamepad · ${gamepad.name}` : "Keyboard ready · connect gamepad anytime";
    for (let player = 0; player < 2; player++) {
      const fighter = state.fighters[player];
      const maximum = sim.characters()[player].health;
      const percent = Math.max(0, Math.min(100, (fighter.health / maximum) * 100));
      required(`health-p${player + 1}`).style.width = `${percent}%`;
      required(`health-text-p${player + 1}`).textContent = String(fighter.health);
    }
    const move = playerCharacter.moves.find((candidate) => candidate.id === state.fighters[0].moveId);
    required("active-move").textContent = move?.key.replaceAll("_", " ") ?? "Ready";
    required("active-tags").textContent = move?.tags.join(" · ") ?? "Choose any 16 of 24 moves";
    const pause = mount.querySelector<HTMLButtonElement>("[data-action='pause']");
    if (pause) pause.textContent = timeline.paused ? "Play" : "Pause";
  };

  const loop = (now: number): void => {
    if (disposed) return;
    handleGamepadUi();
    elapsed += Math.min(250, Math.max(0, now - lastTime));
    lastTime = now;
    const realFrames = Math.trunc(elapsed / FRAME_MS);
    if (realFrames > 0) {
      elapsed -= realFrames * FRAME_MS;
      const reports = timeline.tick(realFrames);
      if (reports.length > 0) lastReport = reports[reports.length - 1];
    }
    render();
    animationId = requestAnimationFrame(loop);
  };

  const click = (event: Event): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "pause") timeline.paused = !timeline.paused;
    if (action === "menu") openMenu();
    if (action === "close-menu") closeMenu();
    if (action === "back") stepFrames(-1);
    if (action === "forward") stepFrames(1);
    if (action === "reset") resetMatch();
    if (action === "default-loadout") setDefaultLoadout();
    if (button.dataset.menuTab) showTab(button.dataset.menuTab as MenuTab);
    const save = button.dataset.save;
    if (save) {
      timeline.saveState(Number(save));
      mount.querySelector<HTMLButtonElement>(`[data-load='${save}']`)!.disabled = false;
    }
    const load = button.dataset.load;
    if (load && timeline.loadState(Number(load))) {
      timeline.paused = true;
      lastReport = null;
    }
    render();
  };

  const change = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.control === "speed") timeline.speed = Number(target.value) as LabSpeed;
    if (target.dataset.control === "dummy") dummy.mode = Number(target.value) as DummyModeValue;
    const debug = target.dataset.debug as keyof DebugToggles | undefined;
    if (debug) toggles[debug] = (target as HTMLInputElement).checked;
    const slotText = target.dataset.loadoutSlot;
    if (slotText !== undefined) assignMove(Number(slotText), Number(target.value));
    render();
  };

  const keydown = (event: KeyboardEvent): void => {
    if (event.code === "Escape") {
      event.preventDefault();
      menuOpen() ? closeMenu() : openMenu();
    } else if (event.code === "KeyP" && !isFormControl(event.target)) {
      event.preventDefault();
      timeline.paused = !timeline.paused;
    } else if (event.code === "BracketLeft" && !isFormControl(event.target)) {
      stepFrames(-1);
    } else if (event.code === "BracketRight" && !isFormControl(event.target)) {
      stepFrames(1);
    } else return;
    render();
  };

  mount.addEventListener("click", click);
  mount.addEventListener("change", change);
  window.addEventListener("keydown", keydown);
  void fetch("/api/lab/session")
    .then((response) => (response.ok ? response.json() : null))
    .then((session: unknown) => {
      if (typeof session === "object" && session !== null && "username" in session && typeof session.username === "string") {
        required("session-label").textContent = session.username;
      }
    })
    .catch(() => undefined);
  render();
  animationId = requestAnimationFrame(loop);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationId);
    mount.removeEventListener("click", click);
    mount.removeEventListener("change", change);
    window.removeEventListener("keydown", keydown);
    keyboard.dispose();
    secondKeyboard.dispose();
    renderer.dispose();
    mount.replaceChildren();
  };

  function required(id: string): HTMLElement {
    const element = mount.querySelector<HTMLElement>(`#${id}`);
    if (!element) throw new Error(`Lab element #${id} is missing`);
    return element;
  }

  function menuOpen(): boolean {
    return !required("menu-scrim").hidden;
  }

  function openMenu(): void {
    if (menuOpen()) return;
    resumeAfterMenu = !timeline.paused;
    timeline.paused = true;
    required("menu-scrim").hidden = false;
    visibleGamepadTargets()[0]?.focus();
  }

  function closeMenu(): void {
    if (!menuOpen()) return;
    required("menu-scrim").hidden = true;
    if (resumeAfterMenu) timeline.paused = false;
    resumeAfterMenu = false;
    mount.querySelector<HTMLButtonElement>("[data-action='menu']")?.focus();
  }

  function showTab(tab: MenuTab): void {
    activeTab = tab;
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-menu-tab]")) {
      button.classList.toggle("active", button.dataset.menuTab === tab);
    }
    for (const page of mount.querySelectorAll<HTMLElement>("[data-menu-page]")) {
      const active = page.dataset.menuPage === tab;
      page.hidden = !active;
      page.classList.toggle("active", active);
    }
  }

  function assignMove(slot: number, moveId: number): void {
    if (slot < 0 || slot >= ACTION_SLOT_COUNT || !validMoveIds.has(moveId)) return;
    loadout[slot] = moveId;
    playerCharacter.commands = commandsForLoadout(playerCharacter, loadout);
    localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(loadout));
    resetMatch();
  }

  function setDefaultLoadout(): void {
    for (let slot = 0; slot < ACTION_SLOT_COUNT; slot++) loadout[slot] = DEFAULT_MOVE_LOADOUT[slot];
    for (const element of mount.querySelectorAll("[data-loadout-slot]")) {
      const select = element as unknown as HTMLSelectElement;
      const slot = Number(select.dataset.loadoutSlot);
      select.value = String(loadout[slot]);
    }
    playerCharacter.commands = commandsForLoadout(playerCharacter, loadout);
    localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(loadout));
    resetMatch();
  }

  function resetMatch(): void {
    timeline.reset();
    dummy.reset();
    lastReport = null;
  }

  function stepFrames(count: number): void {
    timeline.paused = true;
    timeline.stepFrames(count);
    lastReport = count > 0 ? timeline.lastReport : null;
  }

  function handleGamepadUi(): void {
    const now = gamepad.sampleUi();
    if (!menuOpen()) {
      if (edge(now, previousUi, "start")) timeline.paused = !timeline.paused;
      if (edge(now, previousUi, "menu")) openMenu();
      if (timeline.paused && edge(now, previousUi, "leftBumper")) stepFrames(-1);
      if (timeline.paused && edge(now, previousUi, "rightBumper")) stepFrames(1);
      previousUi = now;
      return;
    }
    if (edge(now, previousUi, "back") || edge(now, previousUi, "menu")) closeMenu();
    if (edge(now, previousUi, "leftBumper")) cycleTab(-1);
    if (edge(now, previousUi, "rightBumper")) cycleTab(1);
    if (edge(now, previousUi, "up")) focusGamepadTarget(-1);
    if (edge(now, previousUi, "down")) focusGamepadTarget(1);
    if (edge(now, previousUi, "left")) adjustFocused(-1);
    if (edge(now, previousUi, "right")) adjustFocused(1);
    if (edge(now, previousUi, "confirm")) activateFocused();
    previousUi = now;
  }

  function visibleGamepadTargets(): HTMLElement[] {
    return [...mount.querySelectorAll<HTMLElement>("[data-gamepad-nav]")].filter(
      (element) => !element.closest("[hidden]") && !(element instanceof HTMLButtonElement && element.disabled),
    );
  }

  function focusGamepadTarget(delta: number): void {
    const targets = visibleGamepadTargets();
    if (targets.length === 0) return;
    const current = document.activeElement instanceof HTMLElement
      ? targets.findIndex((target) => target === document.activeElement || target.contains(document.activeElement))
      : -1;
    targets[(current + delta + targets.length) % targets.length]?.focus();
  }

  function adjustFocused(delta: number): void {
    const active = document.activeElement;
    const select = active instanceof HTMLSelectElement
      ? active
      : active instanceof HTMLElement ? active.querySelector("select") as HTMLSelectElement | null : null;
    if (select) {
      select.selectedIndex = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + delta));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    const checkbox = active instanceof HTMLInputElement && active.type === "checkbox"
      ? active
      : active instanceof HTMLElement ? active.querySelector<HTMLInputElement>("input[type='checkbox']") : null;
    if (checkbox) {
      checkbox.checked = delta > 0;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function activateFocused(): void {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement) active.click();
    else if (active instanceof HTMLInputElement && active.type === "checkbox") active.click();
    else if (active instanceof HTMLElement) active.querySelector<HTMLElement>("button, input[type='checkbox']")?.click();
  }

  function cycleTab(delta: number): void {
    const tabs: MenuTab[] = ["loadout", "training", "debug"];
    const index = tabs.indexOf(activeTab);
    showTab(tabs[(index + delta + tabs.length) % tabs.length]);
    mount.querySelector<HTMLButtonElement>(`[data-menu-tab='${activeTab}']`)?.focus();
  }
}

function isFormControl(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}
