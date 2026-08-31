import { px } from "../combat/constants";
import { Simulation } from "../combat/simulation/simulation";
import { DEFAULT_MOVE_LOADOUT, testFighterWithLoadout } from "../content/test-fighter";
import {
  TEST_FIGHTER_ANIMATIONS,
  TEST_FIGHTER_MODEL,
  TEST_FIGHTER_PLAYBACK,
  TEST_FIGHTER_RIG,
} from "../content/test-fighter-assets";
import { defaultSession, sessionUrl, STAGE_CATALOG } from "../game/session";
import type { DebugToggles } from "../renderer/svg/debug-overlay";
import { Renderer } from "../renderer/svg/renderer";

const PREVIEW_TOGGLES: DebugToggles = {
  hitboxes: false,
  hurtboxes: false,
  pushboxes: false,
  origins: false,
  skeleton: false,
  boneNames: false,
  velocity: false,
};

/** Mounts the two public routes without waiting for player data or constructing game menus. */
export async function startFrontApp(mount: HTMLElement): Promise<() => void> {
  let previewRenderers: Renderer[] = [];

  const render = (): void => {
    for (const renderer of previewRenderers) renderer.dispose();
    mount.innerHTML = routeMarkup(window.location.pathname);
    mount.removeAttribute("aria-busy");
    previewRenderers = mountTrainingStages(mount);
  };

  const click = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!target?.dataset.launchTraining) return;
    const session = defaultSession("training");
    session.options.tutorial = target.dataset.tutorial === "true";
    window.location.href = sessionUrl(session);
  };

  mount.addEventListener("click", click);
  render();
  return () => {
    mount.removeEventListener("click", click);
    for (const renderer of previewRenderers) renderer.dispose();
    mount.replaceChildren();
  };
}

function routeMarkup(pathname: string): string {
  const path = normalizePath(pathname);
  if (path === "/") return overviewMarkup();
  if (path === "/play/" || path === "/training/") return shell(trainingMarkup(), "Training");
  return shell(notFoundMarkup(), "Not found");
}

function shell(content: string, label: string): string {
  return `<main class="route-shell" aria-label="${label}"><header class="route-global"><a class="route-brand" href="/">HEXFRAME</a><nav aria-label="Primary"><a href="/">OVERVIEW</a><a href="/play/" aria-current="page">TRAINING</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">GITHUB ↗</a></nav></header>${content}</main>`;
}

function overviewMarkup(): string {
  return `<main class="project-overview" id="main"><a class="skip-link" href="#overview-content">Skip to project overview</a><header class="overview-nav"><a class="route-brand" href="/">HEXFRAME</a><nav aria-label="Primary"><a href="/" aria-current="page">Overview</a><a href="/play/">Training</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav></header>
    <section class="overview-hero" id="overview-content"><div class="overview-copy"><p class="overview-kicker">Browser fighting-game lab</p><h1>Practice the hit.<br><span>Inspect the result.</span></h1><p>Fight a training dummy, pause on contact, and step through the exact frames that decided the hit.</p><div class="overview-actions"><a class="overview-primary" href="/play/">Open training →</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">View source ↗</a></div></div>
      <figure class="overview-demo"><figcaption><span>TRAINING GRID</span><strong>PLAYER + DUMMY</strong></figcaption><div class="overview-training-stage" data-training-stage role="img" aria-label="Hexframe's training stage with the player facing a practice dummy"></div><footer><span>60 HZ COMBAT</span><span>ACTUAL GAME RENDERER</span></footer></figure>
    </section>
    <section class="overview-proof" aria-label="Training lab capabilities"><span>Stage + dummy</span><span>Pause on contact</span><span>Frame step and replay</span><span>Keyboard + gamepad</span></section>
    <section class="overview-sections"><article><span>01 / PRACTICE</span><h2>Test the move.</h2><p>Move, attack, block, and repeat against a configurable dummy on the real training stage.</p></article><article><span>02 / INSPECT</span><h2>Read the hit.</h2><p>Pause on contact, advance one frame at a time, and reveal hitboxes, hurtboxes, and pushboxes.</p></article><article><span>03 / REPEAT</span><h2>Reproduce it.</h2><p>Save positions or capture a scenario, then replay the same inputs through the same combat rules.</p></article><article><span>04 / ACCESS</span><h2>Use your controls.</h2><p>Keyboard and gamepad share the same actions, with adjustable text, contrast, motion, and combat feedback.</p></article></section>
    <footer class="overview-footer"><span>Wizard Gang · Hexframe</span><a href="https://wizardgang.ai/projects/hexframe/">Case study ↗</a></footer></main>`;
}

function trainingMarkup(): string {
  return screenHeader("TRAINING", "Hit the dummy. Inspect the result.", "/") + `<section class="training-entry"><div class="training-preview"><div class="training-preview-stage" data-training-stage role="img" aria-label="Hexframe's training stage with the player facing a practice dummy"></div><div class="training-preview-labels" aria-hidden="true"><span>PLAYER</span><span>DUMMY</span></div></div><article><div><p>TRAINING LAB</p><h2>One stage. One dummy. Every frame.</h2><span>Learn the controls with a short tutorial or go straight to free practice.</span><div class="training-input-notice" role="note">Hexframe training needs a keyboard or gamepad — best on desktop.</div></div><div class="training-entry-actions"><button type="button" data-launch-training="true">Free practice</button><button class="route-primary" type="button" data-launch-training="true" data-tutorial="true">Start tutorial</button></div></article></section>`;
}

function screenHeader(eyebrow: string, title: string, back: string): string {
  return `<header class="route-heading"><a href="${back}">← Back</a><p>${eyebrow}</p><h1>${title}</h1></header>`;
}

function notFoundMarkup(): string {
  return screenHeader("HEXFRAME", "Route not found", "/play/") + `<p class="route-empty">That page does not exist.</p>`;
}

function normalizePath(pathname: string): string {
  return pathname === "/" ? "/" : `${pathname.replace(/\/+$/, "")}/`;
}

function mountTrainingStages(mount: HTMLElement): Renderer[] {
  const renderers: Renderer[] = [];
  for (const stageMount of mount.querySelectorAll<HTMLElement>("[data-training-stage]")) {
    const player = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
    const dummy = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
    const stage = STAGE_CATALOG["training-grid"].stage;
    const simulation = new Simulation({
      characters: [player, dummy],
      startX: [px(-105), px(105)],
      teams: [0, 1],
      seed: 0x5eed,
      stage,
    });
    const fighter = {
      model: TEST_FIGHTER_MODEL,
      rig: TEST_FIGHTER_RIG,
      animations: TEST_FIGHTER_ANIMATIONS,
      playback: TEST_FIGHTER_PLAYBACK,
      presentationScale: 1.45,
    };
    const renderer = new Renderer(stageMount, [player, dummy], { fighters: [fighter, fighter], stage });
    renderer.render(simulation.getState(), null, PREVIEW_TOGGLES);
    const svg = stageMount.querySelector("svg");
    svg?.setAttribute("aria-hidden", "true");
    svg?.removeAttribute("role");
    renderers.push(renderer);
  }
  return renderers;
}
