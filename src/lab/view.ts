import type { CharacterDef, MoveDef } from "../combat/types";
import { ACTION_SLOT_LABELS } from "../input/action-layout";
import type { ArmorDef, ArmorInventory, ArmorSkillId, ArmorSlot, MaterialDef } from "../content/armor";
import {
  ARMOR_CATALOG,
  ARMOR_SKILLS,
  ARMOR_SLOTS,
  MATERIAL_CATALOG,
  activeSkillThreshold,
  armorById,
  armorSkillById,
  armorSkillPoints,
  canCraftArmor,
  materialById,
} from "../content/armor";
import { STATUS_RULES } from "../content/status-rules";
import type { BuildState } from "./build-state";
import { moveTimelineMarkup } from "./inspector";
import type { LabPreferences } from "./preferences";
import {
  ACTION_BANKS,
  MOVE_FAMILIES,
  MOVE_ROLES,
  actionSlotInput,
  actionSlotLabel,
  codexMoveDetailMarkup,
  equippedSummary,
  moveFamilies,
  moveLevel,
  moveName,
  moveRole,
  moveTerrain,
  primaryDamage,
  primaryHitbox,
  routeTopologyMarkup,
} from "./move-presentation";

interface LabViewOptions {
  character: CharacterDef;
  buildState: BuildState;
  preferences: LabPreferences;
  dummyOptions: readonly [number, string][];
  publicPlay?: boolean;
}

export function buildLabView({ character, buildState, preferences, dummyOptions, publicPlay = false }: LabViewOptions): string {
  const preset = buildState.presets[buildState.activePreset];
  const initialMove = character.moves.find((move) => move.id === preset.loadout[0]) ?? character.moves[0];
  const moveOptions = character.moves.map((move) => option(move.id, `${String(move.id).padStart(2, "0")} · ${moveName(move)} · ${primaryDamage(move)} dmg · ${move.startup}f`)).join("");
  const assignmentRows = ACTION_SLOT_LABELS.map((label) => {
    const moveId = preset.loadout[label.slot];
    const move = character.moves.find((candidate) => candidate.id === moveId);
    const bank = ACTION_BANKS[Math.trunc(label.slot / 4)];
    const heading = label.slot % 4 === 0 ? `<div class="action-bank-heading"><span>${bank.input}</span><strong>${bank.name}</strong><em>${bank.role}</em></div>` : "";
    return `${heading}<label class="loadout-row${label.slot === 0 ? " armed" : ""}" data-gamepad-nav tabindex="0" data-arm-slot="${label.slot}" data-action-bank="${Math.trunc(label.slot / 4)}" data-move-preview="${moveId}">
      <span class="slot-number">${String(label.slot + 1).padStart(2, "0")}</span>
      <span class="assignment-glyph"><kbd class="keyboard-key">${label.keyboard}</kbd><kbd class="pad-key">${label.gamepad}</kbd></span>
      <select data-loadout-slot="${label.slot}" aria-label="Move for action ${label.slot + 1}">${selectedOptions(moveOptions, moveId)}</select>
      <span class="assignment-tags" data-assignment-tags="${label.slot}">${move?.tags.slice(0, 3).join(" · ") ?? "unassigned"}</span>
    </label>`;
  }).join("");
  const equipment = ARMOR_SLOTS.map((slot) => {
    const item = armorById(preset.equipment[slot]);
    return `<button type="button" class="gear-slot grade-${item?.grade ?? "white"}" data-gamepad-nav data-armor-slot="${slot}" aria-label="${slot}: ${item?.name ?? "empty"}">
      <span class="gear-icon" aria-hidden="true">${item?.icon ?? "+"}</span><span><small>${slot}</small><strong data-equipped-name="${slot}">${item?.name ?? "Empty"}</strong><em data-equipped-armor="${slot}">${item?.armor ?? 0} armor</em></span>
    </button>`;
  }).join("");
  const ownedArmor = buildState.inventory.armor.map(armorById).filter((item): item is ArmorDef => item !== null);
  const inventory = ownedArmor.map(armorInventoryButton).join("");
  const materials = MATERIAL_CATALOG.map((material) => materialInventoryButton(material, buildState.inventory)).join("");
  const inputButtons = ACTION_SLOT_LABELS.map((label) => `<button type="button" class="mapped-input${label.slot === 0 ? " selected" : ""}" data-gamepad-nav data-select-action="${label.slot}" data-move-preview="${preset.loadout[label.slot]}" aria-label="Action ${label.slot + 1}: ${label.keyboard}, ${label.gamepad}">
    <span>${String(label.slot + 1).padStart(2, "0")}</span><kbd class="keyboard-key">${label.keyboard}</kbd><kbd class="pad-key">${label.gamepad}</kbd>
  </button>`).join("");
  const moveLibrary = character.moves.map((move) => moveCard(move, preset.loadout)).join("");
  const codexMoveLibrary = character.moves.map((move) => codexMoveButton(move, preset.loadout)).join("");
  const statusCards = STATUS_RULES.map((rule) => {
    const moves = character.moves.filter((move) => move.tags.includes(rule.tag)).map(moveName);
    return `<article class="status-rule status-${rule.tag}"><div class="status-rule-icon" aria-hidden="true">${rule.glyph}</div><div><p>${rule.tag.toUpperCase()} · MAX ${rule.maxStacks} STACKS</p><h3>${rule.name}</h3><dl><div><dt>Primer</dt><dd>${rule.primer}</dd></div><div><dt>Payoff</dt><dd>${rule.payoff}</dd></div></dl><ul aria-label="Moves with ${rule.name}">${moves.map((move) => `<li>${move}</li>`).join("")}</ul></div></article>`;
  }).join("");
  const initialArmor = armorById(preset.equipment.head) ?? ownedArmor[0] ?? ARMOR_CATALOG[0];
  const initialCraft = ARMOR_CATALOG.find((item) => !buildState.inventory.armor.includes(item.id)) ?? ARMOR_CATALOG[0];
  const skills = armorSkillPoints(preset.equipment);
  const presets = presetSwitcher(buildState);

  return `<a class="skip-link" href="#game-content">Skip to ${publicPlay ? "combat arena" : "combat lab"}</a>
  <main class="lab-shell${publicPlay ? " public-play" : ""}" id="game-content">
    <header class="lab-header debugger-header"><div class="brand"><p class="eyebrow">${publicPlay ? "HEXFRAME / PUBLIC PLAYTEST" : "HEXFRAME / DETERMINISTIC COMBAT LAB V0"}</p><h1>${publicPlay ? "Prime. Link. Cash out." : "Combat operating system."}</h1><p>${publicPlay ? "Build a sixteen-technique arsenal. Route statuses. Finish the fight." : "Every panel describes one authoritative frame."}</p></div><div class="header-actions"><span class="controller-state" id="controller-state">Keyboard ready</span><button type="button" data-action="menu" aria-haspopup="dialog">${publicPlay ? "Arsenal · Codex · System" : "Open systems"}</button></div></header>

    ${publicPlay ? "" : `<section class="frame-console" aria-label="Frame transport controls">
      <div class="global-frame"><span>FRAME</span><strong id="frame-readout">000000</strong><em id="play-state">LIVE</em></div>
      <div class="frame-transport">
        <button type="button" data-action="back-10" aria-label="Move backward ten frames">◀ −10</button>
        <button type="button" data-action="back" aria-label="Move backward one frame">◀ −1</button>
        <button class="primary" id="pause-control" type="button" data-action="pause">Pause</button>
        <button type="button" data-action="forward" aria-label="Move forward one frame">+1 ▶</button>
        <button type="button" data-action="forward-10" aria-label="Move forward ten frames">+10 ▶</button>
        <button type="button" data-action="reset">Reset</button>
      </div>
      <div class="frame-options"><label><input type="checkbox" data-control="pause-on-contact" checked> Pause on contact</label><span><kbd>Space</kbd> play/pause · <kbd>,</kbd> −1 · <kbd>.</kbd> +1</span><output id="timeline-status">Frame 0 · live</output></div>
    </section>`}

    <section class="debugger-workspace">
      <section class="playfield-card" aria-label="Combat arena">
        <div class="hud" aria-label="Fighter health and stamina"><div class="hud-player"><span>P1</span><div class="hud-meter-stack"><div class="health-track"><i id="health-p1"></i></div><div class="stamina-track"><i id="stamina-p1"></i></div></div><strong><b id="health-text-p1">${character.health}</b><small id="stamina-text-p1">${character.stamina} STA</small></strong></div><div class="hud-player hud-player-right"><strong><b id="health-text-p2">1000</b><small id="stamina-text-p2">100 STA</small></strong><div class="hud-meter-stack"><div class="health-track"><i id="health-p2"></i></div><div class="stamina-track"><i id="stamina-p2"></i></div></div><span>DUMMY</span></div></div>
        <div class="status-lane status-lane-you" id="debuff-p1" aria-label="Your active debuffs"></div><div class="status-lane status-lane-dummy" id="debuff-p2" aria-label="Dummy active debuffs"></div><div id="stage" class="stage"></div>
        <div class="current-route"><span>ACTIVE</span><strong id="active-move">Ready</strong><em id="active-tags">Choose any 16 of ${character.moves.length} moves</em></div><div class="audio-caption" id="audio-caption" role="status" aria-live="polite" hidden></div><div class="sr-only" id="combat-announcer" role="status" aria-live="polite"></div>
      </section>
      ${publicPlay ? "" : `<aside class="frame-inspector" id="frame-inspector" aria-label="Authoritative frame inspector"></aside>`}
    </section>

    ${publicPlay ? "" : `<section class="geometry-controls" aria-label="Combat geometry visibility"><strong>GEOMETRY</strong>${[["hitboxes", "Hitboxes"], ["hurtboxes", "Hurtboxes"], ["pushboxes", "Pushboxes"], ["origins", "Origins"], ["skeleton", "Skeleton"]].map(([key, label]) => `<label><input type="checkbox" data-debug="${key}"> ${label}</label>`).join("")}</section>
    <section class="move-timeline-console" id="move-timeline-console" aria-label="Move frame timeline">${moveTimelineMarkup(initialMove)}</section>

    <section class="debugger-lower-grid">
      <section class="interaction-console" aria-labelledby="interaction-title"><header><p>FREEZEABLE HISTORY</p><h2 id="interaction-title">Interaction inspector</h2></header><div class="interaction-workspace" id="interaction-history"><p class="interaction-empty">No attack volume has touched a hurtbox in this run.</p></div></section>
      <section class="scenario-console" aria-labelledby="scenario-title"><header><p>HEADLESS-READY CAPTURE</p><h2 id="scenario-title">Reproducible scenario</h2></header><p>Capture exact per-frame inputs and the expected terminal hash. Replay it through the same deterministic clock or export it as a combat fixture.</p><div class="scenario-actions"><button type="button" data-action="scenario-capture">Capture current run</button><button type="button" data-action="scenario-replay" disabled>Replay & verify</button><button type="button" data-action="scenario-export" disabled>Export JSON</button><label class="scenario-import">Import JSON<input type="file" accept="application/json,.json" data-control="scenario-import"></label></div><output id="scenario-status">No scenario captured.</output></section>
    </section>`}

    <footer class="control-legend"><span><b>MOVE</b> WASD / left stick</span><span><b>NEUTRAL</b> arrows / Y X B A</span><span><b>SETUP</b> Shift / LT</span><span><b>POWER</b> E / RT</span><span><b>FINALE</b> Shift+E / LT+RT</span>${publicPlay ? "" : "<span><b>SCRUB</b> , and . / LB RB</span><span><b>PLAY</b> Space / Start</span>"}<span><b>MENU</b> Esc / View</span></footer>

    <div class="menu-scrim" id="menu-scrim" hidden><aside class="lab-menu" id="lab-menu" role="dialog" aria-modal="true" aria-labelledby="menu-title" tabindex="-1">
      <header class="menu-header"><div><p class="eyebrow">HEXFRAME / BUILDCRAFT</p><h2 id="menu-title">Arsenal, codex & system</h2></div><button type="button" data-action="close-menu" data-gamepad-nav aria-label="Close systems and return to game">Close</button></header>
      <nav class="menu-tabs" role="tablist" aria-label="Game systems"><span class="menu-tab-group" role="presentation"><small>ARMORY</small>${menuTab("loadout", "Arsenal", true)}${menuTab("armor", "Equipment")}${menuTab("craft", "Forge")}</span><span class="menu-tab-group" role="presentation"><small>CODEX</small>${menuTab("moves", "Moves")}${menuTab("status", "Status")}</span><span class="menu-tab-group" role="presentation"><small>SYSTEM</small>${menuTab("training", "Training")}${menuTab("settings", "Settings")}${publicPlay ? "" : menuTab("debug", "Debug")}</span></nav>

      <section class="menu-page active armory-page" id="page-loadout" role="tabpanel" aria-labelledby="tab-loadout" data-menu-page="loadout">
        <div class="armory-titlebar"><div><p class="eyebrow">TECHNIQUE DECK / <span data-build-number>BUILD ${String(buildState.activePreset + 1).padStart(2, "0")}</span><b data-build-dirty></b></p><h2>Arsenal</h2></div>${presetManager(buildState)}</div>
        <div class="loadout-workspace"><section class="input-sheet" aria-labelledby="input-sheet-title"><div class="panel-heading"><div><small>FOUR BANKS · FOUR ROLES</small><h3 id="input-sheet-title">Keyboard + gamepad</h3></div><span>16 TECHNIQUES</span></div>${deviceOutlines()}<div class="mapped-inputs">${inputButtons}</div></section><aside class="assignment-sheet" aria-labelledby="assignment-title"><div class="panel-heading"><div><small>TECHNIQUE DECK</small><h3 id="assignment-title">Equipped arsenal</h3></div><button type="button" data-action="default-loadout" data-gamepad-nav>Reset</button></div><div class="loadout-grid">${assignmentRows}</div></aside></div>
        <div class="move-workbench">${moveShowcase(initialMove, character, preset.loadout)}<section class="move-library-panel" aria-labelledby="move-library-title">
          <div class="armed-slot-panel" id="armed-slot-panel" aria-live="polite"><span>SELECTED SLOT</span><strong>${actionSlotInput(0)}</strong><em>${actionSlotLabel(0).toUpperCase()} / SLOT 01</em><small>CURRENTLY: ${moveName(initialMove).toUpperCase()}</small></div>
          <div class="panel-heading"><div><small>PRESS A / ENTER TO EQUIP</small><h3 id="move-library-title">Move catalog</h3></div><span><b id="move-result-count">${character.moves.length}</b> / ${character.moves.length} MOVES</span></div>
          ${moveFilters()}
          <div class="move-library" id="move-library">${moveLibrary}</div><p class="move-library-empty" id="move-library-empty" hidden>No techniques match these filters.</p><output class="equip-feedback" id="equip-feedback" aria-live="polite">Choose a technique for ${actionSlotLabel(0)}.</output>
        </section></div>
      </section>

      <section class="menu-page armor-page" id="page-armor" role="tabpanel" aria-labelledby="tab-armor" data-menu-page="armor" hidden>
        <div class="armory-titlebar"><div><p class="eyebrow">ARMORY / <span data-build-number>BUILD ${String(buildState.activePreset + 1).padStart(2, "0")}</span></p><h2>Armor & equipment</h2></div>${presets}</div>
        <div class="gear-workspace">
          <aside class="character-sheet" aria-labelledby="character-sheet-title">
            <div class="character-crest"><span aria-hidden="true">SW</span><div><small>OCCULTIST · ARMOR BUILD</small><h3 id="character-sheet-title">${preset.name}</h3></div></div>
            <dl class="combat-stats" aria-label="Character statistics">
              <div><dt>Vitality</dt><dd id="stat-vitality">${character.health}</dd></div><div><dt>Stamina</dt><dd id="stat-stamina">${character.stamina}</dd></div><div><dt>Armor</dt><dd id="stat-armor">${character.armor}</dd></div>
            </dl>
            <div class="resistance-block"><h4>Resistances</h4><dl><div><dt>Poison</dt><dd id="stat-resist-poison">${character.resistances.poison}</dd></div><div><dt>Fire</dt><dd id="stat-resist-fire">${character.resistances.fire}</dd></div><div><dt>Frost</dt><dd id="stat-resist-frost">${character.resistances.frost}</dd></div><div><dt>Shock</dt><dd id="stat-resist-shock">${character.resistances.shock}</dd></div></dl></div>
            <h4>Equipped armor</h4><div class="equipment-grid">${equipment}</div>
            <div class="skill-board" id="skill-board" aria-label="Active armor skills">${skillBoardMarkup(skills)}</div>
          </aside>
          <section class="inventory-sheet" aria-labelledby="inventory-title">
            <div class="panel-heading inventory-heading"><div><small>ITEM BOX</small><h3 id="inventory-title">Inventory</h3></div><span><b id="owned-armor-count">${ownedArmor.length}</b> / ${ARMOR_CATALOG.length} ARMOR</span></div>
            <nav class="inventory-tabs" role="tablist" aria-label="Inventory categories"><button class="active" type="button" role="tab" id="inventory-tab-armor" aria-selected="true" aria-controls="inventory-panel-armor" data-inventory-tab="armor" data-gamepad-nav>Armor</button><button type="button" role="tab" id="inventory-tab-materials" aria-selected="false" aria-controls="inventory-panel-materials" tabindex="-1" data-inventory-tab="materials" data-gamepad-nav>Everything else</button></nav>
            <div class="inventory-vault">
              <section class="inventory-panel" id="inventory-panel-armor" role="tabpanel" aria-labelledby="inventory-tab-armor" data-inventory-panel="armor"><div class="armor-item-grid" id="armor-inventory-grid">${inventory}</div></section>
              <section class="inventory-panel" id="inventory-panel-materials" role="tabpanel" aria-labelledby="inventory-tab-materials" data-inventory-panel="materials" hidden><div class="material-item-grid">${materials}</div></section>
              <aside class="gear-detail" id="gear-detail" aria-live="polite">${armorDetailMarkup(initialArmor, armorById(preset.equipment[initialArmor.slot]), preset.equipment)}</aside>
            </div>
          </section>
        </div>
      </section>

      <section class="menu-page craft-page" id="page-craft" role="tabpanel" aria-labelledby="tab-craft" data-menu-page="craft" hidden>
        <div class="armory-titlebar"><div><p class="eyebrow">FORGE / ARMOR RECIPES</p><h2>Crafting</h2></div><span class="craft-owned"><b id="craft-owned-count">${ownedArmor.length}</b> / ${ARMOR_CATALOG.length} OWNED</span></div>
        <div class="craft-workspace"><section class="recipe-sheet" aria-labelledby="recipe-title"><div class="panel-heading"><div><small>FIVE GRADES · FIVE SLOTS</small><h3 id="recipe-title">Armor recipes</h3></div><span>SELECT A PIECE</span></div><div class="recipe-grid">${ARMOR_CATALOG.map((item) => craftRecipeButton(item, buildState.inventory)).join("")}</div></section><aside class="craft-detail" id="craft-detail" aria-live="polite">${craftDetailMarkup(initialCraft, buildState.inventory)}</aside></div>
      </section>

      <section class="menu-page codex-page codex-moves-page" id="page-moves" role="tabpanel" aria-labelledby="tab-moves" data-menu-page="moves" hidden>
        <div class="page-intro"><div><p class="eyebrow">MOVE CODEX / AUTHORITATIVE COMBAT DATA</p><h2>Exactly what does this do?</h2><p>Demo shows the move's authored feature. Hit and Block isolate contact behavior. Every frame below comes from the same move definition used by combat.</p></div></div>
        <div class="codex-moves-shell">
          <aside class="codex-move-index" aria-label="Move index"><label><span>SEARCH MOVES</span><input type="search" data-codex-search placeholder="Name, role, family…" aria-label="Search move codex"></label><div id="codex-move-index">${codexMoveLibrary}</div></aside>
          <section class="codex-demonstration" aria-label="Move demonstration">
            <header class="demonstration-toolbar"><div class="demo-modes" role="group" aria-label="Demonstration mode"><button class="active" type="button" data-gamepad-nav data-demo-mode="demo" aria-pressed="true">Demo</button><button type="button" data-gamepad-nav data-demo-mode="hit" aria-pressed="false">Hit</button><button type="button" data-gamepad-nav data-demo-mode="block" aria-pressed="false">Block</button></div><div class="demo-speed" role="group" aria-label="Playback speed"><span>PLAYBACK</span><button class="active" type="button" data-gamepad-nav data-demo-speed="0.5" aria-pressed="true">0.5×</button><button type="button" data-gamepad-nav data-demo-speed="1" aria-pressed="false">1×</button><button type="button" data-gamepad-nav data-demo-speed="2" aria-pressed="false">2×</button></div></header>
            <div class="codex-move-stage" id="codex-move-stage"></div>
            <div class="demo-transport"><button type="button" data-gamepad-nav data-action="demo-prev" aria-label="Previous move frame">◀</button><button class="primary" type="button" data-gamepad-nav data-action="demo-toggle">Pause</button><button type="button" data-gamepad-nav data-action="demo-next" aria-label="Next move frame">▶</button><label><span>FRAME <strong id="codex-frame-readout">01 / ${String(initialMove.duration).padStart(2, "0")}</strong></span><input id="codex-frame-scrubber" type="range" min="1" max="${initialMove.duration}" value="1" step="1" aria-label="Move frame"></label></div>
            <output class="codex-frame-detail" id="codex-frame-detail">FRAME 01 · STARTUP</output>
            <section class="move-timeline-console codex-timeline" id="codex-move-timeline" data-codex-timeline aria-label="Interactive move frame timeline">${moveTimelineMarkup(initialMove)}</section>
            <article class="codex-move-detail" id="codex-move-detail">${codexMoveDetailMarkup(initialMove, character, preset.loadout)}</article>
          </section>
        </div>
      </section>

      <section class="menu-page codex-page" id="page-status" role="tabpanel" aria-labelledby="tab-status" data-menu-page="status" hidden><div class="page-intro"><div><p class="eyebrow">STATUS CODEX / COMBO LOGIC</p><h2>Prime. Link. Cash out.</h2><p>Starters route into starters or links. Rift Uppercut launches into dedicated air routes. Cashouts end the sequence—build your sixteen-technique deck around a route with intent.</p></div></div><div class="system-rules"><article><b>STAMINA</b><span>Moves, jumps, and double-tap dashes spend stamina. It regenerates after 36 quiet frames.</span></article><article><b>AERIAL ROUTES</b><span>Rift Uppercut → Astral Jab → Witch Knee → Meteor Heel or Void Dive.</span></article><article><b>HYPER ARMOR</b><span>Bastion Break absorbs one strike without losing its attack, while still taking damage and status.</span></article><article><b>SET PERKS</b><span>Equip three pieces from one armor set to activate its behavioral perk.</span></article></div><div class="status-rules">${statusCards}</div><div class="route-examples"><h3>Starter routes</h3><div><article><b>IGNITE LOOP</b><span>Ember Palm → Ashen Sweep → Phoenix Drive</span></article><article><b>VENOM ENGINE</b><span>Venom Fang → Toxic Bloom → Plague Touch</span></article><article><b>DEEP FREEZE</b><span>Frost Heel → Glacier Spike → Permafrost</span></article><article><b>VOLTAGE CASHOUT</b><span>Storm Knuckle → Static Rush → Bastion Break</span></article><article><b>SKY ROUTE</b><span>Rift Uppercut → Astral Jab → Witch Knee → Void Dive</span></article></div></div></section>
      <section class="menu-page settings-page" id="page-settings" role="tabpanel" aria-labelledby="tab-settings" data-menu-page="settings" hidden><div class="settings-shell"><nav class="settings-nav" role="tablist" aria-label="Settings categories">${settingsTab("audio", "Audio", true)}${settingsTab("video", "Visual")}${settingsTab("accessibility", "Accessibility")}${settingsTab("controls", "Controls")}</nav><div class="settings-content">${settingsPanels(preferences)}</div></div></section>
      <section class="menu-page" id="page-training" role="tabpanel" aria-labelledby="tab-training" data-menu-page="training" hidden><div class="page-intro"><div><p class="eyebrow">FRAME LAB</p><h2>Training instrument</h2><p>${publicPlay ? "Frame controls live here when you want to study a route. Close the menu to return to the clean fight view." : "Configure the deterministic dummy, playback speed, save states, and the permanent lab instruments."}</p></div></div>${publicPlay ? `<section class="training-frame-console" aria-label="Frame transport controls"><div class="training-frame-status"><span>FRAME <strong id="frame-readout">000000</strong></span><em id="play-state">LIVE</em><output id="timeline-status">Frame 0 · live</output></div><div class="timeline-tools"><button type="button" data-action="back-10" data-gamepad-nav>Step −10</button><button type="button" data-action="back" data-gamepad-nav>Step −1</button><button class="primary" type="button" data-action="pause" data-gamepad-nav>Pause</button><button type="button" data-action="forward" data-gamepad-nav>Step +1</button><button type="button" data-action="forward-10" data-gamepad-nav>Step +10</button><button type="button" data-action="reset" data-gamepad-nav>Reset</button><label data-gamepad-nav tabindex="0"><input type="checkbox" data-control="pause-on-contact" checked> Pause on contact</label></div></section>` : ""}<div class="settings-grid"><label data-gamepad-nav tabindex="0"><span>Simulation speed</span><select data-control="speed"><option value="25">25%</option><option value="50">50%</option><option value="100" selected>100%</option><option value="200">200%</option></select></label><label data-gamepad-nav tabindex="0"><span>Training dummy</span><select data-control="dummy">${dummyOptions.map(([value, label]) => option(value, label)).join("")}</select></label></div>${publicPlay ? "" : `<div class="timeline-tools"><button type="button" data-action="back-10" data-gamepad-nav>Step −10</button><button type="button" data-action="back" data-gamepad-nav>Step −1</button><button type="button" data-action="forward" data-gamepad-nav>Step +1</button><button type="button" data-action="forward-10" data-gamepad-nav>Step +10</button><button type="button" data-action="reset" data-gamepad-nav>Reset match</button></div>`}<div class="save-states"><h3>Save states</h3>${[1, 2, 3].map((slot) => `<div><span>Slot ${slot}</span><button type="button" data-save="${slot}" data-gamepad-nav>Save</button><button type="button" data-load="${slot}" data-gamepad-nav disabled>Load</button></div>`).join("")}</div>${publicPlay ? `<section class="move-timeline-console training-timeline" id="move-timeline-console" aria-label="Move frame timeline">${moveTimelineMarkup(initialMove)}</section>` : ""}</section>
      ${publicPlay ? "" : `<section class="menu-page" id="page-debug" role="tabpanel" aria-labelledby="tab-debug" data-menu-page="debug" hidden><div class="toggle-grid">${[["hitboxes", "Hitboxes"], ["hurtboxes", "Hurtboxes"], ["pushboxes", "Pushboxes"], ["origins", "Origins"], ["skeleton", "Skeleton"], ["boneNames", "Bone names"], ["velocity", "Velocity"]].map(([key, label]) => toggleMarkup(label, false, `data-debug="${key}"`)).join("")}</div><div class="debug-card"><div class="card-heading"><span>Authoritative state</span><em>LIVE</em></div><div id="debug-panel"></div></div></section>`}
      <footer class="menu-footer"><span>D-pad navigate · A select · B close · LB/RB tabs</span>${publicPlay ? "<strong>PUBLIC PLAYTEST</strong>" : `<form method="post" action="/logout"><button class="ghost" type="submit" data-gamepad-nav>Sign out <span id="session-label"></span></button></form>`}</footer>
    </aside></div>
  </main>`;
}

function menuTab(id: string, label: string, active = false): string { return `<button class="${active ? "active" : ""}" type="button" role="tab" id="tab-${id}" aria-selected="${active}" aria-controls="page-${id}" tabindex="${active ? 0 : -1}" data-menu-tab="${id}" data-gamepad-nav>${label}</button>`; }
function settingsTab(id: string, label: string, active = false): string { return `<button class="${active ? "active" : ""}" type="button" role="tab" id="settings-tab-${id}" aria-selected="${active}" aria-controls="settings-panel-${id}" tabindex="${active ? 0 : -1}" data-settings-tab="${id}" data-gamepad-nav>${label}</button>`; }
function presetSwitcher(buildState: BuildState): string { return `<div class="preset-switcher" aria-label="Loadout presets">${buildState.presets.map((build, index) => `<button class="${index === buildState.activePreset ? "active" : ""}" type="button" data-gamepad-nav data-preset="${index}" aria-label="Loadout ${index + 1}: ${build.name}" aria-pressed="${index === buildState.activePreset}">${String(index + 1).padStart(2, "0")}</button>`).join("")}</div>`; }
function presetManager(buildState: BuildState): string {
  const active = buildState.presets[buildState.activePreset];
  return `<div class="preset-manager">${presetSwitcher(buildState)}<label><span>BUILD NAME</span><input type="text" maxlength="32" value="${active.name}" data-build-name aria-label="Build name"></label><div class="preset-actions"><button type="button" data-gamepad-nav data-preset-action="rename">Rename</button><button type="button" data-gamepad-nav data-preset-action="duplicate">Duplicate</button><button type="button" data-gamepad-nav data-preset-action="clear">Clear</button><button type="button" data-gamepad-nav data-preset-action="reset">Reset</button></div><output data-build-changes>Auto-saved · applies when the menu closes</output></div>`;
}
function deviceOutlines(): string { return `<div class="device-outlines" aria-hidden="true"><div class="keyboard-outline"><div class="wasd-keys"><i>W</i><i>A</i><i>S</i><i>D</i></div><div class="arrow-keys"><i>↑</i><i>←</i><i>↓</i><i>→</i></div><b>SHIFT</b><b>SPACE</b></div><div class="gamepad-outline"><i class="trigger lt">LT</i><i class="trigger rt">RT</i><span class="pad-dpad">＋</span><span class="pad-stick left-stick"></span><span class="pad-stick right-stick"></span><div class="face-cluster"><i>Y</i><i>X</i><i>B</i><i>A</i></div></div></div>`; }

function moveFilters(): string {
  const buttons = (kind: string, values: readonly string[]) => values.map((value, index) => `<button class="${index === 0 ? "active" : ""}" type="button" data-gamepad-nav data-move-filter="${kind}" data-filter-value="${value}" aria-pressed="${index === 0}">${value.toUpperCase()}</button>`).join("");
  return `<section class="move-filters" aria-label="Move catalog filters"><div role="group" aria-label="Route role">${buttons("role", ["all", ...MOVE_ROLES])}</div><div role="group" aria-label="Status family">${buttons("family", ["all", ...MOVE_FAMILIES])}</div><div role="group" aria-label="Terrain">${buttons("terrain", ["all", "ground", "air"])}</div><label><span>SEARCH</span><input type="search" data-move-search placeholder="Name, tag, property…" aria-label="Search move catalog"></label></section>`;
}

export function armorInventoryButton(item: ArmorDef): string {
  const skills = item.skills.map((grant) => `${armorSkillById(grant.id).name} +${grant.points}`).join(", ");
  return `<button type="button" class="armor-item grade-${item.grade}" data-gamepad-nav data-armor-item="${item.id}" aria-label="Equip ${item.name}, ${item.grade} grade, ${item.armor} armor, ${skills}"><span class="gear-icon" aria-hidden="true">${item.icon}</span><small>${item.armor}</small><em>${item.slot}</em></button>`;
}

function materialInventoryButton(material: MaterialDef, inventory: Readonly<ArmorInventory>): string {
  const count = inventory.materials[material.id] ?? 0;
  return `<button type="button" class="material-item" data-gamepad-nav data-material-item="${material.id}" aria-label="${material.name}, ${count} owned"><span class="material-icon" aria-hidden="true">${material.icon}</span><strong data-material-count="${material.id}">${count}</strong><small>${material.name}</small></button>`;
}

export function armorDetailMarkup(
  item: ArmorDef,
  equipped: ArmorDef | null,
  equipment: Readonly<Partial<Record<ArmorSlot, string>>> = {},
): string {
  const delta = item.armor - (equipped?.armor ?? 0);
  const deltaLabel = delta === 0 ? "equipped value" : `${delta > 0 ? "+" : ""}${delta} vs equipped`;
  const prospective = { ...equipment, [item.slot]: item.id };
  const points = armorSkillPoints(prospective);
  const regularSkills = item.skills.filter((grant) => !armorSkillById(grant.id).thresholds.some((threshold) => threshold.effect.perk));
  const setGrant = item.skills.find((grant) => armorSkillById(grant.id).thresholds.some((threshold) => threshold.effect.perk));
  const skillMarkup = regularSkills.map((grant) => {
    const skill = armorSkillById(grant.id);
    return `<div class="detail-skill"><span><b>${skill.name}</b><small>+${grant.points} · build total ${points[skill.id]}</small></span><ul>${skill.thresholds.map((threshold) => `<li class="${points[skill.id] >= threshold.points ? "active" : ""}"><b>${threshold.points}</b><span>${threshold.description}</span></li>`).join("")}</ul></div>`;
  }).join("");
  const setMarkup = setGrant ? (() => {
    const skill = armorSkillById(setGrant.id);
    const perk = skill.thresholds.find((threshold) => threshold.effect.perk);
    const progress = points[skill.id];
    return `<section class="detail-set"><div><span><b>${skill.name}</b><small>Set progress</small></span><em>${Math.min(progress, 3)} / 3</em></div><p>${item.setDescription}</p>${perk ? `<dl><dt>${perk.points} pieces</dt><dd>${perk.description}</dd></dl>` : ""}</section>`;
  })() : "";
  return `<div class="detail-heading"><span class="gear-icon grade-${item.grade}" aria-hidden="true">${item.icon}</span><div><small>${item.grade} · ${item.slot} · ${item.setName} set</small><h3>${item.name}</h3></div></div><p>${item.description}</p><dl class="detail-defense"><div><dt>Armor</dt><dd>${item.armor}</dd></div><div class="${delta > 0 ? "positive" : delta < 0 ? "negative" : ""}"><dt>Compare</dt><dd>${deltaLabel}</dd></div></dl><div class="detail-skills"><h4>Skills & thresholds</h4>${skillMarkup}</div>${setMarkup}`;
}

export function materialDetailMarkup(material: MaterialDef, inventory: Readonly<ArmorInventory>): string {
  return `<div class="detail-heading"><span class="material-icon" aria-hidden="true">${material.icon}</span><div><small>crafting material</small><h3>${material.name}</h3></div></div><p>${material.description}</p><dl class="detail-defense"><div><dt>Owned</dt><dd>${inventory.materials[material.id] ?? 0}</dd></div></dl>`;
}

export function skillBoardMarkup(points: Readonly<Record<ArmorSkillId, number>>): string {
  return `<h4>Armor skills</h4>${ARMOR_SKILLS.map((skill) => {
    const total = points[skill.id];
    const active = activeSkillThreshold(skill, total);
    return `<div class="skill-row" data-skill-row="${skill.id}"><span><b>${skill.name}</b><small>${active?.description ?? "No threshold active"}</small></span><div class="skill-thresholds" aria-label="${skill.name}: ${total} points">${skill.thresholds.map((threshold) => `<i class="${total >= threshold.points ? "active" : ""}">${threshold.points}</i>`).join("")}</div><strong>${total}</strong></div>`;
  }).join("")}`;
}

export function craftRecipeButton(item: ArmorDef, inventory: Readonly<ArmorInventory>): string {
  const owned = inventory.armor.includes(item.id);
  const craftable = canCraftArmor(item, inventory);
  return `<button type="button" class="recipe-item grade-${item.grade}${owned ? " owned" : craftable ? " craftable" : ""}" data-gamepad-nav data-craft-item="${item.id}" aria-label="View ${item.name} recipe, ${owned ? "owned" : craftable ? "craftable" : "missing materials"}"><span class="gear-icon" aria-hidden="true">${item.icon}</span><span><strong>${item.name}</strong><small>${item.slot} · ${item.armor} armor</small></span><em>${owned ? "OWNED" : craftable ? "READY" : item.grade.toUpperCase()}</em></button>`;
}

export function craftDetailMarkup(item: ArmorDef, inventory: Readonly<ArmorInventory>): string {
  const owned = inventory.armor.includes(item.id);
  const craftable = canCraftArmor(item, inventory);
  return `<div class="craft-preview"><span class="gear-icon grade-${item.grade}" aria-hidden="true">${item.icon}</span><small>${item.grade} · ${item.slot}</small><h3>${item.name}</h3><strong>${item.armor} ARMOR</strong></div><div class="craft-skill-list"><h4>Armor skills</h4>${item.skills.map((grant) => `<div><span>${armorSkillById(grant.id).name}</span><b>+${grant.points}</b></div>`).join("")}</div><div class="recipe-costs"><h4>Required materials</h4>${item.recipe.map((cost) => {
    const material = materialById(cost.materialId);
    const current = inventory.materials[cost.materialId] ?? 0;
    return `<div class="${current >= cost.quantity ? "met" : "missing"}"><span>${material?.name ?? cost.materialId}</span><b><span data-material-count="${cost.materialId}">${current}</span> / ${cost.quantity}</b></div>`;
  }).join("")}</div><button class="primary craft-button" type="button" data-action="craft-selected" data-gamepad-nav ${owned || !craftable ? "disabled" : ""}>${owned ? "Already owned" : craftable ? "Craft armor" : "Missing materials"}</button>`;
}

function moveCard(move: MoveDef, loadout: readonly number[]): string {
  const families = moveFamilies(move);
  const search = `${moveName(move)} ${move.description} ${move.tags.join(" ")}`.toLowerCase();
  return `<button type="button" class="move-card" data-gamepad-nav data-move-preview="${move.id}" data-equip-move="${move.id}" data-move-role="${moveRole(move)}" data-move-family="${families.join(" ")}" data-move-terrain="${moveTerrain(move)}" data-move-search-text="${search}" aria-label="Equip ${moveName(move)} into selected slot"><span class="move-card-index">${String(move.id).padStart(2, "0")}</span><div><header><h3>${moveName(move)}</h3><em>${moveLevel(move)}</em></header><p class="move-card-role">${moveRole(move).toUpperCase()} · ${(families.length > 0 ? families : ["physical"]).join(" · ").toUpperCase()} · ${moveTerrain(move).toUpperCase()}</p><p>${move.description}</p><dl><div><dt>DMG</dt><dd>${primaryDamage(move)}</dd></div><div><dt>START</dt><dd>${move.startup}f</dd></div><div><dt>STA</dt><dd>${move.staminaCost}</dd></div></dl><strong class="equipped-state" data-equipped-move="${move.id}">${equippedSummary(loadout, move.id)}</strong><ul>${move.tags.map((tag) => `<li>${tag}</li>`).join("")}</ul></div></button>`;
}

function moveShowcase(move: MoveDef, character: CharacterDef, loadout: readonly number[]): string {
  return `<section class="move-showcase" aria-labelledby="move-showcase-name"><div class="move-showcase-stage" id="move-showcase-stage"></div><div class="move-showcase-copy"><p id="move-showcase-code">MOVE ${String(move.id).padStart(2, "0")} · ${moveLevel(move).toUpperCase()}</p><h3 id="move-showcase-name">${moveName(move)}</h3><p id="move-showcase-description">${move.description}</p><strong class="showcase-equipped" data-equipped-move="${move.id}">${equippedSummary(loadout, move.id)}</strong><dl class="move-showcase-stats"><div><dt>Damage</dt><dd id="move-stat-damage">${primaryDamage(move)}</dd></div><div><dt>Stamina</dt><dd id="move-stat-stamina">${move.staminaCost}</dd></div><div><dt>Startup</dt><dd id="move-stat-startup">${move.startup}f</dd></div><div><dt>Active</dt><dd id="move-stat-active">${move.active}f</dd></div><div><dt>Recovery</dt><dd id="move-stat-recovery">${move.recovery}f</dd></div><div><dt>Hitstun</dt><dd id="move-stat-hitstun">${primaryHitbox(move)?.hitstun ?? 0}f</dd></div><div><dt>Blockstun</dt><dd id="move-stat-blockstun">${primaryHitbox(move)?.blockstun ?? 0}f</dd></div></dl><ul id="move-showcase-tags">${move.tags.map((tag) => `<li>${tag}</li>`).join("")}</ul><div id="move-route-topology">${routeTopologyMarkup(move, character, loadout)}</div></div></section>`;
}

function codexMoveButton(move: MoveDef, loadout: readonly number[]): string {
  return `<button type="button" class="codex-move-button" data-gamepad-nav data-codex-move="${move.id}" data-move-preview="${move.id}" data-codex-search-text="${moveName(move).toLowerCase()} ${move.tags.join(" ")}" aria-label="Inspect ${moveName(move)}"><span>${String(move.id).padStart(2, "0")}</span><strong>${moveName(move)}</strong><em>${moveRole(move).toUpperCase()} · ${moveTerrain(move).toUpperCase()}</em><small data-equipped-move="${move.id}">${equippedSummary(loadout, move.id)}</small></button>`;
}

function settingsPanels(preferences: LabPreferences): string {
  const a = preferences.audio; const v = preferences.video; const x = preferences.accessibility; const c = preferences.controls;
  return `${panel("audio", true, `<div class="settings-heading"><h2>Audio</h2></div><div class="settings-fields">${rangeMarkup("Master volume", "audio", "master", a.master, 0, 1, .05)}${rangeMarkup("Music", "audio", "music", a.music, 0, 1, .05)}${rangeMarkup("Combat effects", "audio", "sfx", a.sfx, 0, 1, .05)}${rangeMarkup("Interface", "audio", "ui", a.ui, 0, 1, .05)}${rangeMarkup("Ambience", "audio", "ambience", a.ambience, 0, 1, .05)}${toggleMarkup("Audio captions", a.captions, pref("audio", "captions"))}${toggleMarkup("Mono audio", a.mono, pref("audio", "mono"))}${toggleMarkup("Mute when unfocused", a.muteUnfocused, pref("audio", "muteUnfocused"))}${selectMarkup("Dynamic range", "audio", "dynamicRange", a.dynamicRange, [["night", "Night"], ["balanced", "Balanced"], ["wide", "Wide"]])}</div>`)}
  ${panel("video", false, `<div class="settings-heading"><h2>Visual</h2></div><div class="settings-fields">${selectMarkup("Quality", "video", "quality", v.quality, [["performance", "Performance"], ["balanced", "Balanced"], ["cinematic", "Cinematic"]])}${selectMarkup("Particles", "video", "particles", v.particles, [["off", "Off"], ["reduced", "Reduced"], ["full", "Full"]])}${rangeMarkup("Camera shake", "video", "cameraShake", v.cameraShake, 0, 1, .05)}${selectMarkup("Combat flashes", "video", "combatFlashes", v.combatFlashes, [["off", "Off"], ["reduced", "Reduced"], ["full", "Full"]])}${toggleMarkup("Damage numbers", v.damageNumbers, pref("video", "damageNumbers"))}${rangeMarkup("HUD opacity", "video", "hudOpacity", v.hudOpacity, .45, 1, .05)}</div>`)}
  ${panel("accessibility", false, `<div class="settings-heading"><h2>Accessibility</h2></div><div class="settings-fields">${selectMarkup("Theme", "accessibility", "theme", x.theme, [["system", "System"], ["dark", "Dark"], ["light", "Light"]])}${selectMarkup("Contrast", "accessibility", "contrast", x.contrast, [["normal", "Normal"], ["high", "High"]])}${selectMarkup("Motion", "accessibility", "motion", x.motion, [["system", "System"], ["full", "Full"], ["reduced", "Reduced"]])}${rangeMarkup("Text size", "accessibility", "textScale", x.textScale, .9, 1.6, .1)}${selectMarkup("Color vision", "accessibility", "colorVision", x.colorVision, [["default", "Default"], ["deuteranopia", "Deuteranopia"], ["protanopia", "Protanopia"], ["tritanopia", "Tritanopia"], ["monochrome", "Monochrome"]])}${toggleMarkup("Status patterns", x.statusPatterns, pref("accessibility", "statusPatterns"))}${toggleMarkup("Dyslexia-friendly type", x.dyslexiaFont, pref("accessibility", "dyslexiaFont"))}${toggleMarkup("Strong focus indicator", x.strongFocus, pref("accessibility", "strongFocus"))}${toggleMarkup("Screen reader combat log", x.screenReaderCombat, pref("accessibility", "screenReaderCombat"))}<button type="button" data-action="reset-preferences" data-gamepad-nav>Reset all settings</button></div>`)}
  ${panel("controls", false, `<div class="settings-heading"><h2>Controls</h2></div><div class="settings-fields">${selectMarkup("Input glyphs", "controls", "glyphs", c.glyphs, [["auto", "Automatic"], ["keyboard", "Keyboard"], ["xbox", "Gamepad"]])}${rangeMarkup("Stick deadzone", "controls", "stickDeadzone", c.stickDeadzone, .15, .9, .05)}${rangeMarkup("Vibration", "controls", "vibration", c.vibration, 0, 1, .05)}${toggleMarkup("Wrap menu navigation", c.menuWrap, pref("controls", "menuWrap"))}</div>`)}`;
}

function panel(id: string, active: boolean, body: string): string { return `<section id="settings-panel-${id}" role="tabpanel" aria-labelledby="settings-tab-${id}" data-settings-panel="${id}" ${active ? "" : "hidden"}>${body}</section>`; }
function rangeMarkup(label: string, section: string, key: string, value: number, min: number, max: number, step: number): string { const percent = Math.round(value * 100); return `<label class="setting-row setting-range" data-gamepad-nav tabindex="0"><strong>${label}</strong><span class="range-control"><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" ${pref(section, key)} data-pref-number aria-label="${label}" aria-valuetext="${percent}%"><output data-pref-output="${section}.${key}">${percent}%</output></span></label>`; }
function toggleMarkup(label: string, checked: boolean, attributes: string): string { if (attributes.includes("data-debug")) return `<label class="toggle" data-gamepad-nav tabindex="0"><input type="checkbox" ${checked ? "checked" : ""} ${attributes}><span>${label}</span></label>`; return `<label class="setting-row setting-toggle" data-gamepad-nav tabindex="0"><strong>${label}</strong><input type="checkbox" ${checked ? "checked" : ""} ${attributes}><i aria-hidden="true"></i></label>`; }
function selectMarkup(label: string, section: string, key: string, value: string, options: readonly (readonly [string, string])[]): string { return `<label class="setting-row" data-gamepad-nav tabindex="0"><strong>${label}</strong><select ${pref(section, key)} aria-label="${label}">${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${optionLabel}</option>`).join("")}</select></label>`; }
function pref(section: string, key: string): string { return `data-pref-section="${section}" data-pref-key="${key}"`; }
function option(value: string | number, label: string): string { return `<option value="${value}">${label}</option>`; }
function selectedOptions(options: string, selected: number): string { return options.replace(`value="${selected}"`, `value="${selected}" selected`); }
