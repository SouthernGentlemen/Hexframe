import { ARMOR_CATALOG, canCraftArmor, materialById } from "../content/armor";
import { DEFAULT_MOVE_LOADOUT, testFighterWithLoadout } from "../content/test-fighter";
import { aiSlot, defaultSession, humanSlot, sessionUrl } from "../game/session";
import type { AiDifficulty, GameMode, PartySlot } from "../game/session";
import { moveFamilies, moveName, moveRole } from "../lab/move-presentation";
import { applyPreferences, loadPreferences, persistPreferences, resetPreferences } from "../lab/preferences";
import type { LabPreferences } from "../lab/preferences";
import { cachePlayerSave, craftPlayerArmor, loadPlayerSave, persistPlayerSave, resetPlayerCampaign } from "../player/client";
import type { PlayerSave } from "../player/save";

interface FrontState {
  save: PlayerSave;
  party: PartySlot[];
  pickerFor: number | null;
  preferences: LabPreferences;
}

const catalog = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);

/** Mounts one routed front-end screen without constructing a Simulation or combat renderer. */
export async function startFrontApp(mount: HTMLElement): Promise<() => void> {
  const save = await loadPlayerSave();
  const state: FrontState = {
    save,
    party: [humanSlot(save.loadouts.activeId)],
    pickerFor: null,
    preferences: loadPreferences(),
  };
  applyPreferences(state.preferences);

  const render = (): void => {
    mount.innerHTML = routeMarkup(window.location.pathname, state);
    mount.querySelector<HTMLElement>("[autofocus]")?.focus();
  };

  const click = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const button = target.closest<HTMLButtonElement>("button");
    if (!button) return;

    if (button.dataset.action === "back") {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "/play/";
    }
    if (button.dataset.action === "pick-slot") {
      state.pickerFor = Number(button.dataset.slot);
      render();
    }
    if (button.dataset.action === "cancel-picker") {
      state.pickerFor = null;
      render();
    }
    if (button.dataset.pickLoadout) {
      const index = Number(button.dataset.slot);
      if (index === 0) state.party[0] = humanSlot(button.dataset.pickLoadout);
      else state.party[index] = aiSlot(button.dataset.pickLoadout, index + 1, state.party[index]?.aiProfile?.difficulty);
      state.pickerFor = null;
      render();
    }
    if (button.dataset.action === "add-ai") {
      if (state.party.length < 3) state.pickerFor = state.party.length;
      render();
    }
    if (button.dataset.action === "remove-ai") {
      const index = Number(button.dataset.slot);
      state.party.splice(index, 1);
      state.party = state.party.map((slot, slotIndex) => slotIndex === 0 ? humanSlot(slot.loadoutId) : aiSlot(slot.loadoutId, slotIndex + 1, slot.aiProfile?.difficulty));
      render();
    }
    if (button.dataset.launch) launch(state, button.dataset.launch as GameMode, button.dataset.tutorial === "true");
    if (button.dataset.action === "save-loadout") void saveLoadout(mount, state);
    if (button.dataset.craftArmor) void craftArmor(state, button.dataset.craftArmor, render);
    if (button.dataset.action === "reset-settings") {
      state.preferences = resetPreferences();
      render();
    }
    if (button.dataset.action === "reset-campaign" && window.confirm("Reset campaign progress, unlocks, inventory, and loadouts?")) {
      void resetPlayerCampaign(state.save).then(() => { window.location.href = "/campaign/"; });
    }
  };

  const change = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.aiDifficulty !== undefined) {
      const index = Number(target.dataset.aiDifficulty);
      const slot = state.party[index];
      if (slot) state.party[index] = aiSlot(slot.loadoutId, index + 1, target.value as AiDifficulty);
      return;
    }
    const section = target.dataset.prefSection as keyof LabPreferences | undefined;
    const key = target.dataset.prefKey;
    if (!section || !key) return;
    const record = state.preferences[section] as unknown as Record<string, unknown>;
    record[key] = target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked
      : target instanceof HTMLInputElement && target.type === "range"
        ? Number(target.value)
        : target.value;
    persistPreferences(state.preferences);
    applyPreferences(state.preferences);
  };

  mount.addEventListener("click", click);
  mount.addEventListener("change", change);
  render();
  return () => {
    mount.removeEventListener("click", click);
    mount.removeEventListener("change", change);
    mount.replaceChildren();
  };
}

function routeMarkup(pathname: string, state: FrontState): string {
  const path = normalizePath(pathname);
  if (path === "/") return overviewMarkup();
  if (path === "/play/") return shell(trainingMarkup(state), "Training");
  if (path === "/campaign/") return shell(campaignMarkup(state), "Campaign");
  if (path === "/fight/") return shell(setupMarkup(state, "fight"), "Fight setup");
  if (path === "/training/") return shell(trainingMarkup(state), "Training");
  if (path === "/loadouts/") return shell(loadoutListMarkup(state), "Loadouts");
  const loadoutMatch = path.match(/^\/loadouts\/(loadout-0[1-3])\/$/);
  if (loadoutMatch) return shell(loadoutEditorMarkup(state, loadoutMatch[1]), "Loadout editor");
  if (path === "/forge/") return shell(forgeMarkup(state), "Forge");
  if (path === "/codex/") return shell(codexIndexMarkup(), "Codex");
  if (path === "/codex/moves/") return shell(moveIndexMarkup(), "Move Codex");
  const moveMatch = path.match(/^\/codex\/moves\/(\d+)\/$/);
  if (moveMatch) return shell(moveDetailMarkup(Number(moveMatch[1])), "Move Codex");
  if (path === "/codex/status/") return shell(statusIndexMarkup(), "Status Codex");
  const statusMatch = path.match(/^\/codex\/status\/([a-z-]+)\/$/);
  if (statusMatch) return shell(statusDetailMarkup(statusMatch[1]), "Status Codex");
  if (path === "/codex/enemies/bell-warden/") return shell(enemyMarkup(), "Enemy Codex");
  if (path === "/codex/stages/black-belfry/") return shell(stageMarkup(), "Stage Codex");
  if (path === "/settings/") return shell(settingsMarkup(state), "Settings");
  return shell(notFoundMarkup(), "Not found");
}

function shell(content: string, label: string): string {
  return `<main class="route-shell" aria-label="${label}"><header class="route-global"><a class="route-brand" href="/">HEXFRAME</a><nav aria-label="Primary"><a href="/">OVERVIEW</a><a href="/play/" aria-current="page">TRAINING</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">GITHUB ↗</a></nav></header>${content}</main>`;
}

function overviewMarkup(): string {
  return `<main class="project-overview" id="main"><a class="skip-link" href="#overview-content">Skip to project overview</a><header class="overview-nav"><a class="route-brand" href="/">HEXFRAME</a><nav aria-label="Primary"><a href="/" aria-current="page">Overview</a><a href="/play/">Training</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav></header><section class="overview-hero" id="overview-content"><div><p class="overview-kicker">Deterministic fighting-game systems</p><h1>Hexframe</h1><p>Hexframe is a browser-based fighting-game training lab built around fixed-step combat, authored frame data, and replayable state.</p><div class="overview-actions"><a class="overview-primary" href="/play/" autofocus>Open training →</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">View source ↗</a></div></div><div class="overview-frame" role="img" aria-label="An eighteen-frame move timeline with startup, active, and recovery frames"><header><span>standing_light</span><strong>18 frames</strong></header><div>${Array.from({ length: 18 }, (_, index) => `<i class="${index < 4 ? "startup" : index < 6 ? "active" : "recovery"}"></i>`).join("")}</div><footer><span>Startup 4f</span><span>Active 2f</span><span>Recovery 12f</span></footer></div></section><section class="overview-proof" aria-label="Project capabilities"><span>Deterministic simulation</span><span>Rollback-ready state</span><span>Training tools</span><span>Accessible controls</span></section><section class="overview-sections"><article><span>01</span><h2>Simulation</h2><p>Combat runs at a fixed 60 Hz using integer state and explicit snapshots.</p></article><article><span>02</span><h2>Training</h2><p>Frame stepping, save states, collision views, and replay tools use the same combat state.</p></article><article><span>03</span><h2>Controls</h2><p>Keyboard and gamepad input share one action model with visible focus and reduced-motion settings.</p></article></section><footer class="overview-footer"><span>Wizard Gang · Hexframe</span><a href="https://wizardgang.ai/projects/hexframe/">Case study ↗</a></footer></main>`;
}

function campaignMarkup(state: FrontState): string {
  const progress = state.save.campaign.stages["black-belfry"];
  const checkpoint = progress?.checkpointId ? "Belfry Crossing" : "Belfry Approach";
  return screenHeader("CAMPAIGN", "Black Belfry", "/play/") + `<section class="campaign-screen"><div class="belfry-key-art" aria-label="Black Belfry"><i></i><i></i><i></i><span>THE BELL REMEMBERS EVERY DEBT</span></div><article><p>CHECKPOINT</p><h2>${checkpoint}</h2>${partyMarkup(state)}<button class="route-primary" type="button" data-launch="campaign">Continue →</button></article></section>`;
}

function setupMarkup(state: FrontState, mode: "fight"): string {
  return screenHeader("FIGHT", "Party and encounter", "/play/") + `<section class="fight-setup"><div><h2>Party</h2>${partyMarkup(state)}</div><div class="setup-row"><span>ENCOUNTER</span><strong>Bell Warden</strong></div><div class="setup-row"><span>STAGE</span><strong>Warden Arena</strong></div><button class="route-primary launch-fight" type="button" data-launch="${mode}">Fight</button></section>`;
}

function trainingMarkup(state: FrontState): string {
  const active = state.save.loadouts.byId[state.party[0].loadoutId];
  return screenHeader("TRAINING", "Learn the system", "/") + `<section class="training-entry"><div class="training-figure" aria-hidden="true"><i></i><i></i><i></i></div><article><p>LOADOUT</p><button type="button" data-action="pick-slot" data-slot="0"><strong>YOU</strong><span>${escapeHtml(active.name)}</span><em>Change</em></button>${pickerMarkup(state)}<div class="training-entry-actions"><button type="button" data-launch="training">Free practice</button><button class="route-primary" type="button" data-launch="training" data-tutorial="true" autofocus>Start tutorial</button></div></article></section>`;
}

function partyMarkup(state: FrontState): string {
  const rows = state.party.map((slot, index) => {
    const loadout = state.save.loadouts.byId[slot.loadoutId];
    return `<article class="party-slot"><button type="button" data-action="pick-slot" data-slot="${index}"><span>SLOT ${index + 1}</span><strong>${index === 0 ? "YOU" : "AI"}</strong><em>${escapeHtml(loadout.name)}</em><small>Change</small></button>${index > 0 ? `<label>DIFFICULTY<select data-ai-difficulty="${index}"><option value="apprentice" ${slot.aiProfile?.difficulty === "apprentice" ? "selected" : ""}>Apprentice</option><option value="standard" ${slot.aiProfile?.difficulty === "standard" ? "selected" : ""}>Standard</option><option value="master" ${slot.aiProfile?.difficulty === "master" ? "selected" : ""}>Master</option></select></label><button class="slot-remove" type="button" data-action="remove-ai" data-slot="${index}" aria-label="Remove AI slot">×</button>` : ""}</article>`;
  }).join("");
  const add = state.party.length < 3 ? `<button class="party-slot party-add" type="button" data-action="add-ai"><span>SLOT ${state.party.length + 1}</span><strong>+ AI</strong><em>Empty</em></button>` : "";
  return `<div class="party-list">${rows}${add}</div>${pickerMarkup(state)}`;
}

function pickerMarkup(state: FrontState): string {
  if (state.pickerFor === null) return "";
  const label = state.pickerFor === 0 ? "SELECT LOADOUT" : "ADD AI";
  return `<aside class="compact-picker" aria-label="${label}"><header><strong>${label}</strong><button type="button" data-action="cancel-picker" aria-label="Close">×</button></header>${state.save.loadouts.order.map((id) => `<button type="button" data-pick-loadout="${id}" data-slot="${state.pickerFor}">${escapeHtml(state.save.loadouts.byId[id].name)}</button>`).join("")}</aside>`;
}

function loadoutListMarkup(state: FrontState): string {
  return screenHeader("LOADOUTS", "Choose a loadout", "/play/") + `<section class="loadout-list">${state.save.loadouts.order.map((id, index) => {
    const loadout = state.save.loadouts.byId[id];
    const assigned = loadout.loadout.filter(Boolean).length;
    return `<a href="/loadouts/${id}/"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(loadout.name)}</strong><em>${assigned} / 16 TECHNIQUES</em><small>Edit →</small></a>`;
  }).join("")}<a class="forge-crosslink" href="/forge/"><span>FORGE</span><strong>Armor</strong><em>Craft and inspect equipment.</em><small>Open forge →</small></a></section>`;
}

function loadoutEditorMarkup(state: FrontState, id: string): string {
  const loadout = state.save.loadouts.byId[id];
  const options = catalog.moves.map((move) => `<option value="${move.id}">${String(move.id).padStart(2, "0")} · ${escapeHtml(moveName(move))} · ${moveRole(move).toUpperCase()}</option>`).join("");
  return screenHeader("LOADOUTS", "Edit loadout", "/loadouts/") + `<section class="loadout-editor" data-loadout-id="${id}"><header><label>LOADOUT NAME<input data-loadout-name maxlength="32" value="${escapeHtml(loadout.name)}"></label><a href="/forge/">Open Forge →</a></header><div class="technique-grid">${loadout.loadout.map((moveId, index) => `<label><span>${String(index + 1).padStart(2, "0")}</span><small>${["STARTER", "LINK", "CASHOUT", "UTILITY"][Math.trunc(index / 4)]}</small><select data-loadout-move="${index}">${options.replace(`value="${moveId}"`, `value="${moveId}" selected`)}</select></label>`).join("")}</div><footer><output data-save-status>All changes saved</output><button class="route-primary" type="button" data-action="save-loadout">Save loadout</button></footer></section>`;
}

function forgeMarkup(state: FrontState): string {
  const recipes = ARMOR_CATALOG.map((item) => {
    const owned = state.save.inventory.armor.includes(item.id);
    const unlocked = state.save.unlocks.recipes.includes(item.id);
    const ready = unlocked && canCraftArmor(item, state.save.inventory);
    const costs = item.recipe.map((cost) => `${materialById(cost.materialId)?.name ?? cost.materialId} ${state.save.inventory.materials[cost.materialId] ?? 0}/${cost.quantity}`).join(" · ");
    return `<article><span class="forge-icon">${item.icon}</span><div><small>${item.grade} · ${item.slot}</small><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.description)}</p><em>${costs}</em></div><button type="button" data-craft-armor="${item.id}" ${owned || !ready ? "disabled" : ""}>${owned ? "Owned" : !unlocked ? "Locked" : ready ? "Craft" : "Missing materials"}</button></article>`;
  }).join("");
  return screenHeader("FORGE", "Choose a piece", "/loadouts/") + `<section class="forge-list">${recipes}</section>`;
}

function codexIndexMarkup(): string {
  const entries = [["moves", "Moves", "Frame data and authored routes"], ["status", "Status", "Prime, link, and cash out"], ["enemies/bell-warden", "Enemies", "The Bell Warden"], ["stages/black-belfry", "Stages", "Black Belfry"]];
  return screenHeader("CODEX", "Choose a record", "/play/") + `<nav class="codex-index">${entries.map(([path, title, copy]) => `<a href="/codex/${path}/"><strong>${title}</strong><span>${copy}</span><em>Open →</em></a>`).join("")}</nav>`;
}

function moveIndexMarkup(): string {
  return screenHeader("CODEX / MOVES", "Choose a technique", "/codex/") + `<nav class="record-index">${catalog.moves.map((move) => `<a href="/codex/moves/${move.id}/"><span>${String(move.id).padStart(2, "0")}</span><strong>${escapeHtml(moveName(move))}</strong><em>${moveRole(move)} · ${(moveFamilies(move)[0] ?? "physical")}</em></a>`).join("")}</nav>`;
}

function moveDetailMarkup(id: number): string {
  const move = catalog.moves.find((candidate) => candidate.id === id);
  if (!move) return notFoundMarkup();
  const hit = move.hitboxes[0];
  return screenHeader("CODEX / MOVES", moveName(move), "/codex/moves/") + `<article class="record-detail"><div class="record-sigil"><i></i><i></i><i></i></div><section><p>${moveRole(move).toUpperCase()} · ${(moveFamilies(move).join(" · ") || "PHYSICAL").toUpperCase()}</p><h1>${escapeHtml(moveName(move))}</h1><blockquote>${escapeHtml(move.description)}</blockquote><dl><div><dt>Startup</dt><dd>${move.startup}f</dd></div><div><dt>Active</dt><dd>${move.active}f</dd></div><div><dt>Recovery</dt><dd>${move.recovery}f</dd></div><div><dt>Damage</dt><dd>${hit?.damage ?? 0}</dd></div><div><dt>Stamina</dt><dd>${move.staminaCost}</dd></div><div><dt>Cancel targets</dt><dd>${new Set(move.cancelWindows.flatMap((window) => window.into)).size}</dd></div></dl><a href="/loadouts/">Edit loadout →</a></section></article>`;
}

const STATUS_COPY: Record<string, readonly [string, string]> = {
  burn: ["Burn", "Apply burning pressure, then consume the route with a fire cashout."],
  poison: ["Poison", "Stack persistent damage and preserve advantage with chaos links."],
  freeze: ["Freeze", "Build chill until the target locks, then choose a precise payoff."],
  shock: ["Shock", "Prime stored voltage and trigger it with the next decisive hit."],
  bleed: ["Bleed", "Movement hurts a bleeding target; execute tags consume the wound."],
};

function statusIndexMarkup(): string {
  return screenHeader("CODEX / STATUS", "Choose a status", "/codex/") + `<nav class="codex-index">${Object.entries(STATUS_COPY).map(([id, [name, copy]]) => `<a href="/codex/status/${id}/"><strong>${name}</strong><span>${copy}</span><em>Open →</em></a>`).join("")}</nav>`;
}

function statusDetailMarkup(id: string): string {
  const record = STATUS_COPY[id];
  if (!record) return notFoundMarkup();
  const moves = catalog.moves.filter((move) => move.tags.includes(id));
  return screenHeader("CODEX / STATUS", record[0], "/codex/status/") + `<article class="record-copy"><p>${escapeHtml(record[1])}</p><h2>Authored techniques</h2><ul>${moves.map((move) => `<li><a href="/codex/moves/${move.id}/">${escapeHtml(moveName(move))}</a><span>${moveRole(move)}</span></li>`).join("")}</ul></article>`;
}

function enemyMarkup(): string {
  return screenHeader("CODEX / ENEMIES", "Bell Warden", "/codex/") + `<article class="record-detail enemy-detail"><div class="warden-sigil" aria-hidden="true">BW</div><section><p>BOSS · CONSTRUCT</p><h1>The Bell Warden</h1><blockquote>Read the telegraph, defend the chain sequence, then punish the recovery.</blockquote><dl><div><dt>Stage</dt><dd>Black Belfry</dd></div><div><dt>Reward</dt><dd>Grave Toll</dd></div><div><dt>Phase II</dt><dd>58% vitality</dd></div><div><dt>Attacks</dt><dd>4 authored clips</dd></div></dl><a href="/fight/">Fight →</a></section></article>`;
}

function stageMarkup(): string {
  return screenHeader("CODEX / STAGES", "Black Belfry", "/codex/") + `<article class="record-detail"><div class="belfry-key-art"><i></i><i></i><i></i></div><section><p>STAGE 01 · DISCOVERED</p><h1>Black Belfry</h1><blockquote>A ruined vertical crossing ending at the Warden's sealed arena.</blockquote><dl><div><dt>Campaign</dt><dd>Scrolling · hazards</dd></div><div><dt>Fight</dt><dd>Static arena</dd></div><div><dt>Checkpoint</dt><dd>Automatic</dd></div><div><dt>Interactions</dt><dd>Chest · gate · reward</dd></div></dl><a href="/campaign/">Continue →</a></section></article>`;
}

function settingsMarkup(state: FrontState): string {
  const p = state.preferences;
  return screenHeader("SETTINGS", "Global settings", "/play/") + `<section class="settings-route"><nav><a href="#audio">Audio</a><a href="#visual">Visual</a><a href="#accessibility">Accessibility</a><a href="#controls">Controls</a><a href="#profile">Profile</a><a href="#about">About</a></nav><div><section id="audio"><h2>Audio</h2>${range("Master volume", "audio", "master", p.audio.master)}${range("Combat effects", "audio", "sfx", p.audio.sfx)}${toggle("Audio captions", "audio", "captions", p.audio.captions)}</section><section id="visual"><h2>Visual</h2>${range("Camera shake", "video", "cameraShake", p.video.cameraShake)}${range("HUD opacity", "video", "hudOpacity", p.video.hudOpacity)}${toggle("Damage numbers", "video", "damageNumbers", p.video.damageNumbers)}</section><section id="accessibility"><h2>Accessibility</h2>${toggle("Strong focus", "accessibility", "strongFocus", p.accessibility.strongFocus)}${toggle("Dyslexia-friendly type", "accessibility", "dyslexiaFont", p.accessibility.dyslexiaFont)}</section><section id="controls"><h2>Controls</h2>${range("Stick deadzone", "controls", "stickDeadzone", p.controls.stickDeadzone)}${range("Vibration", "controls", "vibration", p.controls.vibration)}</section><section id="profile"><h2>Player</h2><dl><div><dt>Save revision</dt><dd>${state.save.revision}</dd></div><div><dt>Loadouts</dt><dd>${state.save.loadouts.order.length}</dd></div><div><dt>Stages</dt><dd>${state.save.unlocks.stages.length}</dd></div></dl><button type="button" data-action="reset-campaign">Reset campaign</button></section><section id="about"><h2>About</h2><p>Hexframe · Wizard Gang</p><p>Deterministic combat, authored SVG presentation, and player-built technique routes.</p></section><button type="button" data-action="reset-settings">Reset settings</button></div></section>`;
}

function screenHeader(eyebrow: string, title: string, back: string): string {
  return `<header class="route-heading"><a href="${back}">← Back</a><p>${eyebrow}</p><h1>${escapeHtml(title)}</h1></header>`;
}

function notFoundMarkup(): string {
  return screenHeader("HEXFRAME", "Route not found", "/play/") + `<p class="route-empty">That record does not exist.</p>`;
}

function range(label: string, section: keyof LabPreferences, key: string, value: number): string {
  return `<label class="route-setting"><strong>${label}</strong><input type="range" min="0" max="1" step=".05" value="${value}" data-pref-section="${section}" data-pref-key="${key}"></label>`;
}

function toggle(label: string, section: keyof LabPreferences, key: string, value: boolean): string {
  return `<label class="route-setting"><strong>${label}</strong><input type="checkbox" ${value ? "checked" : ""} data-pref-section="${section}" data-pref-key="${key}"></label>`;
}

function normalizePath(pathname: string): string {
  return pathname === "/" ? "/" : `${pathname.replace(/\/+$/, "")}/`;
}

function launch(state: FrontState, mode: GameMode, tutorial = false): void {
  const session = defaultSession(mode, state.party[0].loadoutId);
  session.party = mode === "training" ? [humanSlot(state.party[0].loadoutId)] : state.party.map((slot, index) => index === 0 ? humanSlot(slot.loadoutId) : aiSlot(slot.loadoutId, index + 1, slot.aiProfile?.difficulty));
  session.options.tutorial = tutorial;
  state.save.loadouts.activeId = state.party[0].loadoutId;
  cachePlayerSave(state.save);
  void persistPlayerSave(state.save).finally(() => { window.location.href = sessionUrl(session); });
}

async function saveLoadout(mount: HTMLElement, state: FrontState): Promise<void> {
  const editor = mount.querySelector<HTMLElement>("[data-loadout-id]");
  const id = editor?.dataset.loadoutId;
  if (!editor || !id || !state.save.loadouts.byId[id]) return;
  const name = editor.querySelector<HTMLInputElement>("[data-loadout-name]")?.value.trim();
  const moves = Array.from(editor.querySelectorAll("[data-loadout-move]"), (select) => Number((select as unknown as HTMLSelectElement).value));
  if (moves.length !== 16) return;
  state.save.loadouts.byId[id].name = (name || state.save.loadouts.byId[id].name).slice(0, 32);
  state.save.loadouts.byId[id].loadout = moves;
  state.save.loadouts.activeId = id;
  cachePlayerSave(state.save);
  const output = editor.querySelector<HTMLOutputElement>("[data-save-status]");
  if (output) output.textContent = "Saving…";
  await persistPlayerSave(state.save);
  if (output) output.textContent = "Saved";
}

async function craftArmor(state: FrontState, armorId: string, render: () => void): Promise<void> {
  await craftPlayerArmor(state.save, armorId);
  render();
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
