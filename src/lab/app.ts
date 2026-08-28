import { Simulation } from "../combat/simulation/simulation";
import type { FrameReport } from "../combat/types";
import { testFighterSimConfig } from "../content/test-fighter";
import {
  TEST_FIGHTER_ANIMATIONS,
  TEST_FIGHTER_MODEL,
  TEST_FIGHTER_RIG,
} from "../content/test-fighter-assets";
import { KeyboardController } from "../input/controller/keyboard";
import { DEFAULT_KEYMAP_P1, DEFAULT_KEYMAP_P2 } from "../input/controller/keymap";
import { hashState } from "../rollback/hashing/fnv";
import type { DebugToggles } from "../renderer/svg/debug-overlay";
import { Renderer } from "../renderer/svg/renderer";
import { DebugPanel } from "./debugger/panel";
import { DummyController, DummyMode } from "./dummy/dummy";
import type { DummyModeValue } from "./dummy/dummy";
import { Timeline } from "./timeline/timeline";
import type { LabSpeed } from "./timeline/timeline";

const FRAME_MS = 1000 / 60;

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

function inputLegend(): string {
  return `<div class="input-legend" aria-label="Keyboard controls">
    <span><b>P1</b> WASD · J light</span>
    <span><b>P2 / record</b> arrows · numpad 1 light</span>
    <span><b>Lab</b> space pause · [ / ] step</span>
  </div>`;
}

/** Mounts the complete private combat laboratory and returns its teardown. */
export function startLab(mount: HTMLElement): () => void {
  mount.innerHTML = `<main class="lab-shell">
    <header class="lab-header">
      <div><p class="eyebrow">HEXFRAME / INTERNAL</p><h1>Combat laboratory</h1></div>
      <div class="header-actions"><span id="session-label">Private session</span><form method="post" action="/logout"><button class="ghost" type="submit">Sign out</button></form></div>
    </header>

    <section class="lab-toolbar" aria-label="Timeline controls">
      <button class="primary" type="button" data-action="pause">Pause</button>
      <button type="button" data-action="back">−1</button>
      <button type="button" data-action="forward">+1</button>
      <button type="button" data-action="reset">Reset</button>
      <label>Speed <select data-control="speed"><option value="25">25%</option><option value="50">50%</option><option value="100" selected>100%</option><option value="200">200%</option></select></label>
      <label>Dummy <select data-control="dummy">${DUMMY_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
      <span class="timeline-status" id="timeline-status">Frame 0</span>
    </section>

    <section class="playfield-card">
      <div class="hud" aria-label="Fighter health">
        <div class="hud-player"><span>P1</span><div class="health-track"><i id="health-p1"></i></div><strong id="health-text-p1">1000</strong></div>
        <div class="frame-readout"><span>FRAME</span><strong id="frame-readout">0</strong></div>
        <div class="hud-player hud-player-right"><strong id="health-text-p2">1000</strong><div class="health-track"><i id="health-p2"></i></div><span>P2</span></div>
      </div>
      <div id="stage" class="stage"></div>
      ${inputLegend()}
    </section>

    <section class="lab-grid">
      <aside class="control-card">
        <div class="card-heading"><div><p class="eyebrow">INSPECTION</p><h2>Overlays</h2></div></div>
        <div class="toggle-grid">
          ${[
            ["hitboxes", "Hitboxes"],
            ["hurtboxes", "Hurtboxes"],
            ["pushboxes", "Pushboxes"],
            ["origins", "Origins"],
            ["skeleton", "Skeleton"],
            ["boneNames", "Bone names"],
            ["velocity", "Velocity"],
          ]
            .map(
              ([key, label]) =>
                `<label class="toggle"><input type="checkbox" data-debug="${key}"${key === "origins" ? " checked" : ""}><span>${label}</span></label>`,
            )
            .join("")}
        </div>
        <div class="save-states"><h3>Save states</h3>${[1, 2, 3].map((slot) => `<div><span>Slot ${slot}</span><button type="button" data-save="${slot}">Save</button><button type="button" data-load="${slot}" disabled>Load</button></div>`).join("")}</div>
      </aside>
      <section class="debug-card"><div class="card-heading"><div><p class="eyebrow">AUTHORITATIVE STATE</p><h2>Frame inspector</h2></div><span class="live-dot">LIVE</span></div><div id="debug-panel"></div></section>
    </section>
  </main>`;

  const sim = new Simulation(testFighterSimConfig());
  const timeline = new Timeline(sim, 900);
  const dummy = new DummyController();
  const p1 = new KeyboardController(window, DEFAULT_KEYMAP_P1);
  const p2 = new KeyboardController(window, DEFAULT_KEYMAP_P2);
  const renderer = new Renderer(required("stage"), sim.characters(), {
    fighters: [0, 1].map(() => ({
      model: TEST_FIGHTER_MODEL,
      rig: TEST_FIGHTER_RIG,
      animations: TEST_FIGHTER_ANIMATIONS,
    })),
  });
  const panel = new DebugPanel(required("debug-panel"));
  const toggles: DebugToggles = {
    hitboxes: false,
    hurtboxes: false,
    pushboxes: false,
    origins: true,
    skeleton: false,
    boneNames: false,
    velocity: false,
  };

  timeline.inputProvider = () => {
    const secondPlayer = p2.sample();
    dummy.capture(secondPlayer);
    return [p1.sample(), dummy.inputFor(sim.getState(), 1, timeline.lastReport)];
  };

  let disposed = false;
  let animationId = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let lastReport: FrameReport | null = null;

  const render = (): void => {
    const state = sim.getState();
    renderer.render(state, lastReport ?? timeline.lastReport, toggles);
    panel.update(state, sim.characters(), lastReport ?? timeline.lastReport, hashState(state));
    required("frame-readout").textContent = String(state.frame);
    required("timeline-status").textContent = timeline.lastMessage ?? `Frame ${state.frame}${timeline.paused ? " · paused" : ""}`;
    for (let player = 0; player < 2; player++) {
      const fighter = state.fighters[player];
      const maximum = sim.characters()[player].health;
      const percent = Math.max(0, Math.min(100, (fighter.health / maximum) * 100));
      required(`health-p${player + 1}`).style.width = `${percent}%`;
      required(`health-text-p${player + 1}`).textContent = String(fighter.health);
    }
    const pause = mount.querySelector<HTMLButtonElement>("[data-action='pause']");
    if (pause) pause.textContent = timeline.paused ? "Play" : "Pause";
  };

  const loop = (now: number): void => {
    if (disposed) return;
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
    if (action === "back") {
      timeline.paused = true;
      timeline.stepFrames(-1);
      lastReport = null;
    }
    if (action === "forward") {
      timeline.paused = true;
      timeline.stepFrames(1);
      lastReport = timeline.lastReport;
    }
    if (action === "reset") {
      timeline.reset();
      dummy.reset();
      lastReport = null;
    }
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
    render();
  };

  const keydown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.code === "Space") {
      event.preventDefault();
      timeline.paused = !timeline.paused;
    } else if (event.code === "BracketLeft") {
      timeline.paused = true;
      timeline.stepFrames(-1);
      lastReport = null;
    } else if (event.code === "BracketRight") {
      timeline.paused = true;
      timeline.stepFrames(1);
      lastReport = timeline.lastReport;
    } else return;
    render();
  };

  mount.addEventListener("click", click);
  mount.addEventListener("change", change);
  window.addEventListener("keydown", keydown);
  void fetch("/api/lab/session")
    .then((response) => (response.ok ? response.json() : null))
    .then((session: unknown) => {
      if (
        typeof session === "object" &&
        session !== null &&
        "username" in session &&
        typeof session.username === "string"
      ) {
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
    p1.dispose();
    p2.dispose();
    renderer.dispose();
    mount.replaceChildren();
  };

  function required(id: string): HTMLElement {
    const element = mount.querySelector<HTMLElement>(`#${id}`);
    if (!element) throw new Error(`Lab element #${id} is missing`);
    return element;
  }
}
