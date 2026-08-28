import type { CharacterDef } from "../combat/types";
import { ACTION_SLOT_LABELS } from "../input/action-layout";
import { GEAR_CATALOG, GEAR_SLOTS, gearById } from "../content/gear";
import { STATUS_RULES } from "../content/status-rules";
import type { BuildState } from "./build-state";
import type { LabPreferences } from "./preferences";

interface LabViewOptions {
  character: CharacterDef;
  buildState: BuildState;
  preferences: LabPreferences;
  dummyOptions: readonly [number, string][];
}

export function buildLabView({ character, buildState, preferences, dummyOptions }: LabViewOptions): string {
  const preset = buildState.presets[buildState.activePreset];
  const moveOptions = character.moves.map((move) => option(
    move.id,
    `${String(move.id).padStart(2, "0")} · ${nameOf(move.key)} · ${move.tags.join(" / ")}`,
  )).join("");
  const assignmentRows = ACTION_SLOT_LABELS.map((label) => {
    const moveId = preset.loadout[label.slot];
    const move = character.moves.find((candidate) => candidate.id === moveId);
    return `<label class="loadout-row" data-gamepad-nav tabindex="0" data-action-bank="${Math.trunc(label.slot / 4)}">
      <span class="slot-number">${String(label.slot + 1).padStart(2, "0")}</span>
      <span class="assignment-glyph"><kbd class="keyboard-key">${label.keyboard}</kbd><kbd class="pad-key">${label.gamepad}</kbd></span>
      <select data-loadout-slot="${label.slot}" aria-label="Move for action ${label.slot + 1}">${selectedOptions(moveOptions, moveId)}</select>
      <span class="assignment-tags" data-assignment-tags="${label.slot}">${move?.tags.slice(0, 3).join(" · ") ?? "unassigned"}</span>
    </label>`;
  }).join("");
  const equipment = GEAR_SLOTS.map((slot) => {
    const item = gearById(preset.equipment[slot]);
    return `<button type="button" class="gear-slot rarity-${item?.rarity ?? "rare"}" data-gamepad-nav data-gear-slot="${slot}" aria-label="${slot}: ${item?.name ?? "empty"}">
      <span class="gear-icon" aria-hidden="true">${item?.icon ?? "+"}</span><span><small>${slot}</small><strong data-equipped-name="${slot}">${item?.name ?? "Empty"}</strong></span>
    </button>`;
  }).join("");
  const inventory = GEAR_CATALOG.map((item) => `<button type="button" class="inventory-item rarity-${item.rarity}" data-gamepad-nav data-gear-item="${item.id}" aria-label="Equip ${item.name}, ${item.rarity} ${item.slot}">
    <span class="gear-icon" aria-hidden="true">${item.icon}</span><span><strong>${item.name}</strong><small>${item.slot} · ${item.tags.join(" / ")}</small></span>
  </button>`).join("");
  const inputButtons = ACTION_SLOT_LABELS.map((label) => `<button type="button" class="mapped-input" data-gamepad-nav data-select-action="${label.slot}" aria-label="Action ${label.slot + 1}: ${label.keyboard}, ${label.gamepad}">
    <span>${String(label.slot + 1).padStart(2, "0")}</span><kbd class="keyboard-key">${label.keyboard}</kbd><kbd class="pad-key">${label.gamepad}</kbd>
  </button>`).join("");
  const moveLibrary = character.moves.map((move) => `<article class="move-card">
    <span>${String(move.id).padStart(2, "0")}</span><div><h3>${nameOf(move.key)}</h3><p>${move.description}</p><ul>${move.tags.map((tag) => `<li>${tag}</li>`).join("")}</ul></div>
  </article>`).join("");
  const statusCards = STATUS_RULES.map((rule) => {
    const moves = character.moves.filter((move) => move.tags.includes(rule.tag)).map((move) => nameOf(move.key));
    return `<article class="status-rule status-${rule.tag}">
      <div class="status-rule-icon" aria-hidden="true">${rule.glyph}</div><div><p>${rule.tag.toUpperCase()} · MAX ${rule.maxStacks} STACKS</p><h3>${rule.name}</h3><dl><div><dt>Primer</dt><dd>${rule.primer}</dd></div><div><dt>Payoff</dt><dd>${rule.payoff}</dd></div></dl><ul aria-label="Moves with ${rule.name}">${moves.map((move) => `<li>${move}</li>`).join("")}</ul></div>
    </article>`;
  }).join("");
  const initialGear = gearById(preset.equipment.focus) ?? GEAR_CATALOG[0];

  return `<a class="skip-link" href="#game-content">Skip to game</a>
  <main class="lab-shell" id="game-content">
    <header class="lab-header">
      <div class="brand"><p class="eyebrow">HEXFRAME / PROTOTYPE</p><h1>Build your route.</h1></div>
      <div class="header-actions"><span class="controller-state" id="controller-state">Keyboard ready</span><button class="primary" type="button" data-action="pause">Pause</button><button type="button" data-action="menu" aria-haspopup="dialog">Armory & settings</button></div>
    </header>
    <section class="playfield-card" aria-label="Combat arena">
      <div class="hud" aria-label="Fighter health">
        <div class="hud-player"><span>YOU</span><div class="health-track"><i id="health-p1"></i></div><strong id="health-text-p1">${character.health}</strong></div>
        <div class="frame-readout"><span id="play-state">LIVE</span><strong id="frame-readout">0</strong></div>
        <div class="hud-player hud-player-right"><strong id="health-text-p2">1000</strong><div class="health-track"><i id="health-p2"></i></div><span>DUMMY</span></div>
      </div>
      <div class="status-lane status-lane-you" id="debuff-p1" aria-label="Your active debuffs"></div><div class="status-lane status-lane-dummy" id="debuff-p2" aria-label="Dummy active debuffs"></div>
      <div id="stage" class="stage"></div>
      <div class="current-route"><span>ACTIVE</span><strong id="active-move">Ready</strong><em id="active-tags">Choose any 16 of 24 moves</em></div>
      <div class="audio-caption" id="audio-caption" role="status" aria-live="polite" hidden></div><div class="sr-only" id="combat-announcer" role="status" aria-live="polite"></div>
    </section>
    <footer class="control-legend"><span><b>MOVE</b> WASD / left stick</span><span><b>ACTIONS</b> arrows / Y X B A</span><span><b>BANK 2</b> Shift / LT</span><span><b>BANK 3</b> Space / RT</span><span><b>MENU</b> Esc / View</span><span><b>PAUSE</b> P / Start</span></footer>

    <div class="menu-scrim" id="menu-scrim" hidden>
      <aside class="lab-menu" id="lab-menu" role="dialog" aria-modal="true" aria-labelledby="menu-title" tabindex="-1">
        <header class="menu-header"><div><p class="eyebrow">SHADOW WIZARD / SYSTEMS</p><h2 id="menu-title">Armory & settings</h2></div><button type="button" data-action="close-menu" data-gamepad-nav aria-label="Close armory and return to game">Close</button></header>
        <nav class="menu-tabs" role="tablist" aria-label="Armory sections">
          ${menuTab("loadout", "Loadout", true)}${menuTab("status", "Status codex")}${menuTab("settings", "Settings")}${menuTab("training", "Training")}${menuTab("debug", "Debug")}
        </nav>

        <section class="menu-page active armory-page" id="page-loadout" role="tabpanel" aria-labelledby="tab-loadout" data-menu-page="loadout">
          <div class="armory-titlebar"><div><p class="eyebrow">SHADOW WIZARD / <span id="build-number">BUILD ${String(buildState.activePreset + 1).padStart(2, "0")}</span></p><h2>Arcana loadout</h2><p>Sixteen actions, equipped relics, and status routes in one controller-first sheet.</p></div><div class="preset-switcher" aria-label="Loadout presets">${buildState.presets.map((build, index) => `<button class="${index === buildState.activePreset ? "active" : ""}" type="button" data-gamepad-nav data-preset="${index}" aria-label="Loadout ${index + 1}: ${build.name}" aria-pressed="${index === buildState.activePreset}">${String(index + 1).padStart(2, "0")}</button>`).join("")}</div></div>
          <div class="armory-grid">
            <aside class="character-sheet" aria-labelledby="character-sheet-title"><div class="character-crest"><span aria-hidden="true">SW</span><div><small>LEVEL 1 · OCCULTIST</small><h3 id="character-sheet-title">${preset.name}</h3><p>Route architect</p></div></div><div class="stat-runes" aria-label="Build statistics"><div><small>VIT</small><strong id="stat-vitality">${Math.trunc(character.health / 100)}</strong></div><div><small>POW</small><strong>12</strong></div><div><small>ARC</small><strong>16</strong></div><div><small>CTL</small><strong>14</strong></div></div><h4>Equipped gear</h4><div class="equipment-grid">${equipment}</div></aside>
            <section class="input-sheet" aria-labelledby="input-sheet-title"><div class="panel-heading"><div><small>INPUT SCHEMATIC</small><h3 id="input-sheet-title">Keyboard + gamepad</h3></div><span>16 MAPPED</span></div>${deviceOutlines()}<div class="mapped-inputs">${inputButtons}</div></section>
            <aside class="assignment-sheet" aria-labelledby="assignment-title"><div class="panel-heading"><div><small>ACTION DECK</small><h3 id="assignment-title">Assigned moves</h3></div><button type="button" data-action="default-loadout" data-gamepad-nav>Reset</button></div><div class="loadout-grid">${assignmentRows}</div></aside>
            <section class="inventory-sheet" aria-labelledby="inventory-title"><div class="panel-heading"><div><small>VAULT · 12 / 24</small><h3 id="inventory-title">Gear inventory</h3></div><span>Choose any item to equip it in its matching slot</span></div><div class="inventory-grid">${inventory}</div><div class="gear-detail" id="gear-detail" aria-live="polite"><span class="gear-icon" aria-hidden="true">${initialGear.icon}</span><div><small>${initialGear.rarity} ${initialGear.slot}</small><h4>${initialGear.name}</h4><p>${initialGear.description}</p></div><ul>${initialGear.tags.map((tag) => `<li>${tag}</li>`).join("")}</ul></div></section>
          </div><details class="move-library-drawer"><summary>Browse all 24 moves</summary><div class="move-library">${moveLibrary}</div></details>
        </section>

        <section class="menu-page codex-page" id="page-status" role="tabpanel" aria-labelledby="tab-status" data-menu-page="status" hidden><div class="page-intro"><div><p class="eyebrow">COMBO LOGIC</p><h2>Prime. Link. Cash out.</h2><p>Tags now change combat. Build a route that applies a condition, compounds it, then converts the setup into control or damage.</p></div></div><div class="status-rules">${statusCards}</div><div class="route-examples"><h3>Starter routes</h3><div><article><b>IGNITE LOOP</b><span>Ember Palm → Ashen Sweep → Phoenix Drive</span></article><article><b>VENOM ENGINE</b><span>Venom Fang → Toxic Bloom → Plague Touch</span></article><article><b>VOLTAGE CASHOUT</b><span>Storm Knuckle → Static Rush → Bastion Break</span></article><article><b>BLEED EXECUTE</b><span>Crimson Arc → Blood Moon → Reaper Kick</span></article></div></div></section>

        <section class="menu-page settings-page" id="page-settings" role="tabpanel" aria-labelledby="tab-settings" data-menu-page="settings" hidden>
          <div class="settings-shell"><nav class="settings-nav" role="tablist" aria-label="Settings categories">${settingsTab("audio", "Audio", true)}${settingsTab("video", "Visual")}${settingsTab("accessibility", "Accessibility")}${settingsTab("controls", "Controls")}</nav><div class="settings-content">${settingsPanels(preferences)}</div></div>
        </section>

        <section class="menu-page" id="page-training" role="tabpanel" aria-labelledby="tab-training" data-menu-page="training" hidden><div class="page-intro"><div><p class="eyebrow">FRAME LAB</p><h2>Training controls</h2><p>Timeline and dummy tools stay available without crowding the play HUD.</p></div></div><div class="settings-grid"><label data-gamepad-nav tabindex="0"><span>Simulation speed</span><select data-control="speed"><option value="25">25%</option><option value="50">50%</option><option value="100" selected>100%</option><option value="200">200%</option></select></label><label data-gamepad-nav tabindex="0"><span>Training dummy</span><select data-control="dummy">${dummyOptions.map(([value, label]) => option(value, label)).join("")}</select></label></div><div class="timeline-tools"><button type="button" data-action="back" data-gamepad-nav>Step −1</button><button type="button" data-action="forward" data-gamepad-nav>Step +1</button><button type="button" data-action="reset" data-gamepad-nav>Reset match</button><span id="timeline-status">Frame 0</span></div><div class="save-states"><h3>Save states</h3>${[1, 2, 3].map((slot) => `<div><span>Slot ${slot}</span><button type="button" data-save="${slot}" data-gamepad-nav>Save</button><button type="button" data-load="${slot}" data-gamepad-nav disabled>Load</button></div>`).join("")}</div></section>

        <section class="menu-page" id="page-debug" role="tabpanel" aria-labelledby="tab-debug" data-menu-page="debug" hidden><p class="debug-warning">These tools expose engine internals. They do not affect combat state.</p><div class="toggle-grid">${[["hitboxes", "Hitboxes"], ["hurtboxes", "Hurtboxes"], ["pushboxes", "Pushboxes"], ["origins", "Origins"], ["skeleton", "Skeleton"], ["boneNames", "Bone names"], ["velocity", "Velocity"]].map(([key, label]) => toggleMarkup(label, "", false, `data-debug="${key}"`)).join("")}</div><div class="debug-card"><div class="card-heading"><span>Authoritative state</span><em>LIVE</em></div><div id="debug-panel"></div></div></section>
        <footer class="menu-footer"><span>D-pad navigate · A select · B close · LB/RB tabs</span><form method="post" action="/logout"><button class="ghost" type="submit" data-gamepad-nav>Sign out <span id="session-label"></span></button></form></footer>
      </aside>
    </div>
  </main>`;
}

function menuTab(id: string, label: string, active = false): string {
  return `<button class="${active ? "active" : ""}" type="button" role="tab" id="tab-${id}" aria-selected="${active}" aria-controls="page-${id}" tabindex="${active ? 0 : -1}" data-menu-tab="${id}" data-gamepad-nav>${label}</button>`;
}

function settingsTab(id: string, label: string, active = false): string {
  return `<button class="${active ? "active" : ""}" type="button" role="tab" id="settings-tab-${id}" aria-selected="${active}" aria-controls="settings-panel-${id}" tabindex="${active ? 0 : -1}" data-settings-tab="${id}" data-gamepad-nav>${label}</button>`;
}

function deviceOutlines(): string {
  return `<div class="device-outlines" aria-hidden="true"><div class="keyboard-outline"><div class="wasd-keys"><i>W</i><i>A</i><i>S</i><i>D</i></div><div class="arrow-keys"><i>↑</i><i>←</i><i>↓</i><i>→</i></div><b>SHIFT</b><b>SPACE</b></div><div class="gamepad-outline"><i class="trigger lt">LT</i><i class="trigger rt">RT</i><span class="pad-dpad">＋</span><span class="pad-stick left-stick"></span><span class="pad-stick right-stick"></span><div class="face-cluster"><i>Y</i><i>X</i><i>B</i><i>A</i></div></div></div>`;
}

function settingsPanels(preferences: LabPreferences): string {
  const a = preferences.audio;
  const v = preferences.video;
  const x = preferences.accessibility;
  const c = preferences.controls;
  return `${panel("audio", true, `<div class="settings-heading"><p>AUDIO MIX</p><h2>Hear every opening.</h2><span>Music stays opt-in. Every meaningful cue has an optional visual caption.</span></div><div class="settings-fields">${rangeMarkup("Master volume", "Overall output level.", "audio", "master", a.master, 0, 1, .05)}${rangeMarkup("Music", "Procedural occult ambient score.", "audio", "music", a.music, 0, 1, .05)}${rangeMarkup("Combat effects", "Hits, blocks, and status cues.", "audio", "sfx", a.sfx, 0, 1, .05)}${rangeMarkup("Interface", "Focus movement and confirmations.", "audio", "ui", a.ui, 0, 1, .05)}${rangeMarkup("Ambience", "Controls the music bed intensity.", "audio", "ambience", a.ambience, 0, 1, .05)}${toggleMarkup("Audio captions", "Visual text for combat and menu sounds.", a.captions, pref("audio", "captions"))}${toggleMarkup("Mono audio", "Keep important information centered.", a.mono, pref("audio", "mono"))}${toggleMarkup("Mute when unfocused", "Suspend all audio when this tab is hidden.", a.muteUnfocused, pref("audio", "muteUnfocused"))}${selectMarkup("Dynamic range", "Difference between quiet and loud cues.", "audio", "dynamicRange", a.dynamicRange, [["night", "Night"], ["balanced", "Balanced"], ["wide", "Wide"]])}</div>`)}
  ${panel("video", false, `<div class="settings-heading"><p>VISUAL PRESENTATION</p><h2>Clarity before spectacle.</h2><span>Every effect can be reduced without losing combat information.</span></div><div class="settings-fields">${selectMarkup("Quality", "Rendering and effect density preset.", "video", "quality", v.quality, [["performance", "Performance"], ["balanced", "Balanced"], ["cinematic", "Cinematic"]])}${selectMarkup("Particles", "Contact burst density.", "video", "particles", v.particles, [["off", "Off"], ["reduced", "Reduced"], ["full", "Full"]])}${rangeMarkup("Camera shake", "Screen displacement on heavy impact.", "video", "cameraShake", v.cameraShake, 0, 1, .05)}${selectMarkup("Combat flashes", "Brightness changes during hitstop.", "video", "combatFlashes", v.combatFlashes, [["off", "Off"], ["reduced", "Reduced"], ["full", "Full"]])}${toggleMarkup("Damage numbers", "Show exact damage at the point of contact.", v.damageNumbers, pref("video", "damageNumbers"))}${rangeMarkup("HUD opacity", "Transparency of health and status UI.", "video", "hudOpacity", v.hudOpacity, .45, 1, .05)}</div>`)}
  ${panel("accessibility", false, `<div class="settings-heading"><p>ACCESSIBILITY</p><h2>Built to adapt.</h2><span>System preferences are honored until you choose an explicit override.</span></div><div class="settings-fields">${selectMarkup("Theme", "Match the system or choose a fixed surface.", "accessibility", "theme", x.theme, [["system", "System"], ["dark", "Dark"], ["light", "Light"]])}${selectMarkup("Contrast", "Strengthen text, focus, and control boundaries.", "accessibility", "contrast", x.contrast, [["normal", "Normal"], ["high", "High"]])}${selectMarkup("Motion", "Reduce non-essential animation and shake.", "accessibility", "motion", x.motion, [["system", "System"], ["full", "Full"], ["reduced", "Reduced"]])}${rangeMarkup("Text size", "Scale interface text without zoom.", "accessibility", "textScale", x.textScale, .9, 1.6, .1)}${selectMarkup("Color vision", "Palette assistance; status text and patterns remain present.", "accessibility", "colorVision", x.colorVision, [["default", "Default"], ["deuteranopia", "Deuteranopia"], ["protanopia", "Protanopia"], ["tritanopia", "Tritanopia"], ["monochrome", "Monochrome"]])}${toggleMarkup("Status patterns", "Add distinct patterns so color is never the only cue.", x.statusPatterns, pref("accessibility", "statusPatterns"))}${toggleMarkup("Dyslexia-friendly type", "Use a wider, highly differentiated system typeface.", x.dyslexiaFont, pref("accessibility", "dyslexiaFont"))}${toggleMarkup("Strong focus indicator", "Use a persistent high-contrast focus ring.", x.strongFocus, pref("accessibility", "strongFocus"))}${toggleMarkup("Screen reader combat log", "Announce hits and status changes through a polite live region.", x.screenReaderCombat, pref("accessibility", "screenReaderCombat"))}<button type="button" data-action="reset-preferences" data-gamepad-nav>Reset all settings</button></div>`)}
  ${panel("controls", false, `<div class="settings-heading"><p>INPUT</p><h2>One map, every device.</h2><span>The action diamond remains spatially identical across keyboard and standard gamepads.</span></div><div class="settings-fields">${selectMarkup("Input glyphs", "Choose the labels shown in prompts.", "controls", "glyphs", c.glyphs, [["auto", "Automatic"], ["keyboard", "Keyboard"], ["xbox", "Gamepad"]])}${rangeMarkup("Stick deadzone", "How far the stick moves before input begins.", "controls", "stickDeadzone", c.stickDeadzone, .15, .9, .05)}${rangeMarkup("Vibration", "Strength of supported controller feedback.", "controls", "vibration", c.vibration, 0, 1, .05)}${toggleMarkup("Wrap menu navigation", "Move from the last menu item back to the first.", c.menuWrap, pref("controls", "menuWrap"))}${toggleMarkup("Hold to confirm destructive actions", "Adds protection for future sell and dismantle actions.", c.holdToConfirm, pref("controls", "holdToConfirm"))}<div class="control-contract"><h3>Fixed combat map</h3><p>WASD / left stick moves. Arrows / Y X B A act. Shift / LT and Space / RT select the other three action banks.</p></div></div>`)}`;
}

function panel(id: string, active: boolean, body: string): string {
  return `<section id="settings-panel-${id}" role="tabpanel" aria-labelledby="settings-tab-${id}" data-settings-panel="${id}" ${active ? "" : "hidden"}>${body}</section>`;
}

function rangeMarkup(label: string, hint: string, section: string, key: string, value: number, min: number, max: number, step: number): string {
  const percent = Math.round(value * 100);
  return `<label class="setting-row setting-range" data-gamepad-nav tabindex="0"><span><strong>${label}</strong><small>${hint}</small></span><span class="range-control"><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" ${pref(section, key)} data-pref-number aria-label="${label}" aria-valuetext="${percent}%"><output data-pref-output="${section}.${key}">${percent}%</output></span></label>`;
}

function toggleMarkup(label: string, hint: string, checked: boolean, attributes: string): string {
  if (attributes.includes("data-debug")) {
    return `<label class="toggle" data-gamepad-nav tabindex="0"><input type="checkbox" ${checked ? "checked" : ""} ${attributes}><span>${label}</span></label>`;
  }
  return `<label class="setting-row setting-toggle" data-gamepad-nav tabindex="0"><span><strong>${label}</strong>${hint ? `<small>${hint}</small>` : ""}</span><input type="checkbox" ${checked ? "checked" : ""} ${attributes}><i aria-hidden="true"></i></label>`;
}

function selectMarkup(label: string, hint: string, section: string, key: string, value: string, options: readonly (readonly [string, string])[]): string {
  return `<label class="setting-row" data-gamepad-nav tabindex="0"><span><strong>${label}</strong><small>${hint}</small></span><select ${pref(section, key)} aria-label="${label}">${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${optionLabel}</option>`).join("")}</select></label>`;
}

function pref(section: string, key: string): string {
  return `data-pref-section="${section}" data-pref-key="${key}"`;
}

function option(value: string | number, label: string): string {
  return `<option value="${value}">${label}</option>`;
}

function selectedOptions(options: string, selected: number): string {
  return options.replace(`value="${selected}"`, `value="${selected}" selected`);
}

function nameOf(key: string): string {
  return key.replaceAll("_", " ");
}
