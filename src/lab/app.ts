import { px } from "../combat/constants";
import type { FighterState, FrameReport, SimConfig } from "../combat/types";
import { ContactKind, DebuffEventKind, DebuffKind, HitLevel } from "../combat/types";
import { Simulation } from "../combat/simulation/simulation";
import { DEFAULT_MOVE_LOADOUT, testFighterWithBuild, testFighterWithLoadout } from "../content/test-fighter";
import { TEST_FIGHTER_ANIMATIONS, TEST_FIGHTER_MODEL, TEST_FIGHTER_RIG } from "../content/test-fighter-assets";
import type { ArmorSlot } from "../content/armor";
import {
  ARMOR_CATALOG,
  ARMOR_SLOTS,
  armorById,
  armorSkillPoints,
  canCraftArmor,
  materialById,
} from "../content/armor";
import { STATUS_RULES } from "../content/status-rules";
import { gameAudio } from "../client/audio/audio-manager";
import { GamepadController } from "../input/controller/gamepad";
import type { GamepadUiState } from "../input/controller/gamepad";
import { KeyboardController } from "../input/controller/keyboard";
import { DEFAULT_ACTION_KEYMAP, DEFAULT_KEYMAP_P1, DEFAULT_KEYMAP_P2, NO_ACTION_KEYMAP } from "../input/controller/keymap";
import { hashState } from "../rollback/hashing/fnv";
import type { DebugToggles } from "../renderer/svg/debug-overlay";
import { Renderer } from "../renderer/svg/renderer";
import { loadBuildState, persistBuildState } from "./build-state";
import { DebugPanel } from "./debugger/panel";
import { DummyController, DummyMode } from "./dummy/dummy";
import type { DummyModeValue } from "./dummy/dummy";
import { applyPreferences, loadPreferences, persistPreferences, resetPreferences } from "./preferences";
import type { LabPreferences } from "./preferences";
import { Timeline } from "./timeline/timeline";
import type { LabSpeed } from "./timeline/timeline";
import {
  frameInspectorMarkup,
  interactionHistoryMarkup,
  moveTimelineMarkup,
} from "./inspector";
import type { InteractionSelection } from "./inspector";
import {
  captureScenario,
  parseScenario,
  replayScenario,
  scenarioJson,
} from "./scenario/scenario";
import type { CombatScenario } from "./scenario/scenario";
import {
  armorDetailMarkup,
  armorInventoryButton,
  buildLabView,
  craftDetailMarkup,
  craftRecipeButton,
  materialDetailMarkup,
  skillBoardMarkup,
} from "./view";
import { MoveShowcase } from "./move-showcase";

const FRAME_MS = 1000 / 60;
const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex='-1'])";

const DUMMY_OPTIONS: readonly [DummyModeValue, string][] = [
  [DummyMode.Stand, "Stand"], [DummyMode.Crouch, "Crouch"], [DummyMode.Jump, "Jump"],
  [DummyMode.BlockNone, "Block none"], [DummyMode.BlockAll, "Block all"],
  [DummyMode.BlockAfterFirstHit, "Block after first hit"], [DummyMode.Record, "Record P2"],
  [DummyMode.Playback, "Playback"], [DummyMode.Counterattack, "Counterattack"],
  [DummyMode.Reversal, "Reversal"],
];

type MenuTab = "loadout" | "armor" | "craft" | "status" | "settings" | "training" | "debug";
type SettingsTab = "audio" | "video" | "accessibility" | "controls";
type InventoryTab = "armor" | "materials";

function edge(now: GamepadUiState, before: GamepadUiState, key: keyof GamepadUiState): boolean {
  return now[key] && !before[key];
}

/** Mounts the controller-first combat laboratory and returns its teardown. */
export function startLab(mount: HTMLElement): () => void {
  const publicPlay = window.location.pathname === "/play" || window.location.pathname.startsWith("/play/");
  const catalogCharacter = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
  const validMoveIds = new Set(catalogCharacter.moves.map((move) => move.id));
  const buildState = loadBuildState(validMoveIds);
  let activeBuild = buildState.presets[buildState.activePreset];
  const playerCharacter = testFighterWithBuild(activeBuild.loadout, activeBuild.equipment);
  const dummyCharacter = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
  const preferences = loadPreferences();
  applyPreferences(preferences);

  mount.innerHTML = buildLabView({ character: playerCharacter, buildState, preferences, dummyOptions: DUMMY_OPTIONS, publicPlay });

  // The lab reset is a canonical contact setup: standing light reaches the dummy without
  // hidden walking or timing, so the same move can be run, inspected, edited, and rerun.
  const config: SimConfig = { characters: [playerCharacter, dummyCharacter], startX: [px(-18), px(18)], seed: 0x5eed };
  const sim = new Simulation(config);
  const timeline = new Timeline(sim, 900);
  const dummy = new DummyController();
  const keyboard = new KeyboardController(window, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
  const secondKeyboard = new KeyboardController(window, DEFAULT_KEYMAP_P2, NO_ACTION_KEYMAP);
  const gamepad = new GamepadController();
  const renderer = new Renderer(required("stage"), sim.characters(), {
    fighters: [0, 1].map(() => ({ model: TEST_FIGHTER_MODEL, rig: TEST_FIGHTER_RIG, animations: TEST_FIGHTER_ANIMATIONS })),
  });
  const moveShowcase = new MoveShowcase(required("move-showcase-stage"), playerCharacter, {
    model: TEST_FIGHTER_MODEL,
    rig: TEST_FIGHTER_RIG,
    animations: TEST_FIGHTER_ANIMATIONS,
  });
  const panel = publicPlay ? null : new DebugPanel(required("debug-panel"));
  const toggles: DebugToggles = { hitboxes: false, hurtboxes: false, pushboxes: false, origins: false, skeleton: false, boneNames: false, velocity: false };

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
  let activeSettingsTab: SettingsTab = "audio";
  let resumeAfterMenu = false;
  let previousUi = gamepad.sampleUi();
  let focusBeforeMenu: HTMLElement | null = null;
  let captionTimer = 0;
  let selectedArmorSlot: ArmorSlot = "head";
  let selectedCraftArmorId = ARMOR_CATALOG.find((item) => !buildState.inventory.armor.includes(item.id))?.id ?? ARMOR_CATALOG[0].id;
  let showcasedMoveId = -1;
  let capturedScenario: CombatScenario | null = null;
  let selectedInteraction: InteractionSelection | null = null;
  let renderedTimelineMoveId = -1;
  let renderedTimelinePlayhead = -2;
  let timelinePinnedMoveId = -1;
  let interactionRenderKey = "";

  gamepad.setDeadzone(preferences.controls.stickDeadzone);
  gameAudio.setCaptionHandler(showCaption);
  gameAudio.update(preferences.audio);
  showMovePreview(activeBuild.loadout[0], true);

  const render = (now = performance.now()): void => {
    const state = sim.getState();
    const stateHash = hashState(state);
    renderer.render(state, lastReport ?? timeline.lastReport, toggles);
    panel?.update(state, sim.characters(), lastReport ?? timeline.lastReport, stateHash);
    required("frame-readout").textContent = String(state.frame).padStart(6, "0");
    required("play-state").textContent = timeline.paused ? "PAUSED" : "LIVE";
    const range = timeline.bufferedRange();
    required("timeline-status").textContent = timeline.lastMessage ?? `Frame ${state.frame} · ${timeline.paused ? "paused" : "live"} · buffer ${range.oldest}–${range.newest}`;
    required("controller-state").textContent = gamepad.connected ? `Gamepad · ${gamepad.name}` : "Keyboard ready · connect gamepad anytime";
    for (let player = 0; player < 2; player++) {
      const fighter = state.fighters[player];
      const maximum = sim.characters()[player].health;
      const percent = Math.max(0, Math.min(100, (fighter.health / maximum) * 100));
      required(`health-p${player + 1}`).style.width = `${percent}%`;
      required(`health-text-p${player + 1}`).textContent = String(fighter.health);
      renderDebuffs(player, fighter);
    }
    const move = playerCharacter.moves.find((candidate) => candidate.id === state.fighters[0].moveId);
    required("active-move").textContent = move?.key.replaceAll("_", " ") ?? "Ready";
    required("active-tags").textContent = move?.tags.join(" · ") ?? "Choose any 16 of 24 moves";
    for (const pause of mount.querySelectorAll<HTMLButtonElement>("[data-action='pause']")) pause.textContent = timeline.paused ? "Play" : "Pause";
    required("frame-inspector").innerHTML = frameInspectorMarkup(state, sim.characters(), lastReport ?? timeline.lastReport, stateHash);
    renderFrameTimeline(state.fighters[0].moveId, state.fighters[0].moveFrame);
    renderInteractionHistory();
    moveShowcase.render(now);
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
      if (reports.length > 0) {
        lastReport = reports[reports.length - 1];
        processReports(reports);
      }
    }
    render(now);
    animationId = requestAnimationFrame(loop);
  };

  const click = (event: Event): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button) return;
    gameAudio.ensure();
    gameAudio.play("confirm");
    const action = button.dataset.action;
    if (action === "pause") timeline.paused = !timeline.paused;
    if (action === "menu") openMenu();
    if (action === "close-menu") closeMenu();
    if (action === "back-10") stepFrames(-10);
    if (action === "back") stepFrames(-1);
    if (action === "forward") stepFrames(1);
    if (action === "forward-10") stepFrames(10);
    if (action === "reset") resetMatch();
    if (action === "scenario-capture") captureCurrentScenario();
    if (action === "scenario-replay") replayCapturedScenario();
    if (action === "scenario-export") exportCapturedScenario();
    if (action === "default-loadout") resetActiveLoadout();
    if (action === "craft-selected") craftSelectedArmor();
    if (action === "reset-preferences") replacePreferences(resetPreferences());
    if (button.dataset.menuTab) showTab(button.dataset.menuTab as MenuTab);
    if (button.dataset.settingsTab) showSettingsTab(button.dataset.settingsTab as SettingsTab);
    if (button.dataset.inventoryTab) showInventoryTab(button.dataset.inventoryTab as InventoryTab);
    if (button.dataset.preset !== undefined) switchPreset(Number(button.dataset.preset));
    if (button.dataset.selectAction !== undefined) selectAction(Number(button.dataset.selectAction));
    if (button.dataset.armorSlot) selectArmorSlot(button.dataset.armorSlot as ArmorSlot);
    if (button.dataset.armorItem) equipArmor(button.dataset.armorItem);
    if (button.dataset.materialItem) renderMaterialDetail(button.dataset.materialItem);
    if (button.dataset.craftItem) selectCraftArmor(button.dataset.craftItem);
    if (button.dataset.contactFrame !== undefined && button.dataset.contactIndex !== undefined) {
      inspectInteraction(Number(button.dataset.contactFrame), Number(button.dataset.contactIndex));
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
    if (target.dataset.control === "pause-on-contact" && target instanceof HTMLInputElement) timeline.pauseOnContact = target.checked;
    if (target.dataset.control === "scenario-import" && target instanceof HTMLInputElement) void importScenarioFile(target.files?.[0] ?? null);
    const debug = target.dataset.debug as keyof DebugToggles | undefined;
    if (debug) {
      toggles[debug] = (target as HTMLInputElement).checked;
      for (const control of mount.querySelectorAll<HTMLInputElement>(`[data-debug='${debug}']`)) control.checked = toggles[debug];
    }
    const slotText = target.dataset.loadoutSlot;
    if (slotText !== undefined) assignMove(Number(slotText), Number(target.value));
    if (target.dataset.prefSection && target.dataset.prefKey) updatePreference(target);
    render();
  };

  const input = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    if (target.type === "range" && target.dataset.prefSection && target.dataset.prefKey) updatePreference(target);
  };

  const previewContent = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(
      "select[data-loadout-slot], [data-move-preview], [data-armor-item], [data-material-item], [data-craft-item]",
    ) : null;
    if (!target) return;
    if (target instanceof HTMLSelectElement || target.dataset.movePreview) {
      const moveId = target instanceof HTMLSelectElement ? Number(target.value) : Number(target.dataset.movePreview);
      showMovePreview(moveId);
    } else if (target.dataset.armorItem) {
      renderArmorDetail(target.dataset.armorItem);
    } else if (target.dataset.materialItem) {
      renderMaterialDetail(target.dataset.materialItem);
    } else if (target.dataset.craftItem) {
      selectCraftArmor(target.dataset.craftItem);
    }
  };

  const keydown = (event: KeyboardEvent): void => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) gameAudio.ensure();
    if (menuOpen() && event.code === "Tab") {
      trapFocus(event);
      return;
    }
    if (menuOpen() && handleTabKey(event)) return;
    if (event.code === "Escape") {
      event.preventDefault();
      menuOpen() ? closeMenu() : openMenu();
    } else if ((event.code === "Space" || event.code === "KeyP") && !isFormControl(event.target)) {
      if (event.repeat) return;
      event.preventDefault();
      timeline.paused = !timeline.paused;
    } else if ((event.code === "Comma" || event.code === "BracketLeft") && !isFormControl(event.target)) {
      event.preventDefault();
      stepFrames(-1);
    } else if ((event.code === "Period" || event.code === "BracketRight") && !isFormControl(event.target)) {
      event.preventDefault();
      stepFrames(1);
    } else return;
    render();
  };

  const visibility = (): void => gameAudio.handleVisibility(document.hidden);
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionChange = (): void => {
    if (preferences.accessibility.motion === "system") applyPreferences(preferences);
  };

  mount.addEventListener("click", click);
  mount.addEventListener("change", change);
  mount.addEventListener("input", input);
  mount.addEventListener("pointerover", previewContent);
  mount.addEventListener("focusin", previewContent);
  window.addEventListener("keydown", keydown);
  document.addEventListener("visibilitychange", visibility);
  motionQuery.addEventListener("change", motionChange);
  if (!publicPlay) {
    void fetch("/api/lab/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((session: unknown) => {
        if (typeof session === "object" && session !== null && "username" in session && typeof session.username === "string") required("session-label").textContent = session.username;
      })
      .catch(() => undefined);
  }
  render();
  animationId = requestAnimationFrame(loop);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationId);
    window.clearTimeout(captionTimer);
    mount.removeEventListener("click", click);
    mount.removeEventListener("change", change);
    mount.removeEventListener("input", input);
    mount.removeEventListener("pointerover", previewContent);
    mount.removeEventListener("focusin", previewContent);
    window.removeEventListener("keydown", keydown);
    document.removeEventListener("visibilitychange", visibility);
    motionQuery.removeEventListener("change", motionChange);
    keyboard.dispose();
    secondKeyboard.dispose();
    renderer.dispose();
    moveShowcase.dispose();
    gameAudio.setCaptionHandler(null);
    gameAudio.dispose();
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
    focusBeforeMenu = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resumeAfterMenu = !timeline.paused;
    timeline.paused = true;
    required("menu-scrim").hidden = false;
    setGameContentInert(true);
    visibleGamepadTargets()[0]?.focus();
  }

  function closeMenu(): void {
    if (!menuOpen()) return;
    required("menu-scrim").hidden = true;
    setGameContentInert(false);
    if (resumeAfterMenu) timeline.paused = false;
    resumeAfterMenu = false;
    (focusBeforeMenu ?? mount.querySelector<HTMLButtonElement>("[data-action='menu']"))?.focus();
  }

  function setGameContentInert(inert: boolean): void {
    const scrim = required("menu-scrim");
    const main = required("game-content");
    for (const child of main.children) {
      if (child === scrim || !(child instanceof HTMLElement)) continue;
      child.inert = inert;
      if (inert) child.setAttribute("aria-hidden", "true");
      else child.removeAttribute("aria-hidden");
    }
  }

  function showTab(tab: MenuTab): void {
    activeTab = tab;
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-menu-tab]")) {
      const active = button.dataset.menuTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const page of mount.querySelectorAll<HTMLElement>("[data-menu-page]")) {
      const active = page.dataset.menuPage === tab;
      page.hidden = !active;
      page.classList.toggle("active", active);
    }
  }

  function showSettingsTab(tab: SettingsTab): void {
    activeSettingsTab = tab;
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-settings-tab]")) {
      const active = button.dataset.settingsTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const page of mount.querySelectorAll<HTMLElement>("[data-settings-panel]")) page.hidden = page.dataset.settingsPanel !== tab;
  }

  function switchPreset(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= buildState.presets.length) return;
    buildState.activePreset = index;
    activeBuild = buildState.presets[index];
    selectedArmorSlot = "head";
    rebuildActiveBuild();
    showMovePreview(activeBuild.loadout[0], true);
    const item = armorById(activeBuild.equipment[selectedArmorSlot]);
    if (item) renderArmorDetail(item.id);
  }

  function assignMove(slot: number, moveId: number): void {
    if (slot < 0 || slot >= activeBuild.loadout.length || !validMoveIds.has(moveId)) return;
    activeBuild.loadout[slot] = moveId;
    rebuildActiveBuild();
    showMovePreview(moveId, true);
  }

  function resetActiveLoadout(): void {
    activeBuild.loadout = DEFAULT_MOVE_LOADOUT.slice();
    rebuildActiveBuild();
  }

  function selectAction(slot: number): void {
    if (!Number.isInteger(slot) || slot < 0 || slot >= activeBuild.loadout.length) return;
    for (const button of mount.querySelectorAll<HTMLElement>("[data-select-action]")) button.classList.toggle("selected", Number(button.dataset.selectAction) === slot);
    const select = mount.querySelector(`[data-loadout-slot='${slot}']`) as unknown as HTMLSelectElement | null;
    showMovePreview(activeBuild.loadout[slot]);
    select?.focus();
    select?.scrollIntoView({ block: "nearest", behavior: preferences.accessibility.motion === "reduced" ? "auto" : "smooth" });
  }

  function showInventoryTab(tab: InventoryTab): void {
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-inventory-tab]")) {
      const active = button.dataset.inventoryTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const panel of mount.querySelectorAll<HTMLElement>("[data-inventory-panel]")) panel.hidden = panel.dataset.inventoryPanel !== tab;
  }

  function selectArmorSlot(slot: ArmorSlot): void {
    if (!ARMOR_SLOTS.includes(slot)) return;
    selectedArmorSlot = slot;
    for (const button of mount.querySelectorAll<HTMLElement>("[data-armor-slot]")) button.classList.toggle("selected", button.dataset.armorSlot === slot);
    const item = armorById(activeBuild.equipment[slot]);
    if (item) renderArmorDetail(item.id);
  }

  function equipArmor(itemId: string): void {
    const item = armorById(itemId);
    if (!item || !buildState.inventory.armor.includes(item.id)) return;
    selectedArmorSlot = item.slot;
    activeBuild.equipment[item.slot] = item.id;
    rebuildActiveBuild();
    renderArmorDetail(item.id);
  }

  function selectCraftArmor(itemId: string): void {
    const item = armorById(itemId);
    if (!item) return;
    selectedCraftArmorId = item.id;
    for (const button of mount.querySelectorAll<HTMLElement>("[data-craft-item]")) button.classList.toggle("selected", button.dataset.craftItem === item.id);
    required("craft-detail").innerHTML = craftDetailMarkup(item, buildState.inventory);
  }

  function craftSelectedArmor(): void {
    const item = armorById(selectedCraftArmorId);
    if (!item || !canCraftArmor(item, buildState.inventory)) return;
    for (const cost of item.recipe) buildState.inventory.materials[cost.materialId] -= cost.quantity;
    buildState.inventory.armor.push(item.id);
    persistBuildState(buildState);
    if (!mount.querySelector(`[data-armor-item='${item.id}']`)) required("armor-inventory-grid").insertAdjacentHTML("beforeend", armorInventoryButton(item));
    syncInventoryUi();
    selectCraftArmor(item.id);
  }

  function rebuildActiveBuild(): void {
    const fresh = testFighterWithBuild(activeBuild.loadout, activeBuild.equipment);
    Object.assign(playerCharacter, fresh);
    persistBuildState(buildState);
    syncBuildUi();
    if (showcasedMoveId > 0) showMovePreview(showcasedMoveId, true);
    resetMatch();
  }

  function syncBuildUi(): void {
    for (const element of mount.querySelectorAll("[data-loadout-slot]")) {
      const select = element as unknown as HTMLSelectElement;
      const slot = Number(select.dataset.loadoutSlot);
      select.value = String(activeBuild.loadout[slot]);
      const move = playerCharacter.moves.find((candidate) => candidate.id === activeBuild.loadout[slot]);
      const tags = mount.querySelector<HTMLElement>(`[data-assignment-tags='${slot}']`);
      if (tags) tags.textContent = move?.tags.slice(0, 3).join(" · ") ?? "unassigned";
      const row = select.closest<HTMLElement>("[data-move-preview]");
      if (row) row.dataset.movePreview = String(activeBuild.loadout[slot]);
      const mapped = mount.querySelector<HTMLElement>(`[data-select-action='${slot}']`);
      if (mapped) mapped.dataset.movePreview = String(activeBuild.loadout[slot]);
    }
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-preset]")) {
      const active = Number(button.dataset.preset) === buildState.activePreset;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const label of mount.querySelectorAll<HTMLElement>("[data-build-number]")) label.textContent = `BUILD ${String(buildState.activePreset + 1).padStart(2, "0")}`;
    required("character-sheet-title").textContent = activeBuild.name;
    required("stat-vitality").textContent = String(playerCharacter.health);
    required("stat-stamina").textContent = String(playerCharacter.stamina);
    required("stat-armor").textContent = String(playerCharacter.armor);
    required("stat-resist-poison").textContent = String(playerCharacter.resistances.poison);
    required("stat-resist-fire").textContent = String(playerCharacter.resistances.fire);
    required("stat-resist-frost").textContent = String(playerCharacter.resistances.frost);
    required("stat-resist-shock").textContent = String(playerCharacter.resistances.shock);
    required("skill-board").innerHTML = skillBoardMarkup(armorSkillPoints(activeBuild.equipment));
    for (const slot of ARMOR_SLOTS) {
      const item = armorById(activeBuild.equipment[slot]);
      const button = mount.querySelector<HTMLButtonElement>(`[data-armor-slot='${slot}']`);
      if (!button || !item) continue;
      button.className = `gear-slot grade-${item.grade}${selectedArmorSlot === slot ? " selected" : ""}`;
      button.setAttribute("aria-label", `${slot}: ${item.name}`);
      const icon = button.querySelector<HTMLElement>(".gear-icon");
      const name = button.querySelector<HTMLElement>("[data-equipped-name]");
      const armor = button.querySelector<HTMLElement>("[data-equipped-armor]");
      if (icon) icon.textContent = item.icon;
      if (name) name.textContent = item.name;
      if (armor) armor.textContent = `${item.armor} armor`;
    }
  }

  function syncInventoryUi(): void {
    required("owned-armor-count").textContent = String(buildState.inventory.armor.length);
    required("craft-owned-count").textContent = String(buildState.inventory.armor.length);
    for (const element of mount.querySelectorAll<HTMLElement>("[data-material-count]")) {
      const id = element.dataset.materialCount ?? "";
      element.textContent = String(buildState.inventory.materials[id] ?? 0);
    }
    for (const button of [...mount.querySelectorAll<HTMLButtonElement>("[data-craft-item]")]) {
      const item = armorById(button.dataset.craftItem ?? "");
      if (item) button.outerHTML = craftRecipeButton(item, buildState.inventory);
    }
  }

  function renderArmorDetail(itemId: string): void {
    const item = armorById(itemId);
    if (!item) return;
    required("gear-detail").innerHTML = armorDetailMarkup(item, armorById(activeBuild.equipment[item.slot]));
  }

  function renderMaterialDetail(materialId: string): void {
    const material = materialById(materialId);
    if (!material) return;
    required("gear-detail").innerHTML = materialDetailMarkup(material, buildState.inventory);
  }

  function showMovePreview(moveId: number, force = false): void {
    const move = playerCharacter.moves.find((candidate) => candidate.id === moveId);
    if (!move || (!force && showcasedMoveId === move.id)) return;
    showcasedMoveId = move.id;
    timelinePinnedMoveId = move.id;
    renderedTimelineMoveId = -1;
    moveShowcase.select(move.id);
    const hitbox = move.hitboxes[0];
    const level = hitbox?.level === HitLevel.Low ? "LOW" : hitbox?.level === HitLevel.Overhead ? "OVERHEAD" : "MID";
    required("move-showcase-code").textContent = `MOVE ${String(move.id).padStart(2, "0")} · ${level}`;
    required("move-showcase-name").textContent = move.key.replaceAll("_", " ");
    required("move-showcase-description").textContent = move.description;
    required("move-stat-damage").textContent = String(hitbox?.damage ?? 0);
    required("move-stat-startup").textContent = `${move.startup}f`;
    required("move-stat-active").textContent = `${move.active}f`;
    required("move-stat-recovery").textContent = `${move.recovery}f`;
    required("move-stat-hitstun").textContent = `${hitbox?.hitstun ?? 0}f`;
    required("move-stat-blockstun").textContent = `${hitbox?.blockstun ?? 0}f`;
    required("move-showcase-tags").innerHTML = move.tags.map((tag) => `<li>${tag}</li>`).join("");
    for (const card of mount.querySelectorAll<HTMLElement>(".move-card[data-move-preview]")) card.classList.toggle("previewing", Number(card.dataset.movePreview) === move.id);
  }

  function renderFrameTimeline(activeMoveId: number, activeMoveFrame: number): void {
    const activeMove = playerCharacter.moves.find((candidate) => candidate.id === activeMoveId);
    if (activeMove) timelinePinnedMoveId = activeMove.id;
    if (timelinePinnedMoveId < 0) timelinePinnedMoveId = showcasedMoveId;
    const move = activeMove
      ?? playerCharacter.moves.find((candidate) => candidate.id === timelinePinnedMoveId)
      ?? playerCharacter.moves[0];
    if (!move) return;

    if (renderedTimelineMoveId !== move.id) {
      required("move-timeline-console").innerHTML = moveTimelineMarkup(move);
      renderedTimelineMoveId = move.id;
      renderedTimelinePlayhead = -2;
    }

    const playhead = activeMove ? activeMoveFrame : -1;
    if (playhead === renderedTimelinePlayhead) return;
    renderedTimelinePlayhead = playhead;
    for (const cell of required("move-timeline-console").querySelectorAll<HTMLElement>("[data-frame]")) {
      cell.classList.toggle("playhead", Number(cell.dataset.frame) === playhead);
    }
  }

  function renderInteractionHistory(): void {
    const reports = timeline.contactReports();
    const key = `${reports.map((report) => `${report.frame}:${report.contacts.length}`).join(",")}|${selectedInteraction?.frame ?? "latest"}:${selectedInteraction?.index ?? 0}`;
    if (key === interactionRenderKey) return;
    interactionRenderKey = key;
    required("interaction-history").innerHTML = interactionHistoryMarkup(reports, sim.characters(), selectedInteraction);
  }

  function inspectInteraction(frame: number, index: number): void {
    const report = timeline.reportAt(frame);
    if (!report || !report.contacts[index]) return;
    timeline.paused = true;
    if (!timeline.jumpToFrame(frame + 1)) return;
    selectedInteraction = { frame, index };
    lastReport = report;
    interactionRenderKey = "";
  }

  function captureCurrentScenario(): void {
    const state = sim.getState();
    if (timeline.recordedInputs(state.frame).length !== state.frame) {
      setScenarioStatus("Reset the match before capturing: this run did not begin at frame 0.", false);
      return;
    }
    const move = playerCharacter.moves.find((candidate) => candidate.id === state.fighters[0].moveId)
      ?? playerCharacter.moves.find((candidate) => candidate.id === timelinePinnedMoveId);
    const name = `${playerCharacter.id}_${move?.key ?? "neutral"}_frame_${state.frame}`;
    capturedScenario = captureScenario(sim, timeline, name);
    setScenarioButtons(true);
    setScenarioStatus(`Captured ${state.frame} frames · ${capturedScenario.expected.contacts.length} contacts · expected ${capturedScenario.expected.hash}`, true);
  }

  function replayCapturedScenario(): void {
    if (!capturedScenario) return;
    try {
      const result = replayScenario(sim, timeline, capturedScenario);
      lastReport = timeline.lastReport;
      selectedInteraction = null;
      interactionRenderKey = "";
      setScenarioStatus(
        result.matches
          ? `PASS · ${result.reports} frames reproduced hash ${result.actualHash}`
          : `FAIL · expected ${result.expectedHash}, received ${result.actualHash} at frame ${result.stateFrame}`,
        result.matches,
      );
    } catch (error) {
      setScenarioStatus(error instanceof Error ? error.message : "Scenario replay failed.", false);
    }
  }

  function exportCapturedScenario(): void {
    if (!capturedScenario) return;
    const href = URL.createObjectURL(new Blob([scenarioJson(capturedScenario)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `${capturedScenario.name}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
    setScenarioStatus(`Exported ${link.download}`, true);
  }

  async function importScenarioFile(file: File | null): Promise<void> {
    if (!file) return;
    try {
      capturedScenario = parseScenario(JSON.parse(await file.text()) as unknown);
      setScenarioButtons(true);
      setScenarioStatus(`Imported ${capturedScenario.name} · ${capturedScenario.inputs.length} frames · expected ${capturedScenario.expected.hash}`, true);
    } catch (error) {
      capturedScenario = null;
      setScenarioButtons(false);
      setScenarioStatus(error instanceof Error ? error.message : "Scenario import failed.", false);
    }
  }

  function setScenarioButtons(enabled: boolean): void {
    for (const action of ["scenario-replay", "scenario-export"]) {
      const button = mount.querySelector<HTMLButtonElement>(`[data-action='${action}']`);
      if (button) button.disabled = !enabled;
    }
  }

  function setScenarioStatus(message: string, success: boolean): void {
    const status = required("scenario-status");
    status.textContent = message;
    status.classList.toggle("pass", success);
    status.classList.toggle("fail", !success);
  }

  function updatePreference(target: HTMLInputElement | HTMLSelectElement): void {
    const section = target.dataset.prefSection as keyof LabPreferences;
    const key = target.dataset.prefKey;
    if (!key || !(section in preferences)) return;
    const value: unknown = target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked
      : target.dataset.prefNumber !== undefined ? Number(target.value) : target.value;
    const record = preferences[section] as unknown as Record<string, unknown>;
    record[key] = value;
    persistPreferences(preferences);
    applyPreferences(preferences);
    gameAudio.update(preferences.audio);
    gamepad.setDeadzone(preferences.controls.stickDeadzone);
    const output = mount.querySelector<HTMLOutputElement>(`[data-pref-output='${section}.${key}']`);
    if (output && target instanceof HTMLInputElement) {
      const percent = Math.round(Number(target.value) * 100);
      output.value = `${percent}%`;
      target.setAttribute("aria-valuetext", `${percent}%`);
    }
  }

  function replacePreferences(next: LabPreferences): void {
    for (const section of Object.keys(next) as (keyof LabPreferences)[]) Object.assign(preferences[section], next[section]);
    applyPreferences(preferences);
    gameAudio.update(preferences.audio);
    gamepad.setDeadzone(preferences.controls.stickDeadzone);
    for (const element of mount.querySelectorAll("[data-pref-section][data-pref-key]")) {
      const target = element as unknown as HTMLInputElement | HTMLSelectElement;
      const section = target.dataset.prefSection as keyof LabPreferences;
      const key = target.dataset.prefKey ?? "";
      const value = (preferences[section] as unknown as Record<string, unknown>)[key];
      if (target instanceof HTMLInputElement && target.type === "checkbox") target.checked = Boolean(value);
      else target.value = String(value);
      if (target instanceof HTMLInputElement && target.type === "range") {
        const percent = Math.round(Number(target.value) * 100);
        const output = mount.querySelector<HTMLOutputElement>(`[data-pref-output='${section}.${key}']`);
        if (output) output.value = `${percent}%`;
        target.setAttribute("aria-valuetext", `${percent}%`);
      }
    }
  }

  function resetMatch(): void {
    timeline.reset();
    dummy.reset();
    lastReport = null;
    selectedInteraction = null;
    interactionRenderKey = "";
  }

  function stepFrames(count: number): void {
    timeline.paused = true;
    const reports = timeline.stepFrames(count);
    lastReport = timeline.lastReport;
    if (reports.length > 0) processReports(reports);
    interactionRenderKey = "";
  }

  function processReports(reports: readonly FrameReport[]): void {
    const announcements: string[] = [];
    for (const report of reports) {
      for (const contact of report.contacts) {
        gameAudio.play(contact.kind === ContactKind.Hit ? "hit" : "block");
        if (contact.kind === ContactKind.Hit) gamepad.rumble(preferences.controls.vibration, 95);
        announcements.push(contact.kind === ContactKind.Hit ? `Player ${contact.attacker + 1} hits for ${contact.damage}.` : `Player ${contact.defender + 1} blocks.`);
      }
      for (const event of report.debuffs) {
        if (event.kind === DebuffEventKind.Applied || event.kind === DebuffEventKind.Triggered) gameAudio.play(cueForDebuff(event.debuff));
        if (event.kind !== DebuffEventKind.Tick) {
          const rule = STATUS_RULES.find((candidate) => candidate.debuff === event.debuff);
          announcements.push(`${rule?.name ?? "Status"} ${event.stacks} stack${event.stacks === 1 ? "" : "s"} on player ${event.target + 1}.`);
        }
      }
    }
    if (preferences.accessibility.screenReaderCombat && announcements.length > 0) required("combat-announcer").textContent = announcements.slice(-3).join(" ");
  }

  function renderDebuffs(player: number, fighter: FighterState): void {
    const statuses = [
      ["burn", fighter.burnStacks, fighter.burnFrames], ["poison", fighter.poisonStacks, fighter.poisonFrames],
      ["freeze", fighter.freezeStacks, fighter.freezeFrames], ["shock", fighter.shockStacks, fighter.shockFrames],
      ["bleed", fighter.bleedStacks, fighter.bleedFrames],
    ] as const;
    const active = statuses.filter(([, stacks, frames]) => stacks > 0 && frames > 0);
    const lane = required(`debuff-p${player + 1}`);
    lane.innerHTML = active.map(([tag, stacks, frames]) => `<span class="debuff-chip status-${tag}"><i aria-hidden="true">${STATUS_RULES.find((rule) => rule.tag === tag)?.glyph ?? "?"}</i><b>${tag}</b><em>×${stacks}</em><small>${Math.ceil(frames / 60)}s</small></span>`).join("");
    lane.setAttribute("aria-label", active.length > 0 ? active.map(([tag, stacks]) => `${tag}, ${stacks} stacks`).join("; ") : "No active debuffs");
  }

  function showCaption(text: string): void {
    const caption = required("audio-caption");
    caption.textContent = text;
    caption.hidden = false;
    window.clearTimeout(captionTimer);
    captionTimer = window.setTimeout(() => { caption.hidden = true; }, 1250);
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
    return [...mount.querySelectorAll<HTMLElement>("[data-gamepad-nav]")].filter((element) => !element.closest("[hidden]") && !(element instanceof HTMLButtonElement && element.disabled));
  }

  function focusGamepadTarget(delta: number): void {
    const targets = visibleGamepadTargets();
    if (targets.length === 0) return;
    const current = document.activeElement instanceof HTMLElement ? targets.findIndex((target) => target === document.activeElement || target.contains(document.activeElement)) : -1;
    const raw = current + delta;
    const next = preferences.controls.menuWrap ? (raw + targets.length) % targets.length : Math.max(0, Math.min(targets.length - 1, raw));
    targets[next]?.focus();
    gameAudio.play("navigate");
  }

  function adjustFocused(delta: number): void {
    const active = document.activeElement;
    const select = active instanceof HTMLSelectElement ? active : active instanceof HTMLElement ? active.querySelector("select") : null;
    if (select) {
      select.selectedIndex = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + delta));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    const range = active instanceof HTMLInputElement && active.type === "range" ? active : active instanceof HTMLElement ? active.querySelector<HTMLInputElement>("input[type='range']") : null;
    if (range) {
      const step = Number(range.step) || 1;
      range.value = String(Math.max(Number(range.min), Math.min(Number(range.max), Number(range.value) + step * delta)));
      range.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const checkbox = active instanceof HTMLInputElement && active.type === "checkbox" ? active : active instanceof HTMLElement ? active.querySelector<HTMLInputElement>("input[type='checkbox']") : null;
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
    const tabs = [...mount.querySelectorAll<HTMLElement>("[data-menu-tab]")]
      .map((tab) => tab.dataset.menuTab)
      .filter((tab): tab is MenuTab => tab !== undefined);
    const index = tabs.indexOf(activeTab);
    showTab(tabs[(index + delta + tabs.length) % tabs.length]);
    mount.querySelector<HTMLButtonElement>(`[data-menu-tab='${activeTab}']`)?.focus();
  }

  function handleTabKey(event: KeyboardEvent): boolean {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.code)) return false;
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[role='tab']") : null;
    if (!target) return false;
    event.preventDefault();
    const settings = target.dataset.settingsTab !== undefined;
    const inventory = target.dataset.inventoryTab !== undefined;
    const tabs = settings
      ? [...mount.querySelectorAll<HTMLButtonElement>("[data-settings-tab]")]
      : inventory ? [...mount.querySelectorAll<HTMLButtonElement>("[data-inventory-tab]")]
        : [...mount.querySelectorAll<HTMLButtonElement>("[data-menu-tab]")];
    const index = tabs.indexOf(target);
    const next = event.code === "Home" ? 0 : event.code === "End" ? tabs.length - 1 : (index + (event.code === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const button = tabs[next];
    if (settings) showSettingsTab(button.dataset.settingsTab as SettingsTab);
    else if (inventory) showInventoryTab(button.dataset.inventoryTab as InventoryTab);
    else showTab(button.dataset.menuTab as MenuTab);
    button.focus();
    return true;
  }

  function trapFocus(event: KeyboardEvent): void {
    const dialog = required("lab-menu");
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => !element.closest("[hidden]") && !element.inert);
    if (items.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !(active instanceof Node) || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !(active instanceof Node) || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }
}

function isFormControl(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function cueForDebuff(debuff: number): "burn" | "poison" | "freeze" | "shock" | "bleed" {
  if (debuff === DebuffKind.Burn) return "burn";
  if (debuff === DebuffKind.Poison) return "poison";
  if (debuff === DebuffKind.Freeze) return "freeze";
  if (debuff === DebuffKind.Shock) return "shock";
  return "bleed";
}
