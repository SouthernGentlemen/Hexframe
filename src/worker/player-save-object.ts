import { ARMOR_CATALOG, armorById, canCraftArmor } from "../content/armor";
import type { ArmorSlot } from "../content/armor";
import { BLACK_BELFRY } from "../content/black-belfry";
import { EntityKind, InteractableKind } from "../combat/types";
import { MoveId } from "../content/test-fighter";
import { createDefaultPlayerSave, normalizePlayerSave } from "../player/save";
import type { PlayerSave } from "../player/save";
import type { Env } from "./env";

const SAVE_KEY = "player-save";

export class PlayerSaveObject implements DurableObject {
  constructor(private readonly ctx: DurableObjectState, private readonly env: Env) {
    void this.env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const current = await this.load();

    if (request.method === "GET" && url.pathname === "/api/save") return json(current, 200);
    if (request.method === "PUT" && url.pathname === "/api/save") return this.updateProfile(request, current);
    if (request.method === "POST" && url.pathname === "/api/save/progression/boss") return this.claimBoss(request, current);
    if (request.method === "POST" && url.pathname === "/api/save/progression/stage-event") return this.applyStageEvent(request, current);
    if (request.method === "POST" && url.pathname === "/api/save/armory/craft") return this.craft(request, current);
    if (request.method === "POST" && url.pathname === "/api/save/campaign/reset") return this.resetCampaign(request, current);
    return json({ error: "not_found" }, 404);
  }

  private async load(): Promise<PlayerSave> {
    const saved = await this.ctx.storage.get<unknown>(SAVE_KEY);
    if (saved) return normalizePlayerSave(saved);
    const created = createDefaultPlayerSave();
    await this.ctx.storage.put(SAVE_KEY, created);
    return created;
  }

  private async updateProfile(request: Request, current: PlayerSave): Promise<Response> {
    const raw = await body(request);
    if (raw === null) return json({ error: "invalid_json" }, 400);
    const proposed = normalizePlayerSave(raw);
    if (proposed.revision !== current.revision) return json({ error: "revision_conflict", save: current }, 409);

    // Profile presentation and loadout choices are player-authored. Progression, gear
    // ownership, unlocks and checkpoints stay behind explicit server operations.
    current.loadouts.activeId = proposed.loadouts.activeId;
    current.loadouts.order = proposed.loadouts.order;
    for (const id of current.loadouts.order) {
      const before = current.loadouts.byId[id];
      const candidate = proposed.loadouts.byId[id];
      current.loadouts.byId[id] = {
        name: candidate.name,
        loadout: candidate.loadout.map((moveId, index) => (
          moveId === 0 || current.unlocks.moves.includes(moveId) ? moveId : before.loadout[index]
        )),
        equipment: sanitizeEquipment(candidate.equipment, before.equipment, current.inventory.armor),
      };
    }
    current.campaign.tutorialComplete = proposed.campaign.tutorialComplete;
    if (
      current.unlocks.stages.includes(proposed.campaign.currentStageId)
      && current.campaign.stages[proposed.campaign.currentStageId]?.unlocked
    ) {
      current.campaign.currentStageId = proposed.campaign.currentStageId;
    }
    return this.commit(current);
  }

  private async claimBoss(request: Request, current: PlayerSave): Promise<Response> {
    const raw = await recordBody(request);
    if (!raw) return json({ error: "invalid_json" }, 400);
    if (raw.revision !== current.revision) return json({ error: "revision_conflict", save: current }, 409);
    if (raw.stageId !== "black-belfry" || raw.bossId !== "bell-warden") return json({ error: "unknown_boss" }, 400);
    const stage = current.campaign.stages["black-belfry"];
    if (!stage) return json({ error: "unknown_stage" }, 400);
    if (stage.rewardsClaimed.includes("bell-warden")) return json({ ok: true, alreadyClaimed: true, save: current }, 200);

    stage.completedBosses.push("bell-warden");
    stage.rewardsClaimed.push("bell-warden");
    stage.status = "complete";
    addUnique(current.unlocks.moves, MoveId.GraveToll);
    addUnique(current.unlocks.recipes, "warden-arms");
    current.inventory.materials["warden-core"] = (current.inventory.materials["warden-core"] ?? 0) + 1;
    current.inventory.materials.stormglass = (current.inventory.materials.stormglass ?? 0) + 4;
    current.inventory.materials["iron-scrap"] = (current.inventory.materials["iron-scrap"] ?? 0) + 6;
    return this.commit(current, { ok: true, alreadyClaimed: false });
  }

  private async applyStageEvent(request: Request, current: PlayerSave): Promise<Response> {
    const raw = await recordBody(request);
    if (!raw) return json({ error: "invalid_json" }, 400);
    if (raw.revision !== current.revision) return json({ error: "revision_conflict", save: current }, 409);
    if (raw.stageId !== "black-belfry" || !Number.isSafeInteger(raw.entityId)) return json({ error: "unknown_stage_event" }, 400);
    const entityId = Number(raw.entityId);
    const stage = current.campaign.stages["black-belfry"];
    if (!stage) return json({ error: "unknown_stage" }, 400);
    const eventKey = `entity:${entityId}`;
    if (stage.discovered.includes(eventKey)) return json({ ok: true, alreadyApplied: true, save: current }, 200);

    const entity = [...BLACK_BELFRY.breakables, ...BLACK_BELFRY.interactables].find((candidate) => candidate.id === entityId);
    if (!entity) return json({ error: "unknown_stage_event" }, 400);
    if (entity.kind === EntityKind.Breakable) {
      const material = entity.owner === 0 ? "iron-scrap" : entity.owner === 1 ? "grave-thread" : entity.owner === 2 ? "stormglass" : entity.owner === 3 ? "warden-core" : null;
      if (!material) return json({ error: "unknown_stage_event" }, 400);
      current.inventory.materials[material] = (current.inventory.materials[material] ?? 0) + entity.value;
    } else if (entity.owner === InteractableKind.Chest) {
      current.inventory.materials.stormglass = (current.inventory.materials.stormglass ?? 0) + 2;
      current.inventory.materials["iron-scrap"] = (current.inventory.materials["iron-scrap"] ?? 0) + 2;
    } else if (entity.owner === InteractableKind.Checkpoint) {
      stage.checkpointId = entity.id;
    } else {
      return json({ error: "unsupported_stage_event" }, 400);
    }
    stage.discovered.push(eventKey);
    return this.commit(current, { ok: true, alreadyApplied: false });
  }

  private async craft(request: Request, current: PlayerSave): Promise<Response> {
    const raw = await recordBody(request);
    if (!raw) return json({ error: "invalid_json" }, 400);
    if (raw.revision !== current.revision) return json({ error: "revision_conflict", save: current }, 409);
    if (typeof raw.armorId !== "string") return json({ error: "unknown_recipe" }, 400);
    const item = armorById(raw.armorId);
    if (!item || !ARMOR_CATALOG.includes(item) || !current.unlocks.recipes.includes(item.id)) return json({ error: "unknown_recipe" }, 400);
    if (current.inventory.armor.includes(item.id)) return json({ ok: true, alreadyOwned: true, save: current }, 200);
    if (!canCraftArmor(item, current.inventory)) return json({ error: "insufficient_materials", save: current }, 409);
    for (const cost of item.recipe) current.inventory.materials[cost.materialId] -= cost.quantity;
    current.inventory.armor.push(item.id);
    return this.commit(current, { ok: true, alreadyOwned: false });
  }

  private async resetCampaign(request: Request, current: PlayerSave): Promise<Response> {
    const raw = await recordBody(request);
    if (!raw) return json({ error: "invalid_json" }, 400);
    if (raw.revision !== current.revision) return json({ error: "revision_conflict", save: current }, 409);
    const fresh = createDefaultPlayerSave();
    fresh.revision = current.revision;
    return this.commit(fresh, { ok: true });
  }

  private async commit(save: PlayerSave, extra: Record<string, unknown> = {}): Promise<Response> {
    save.revision++;
    await this.ctx.storage.put(SAVE_KEY, save);
    return json({ ...extra, save }, 200);
  }
}

async function body(request: Request): Promise<unknown | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > 64_000) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function recordBody(request: Request): Promise<Record<string, unknown> | null> {
  const parsed = await body(request);
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
}

function addUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value);
}

function sanitizeEquipment(
  proposed: Readonly<Record<ArmorSlot, string>>,
  current: Readonly<Record<ArmorSlot, string>>,
  owned: readonly string[],
): Record<ArmorSlot, string> {
  const next = { ...current };
  for (const slot of ["head", "chest", "arms", "waist", "legs"] as const) {
    const itemId = proposed[slot];
    if (itemId === "" || (typeof itemId === "string" && owned.includes(itemId))) next[slot] = itemId;
  }
  return next;
}

function json(value: unknown, status: number): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}
