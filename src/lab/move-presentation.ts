import { toPixels } from "../combat/constants";
import type { CharacterDef, MoveDef } from "../combat/types";
import { HitLevel, InvulKind } from "../combat/types";
import { ACTION_SLOT_LABELS } from "../input/action-layout";
import { STATUS_RULES } from "../content/status-rules";
import { deriveMoveFrameData, movePhase } from "./inspector";

export const ACTION_BANKS = [
  { name: "Neutral", role: "Normals / neutral", input: "Base" },
  { name: "Setup", role: "Mobility / setup", input: "LT" },
  { name: "Power", role: "Power / specials", input: "RT" },
  { name: "Finale", role: "Finishers / utility", input: "LT+RT" },
] as const;

export const MOVE_ROLES = ["starter", "link", "cashout", "reversal"] as const;
export const MOVE_FAMILIES = ["fire", "poison", "freeze", "shock", "bleed", "void"] as const;

export type MoveRole = (typeof MOVE_ROLES)[number];
export type MoveFamily = (typeof MOVE_FAMILIES)[number];

const ROLE_RANK: Record<MoveRole, number> = { starter: 0, link: 1, cashout: 2, reversal: 3 };

export function moveName(move: MoveDef): string {
  return move.key.replaceAll("_", " ");
}

export function primaryHitbox(move: MoveDef): MoveDef["hitboxes"][number] | undefined {
  return move.hitboxes[0];
}

export function primaryDamage(move: MoveDef): number {
  return primaryHitbox(move)?.damage ?? 0;
}

export function moveRole(move: MoveDef): MoveRole {
  return MOVE_ROLES.find((role) => move.tags.includes(role)) ?? "starter";
}

export function moveFamilies(move: MoveDef): MoveFamily[] {
  return MOVE_FAMILIES.filter((family) => move.tags.includes(family));
}

export function moveTerrain(move: MoveDef): "air" | "ground" {
  return move.airOk ? "air" : "ground";
}

export function moveLevel(move: MoveDef): "low" | "overhead" | "mid" {
  const level = primaryHitbox(move)?.level;
  if (level === HitLevel.Low) return "low";
  if (level === HitLevel.Overhead) return "overhead";
  return "mid";
}

export function actionSlotLabel(slot: number): string {
  const label = ACTION_SLOT_LABELS[slot];
  const bank = ACTION_BANKS[Math.trunc(slot / 4)];
  if (!label || !bank) return `Slot ${slot + 1}`;
  return `${bank.name} / ${label.gamepad}`;
}

export function actionSlotInput(slot: number): string {
  const label = ACTION_SLOT_LABELS[slot];
  return label ? `${label.gamepad} · ${label.keyboard}` : `Slot ${slot + 1}`;
}

export function equippedSlots(loadout: readonly number[], moveId: number): number[] {
  const slots: number[] = [];
  loadout.forEach((equippedMoveId, slot) => {
    if (equippedMoveId === moveId) slots.push(slot);
  });
  return slots;
}

export function equippedSummary(loadout: readonly number[], moveId: number): string {
  const slots = equippedSlots(loadout, moveId);
  if (slots.length === 0) return "NOT EQUIPPED";
  return `EQUIPPED × ${slots.length} · ${slots.map(actionSlotLabel).join(" · ")}`;
}

/** Follows the authored cancel graph around one move instead of maintaining a second route table. */
export function routeForMove(move: MoveDef, character: CharacterDef): MoveDef[] {
  const byId = new Map(character.moves.map((candidate) => [candidate.id, candidate]));
  const incoming = (target: MoveDef): MoveDef[] => character.moves.filter((candidate) =>
    candidate.cancelWindows.some((window) => window.into.includes(target.id)),
  );
  const outgoing = (source: MoveDef): MoveDef[] => [...new Set(source.cancelWindows.flatMap((window) => window.into))]
    .map((id) => byId.get(id))
    .filter((candidate): candidate is MoveDef => candidate !== undefined);
  const familyScore = (candidate: MoveDef, reference: MoveDef): number =>
    moveFamilies(candidate).filter((family) => moveFamilies(reference).includes(family)).length;
  const chooseIncoming = (target: MoveDef): MoveDef | undefined => incoming(target)
    .sort((a, b) => {
      const lowerA = ROLE_RANK[moveRole(a)] < ROLE_RANK[moveRole(target)] ? 1 : 0;
      const lowerB = ROLE_RANK[moveRole(b)] < ROLE_RANK[moveRole(target)] ? 1 : 0;
      return lowerB - lowerA || familyScore(b, target) - familyScore(a, target) || b.id - a.id;
    })[0];
  const chooseOutgoing = (source: MoveDef, seen: ReadonlySet<number>): MoveDef | undefined => outgoing(source)
    .filter((candidate) => !seen.has(candidate.id))
    .sort((a, b) => {
      const advanceA = ROLE_RANK[moveRole(a)] > ROLE_RANK[moveRole(source)] ? 1 : 0;
      const advanceB = ROLE_RANK[moveRole(b)] > ROLE_RANK[moveRole(source)] ? 1 : 0;
      return advanceB - advanceA || familyScore(b, source) - familyScore(a, source) || a.id - b.id;
    })[0];

  const before: MoveDef[] = [];
  let cursor = move;
  while (before.length < 2 && moveRole(cursor) !== "starter") {
    const previous = chooseIncoming(cursor);
    if (!previous || previous.id === move.id || before.some((candidate) => candidate.id === previous.id)) break;
    before.unshift(previous);
    cursor = previous;
  }

  const route = [...before, move];
  const seen = new Set(route.map((candidate) => candidate.id));
  cursor = move;
  while (route.length < 4) {
    const next = chooseOutgoing(cursor, seen);
    if (!next) break;
    route.push(next);
    seen.add(next.id);
    cursor = next;
  }
  return route;
}

export function routeTopologyMarkup(move: MoveDef, character: CharacterDef, loadout: readonly number[]): string {
  const route = routeForMove(move, character);
  const routeIds = route.slice(0, 3).map((candidate) => candidate.id).join(",");
  return `<section class="route-topology" aria-label="Authored route containing ${escapeHtml(moveName(move))}">
    <header><span>AUTHORED ROUTE</span><em>${route.every((candidate) => equippedSlots(loadout, candidate.id).length > 0) ? "COMPLETE" : "INCOMPLETE"}</em></header>
    <div>${route.map((candidate, index) => {
      const slots = equippedSlots(loadout, candidate.id);
      const active = candidate.id === move.id;
      return `${index === 0 ? "" : '<i aria-hidden="true">↓</i>'}<article class="${active ? "selected" : ""}"><b>${escapeHtml(moveName(candidate))}</b><span>${slots.length > 0 ? `✓ ${slots.map(actionSlotLabel).join(" · ")}` : "✕ NOT EQUIPPED"}</span></article>`;
    }).join("")}</div>
    ${route.length >= 2 ? `<footer class="equip-route"><button type="button" data-gamepad-nav data-equip-route="${routeIds}">Equip route</button><div data-equip-route-chooser hidden><span>CHOOSE DIRECTION</span>${["↑ / Y", "← / X", "→ / B", "↓ / A"].map((label, column) => `<button type="button" data-gamepad-nav data-equip-route-column="${column}" data-route-moves="${routeIds}">${label}</button>`).join("")}</div></footer>` : ""}
  </section>`;
}

export function describeMoveFrame(move: MoveDef, frame: number, character?: CharacterDef): string {
  const hitboxes = move.hitboxes.filter((hitbox) => frame >= hitbox.startFrame && frame <= hitbox.endFrame);
  const cancels = move.cancelWindows.filter((window) => frame >= window.startFrame && frame <= window.endFrame);
  const invul = move.invulWindows.filter((window) => frame >= window.startFrame && frame <= window.endFrame);
  const armor = move.armorWindows.filter((window) => frame >= window.startFrame && frame <= window.endFrame);
  const movement = move.movement.filter((key) => key.frame === frame);
  const names = new Map(character?.moves.map((candidate) => [candidate.id, moveName(candidate)]) ?? []);
  const lines = [`FRAME ${String(frame + 1).padStart(2, "0")} · ${movePhase(move, frame)}`];
  if (hitboxes.length > 0) lines.push(...hitboxes.map((hitbox) =>
    `Hitbox: x ${toPixels(hitbox.box.x)}–${toPixels(hitbox.box.x + hitbox.box.w)}, y ${toPixels(hitbox.box.y)}–${toPixels(hitbox.box.y + hitbox.box.h)}`,
  ));
  else lines.push("Hitbox: none");
  if (cancels.length > 0) lines.push(`Cancel: ${cancels.flatMap((window) => window.into).map((id) => names.get(id) ?? `move ${id}`).join(", ")}`);
  else lines.push("Cancel: none");
  if (invul.length > 0) lines.push(`Invulnerability: ${invul.map((window) => invulName(window.kind)).join(", ")}`);
  if (armor.length > 0) lines.push(`Armor: ${Math.max(...armor.map((window) => window.hits))} hit`);
  if (movement.length > 0) lines.push(...movement.map((key) => `Movement: ${signed(toPixels(key.vx))} forward · ${signed(toPixels(key.vy))} vertical`));
  return lines.join("\n");
}

export function codexMoveDetailMarkup(move: MoveDef, character: CharacterDef, loadout: readonly number[]): string {
  const hitbox = primaryHitbox(move);
  const frameData = deriveMoveFrameData(move);
  const role = moveRole(move);
  const families = moveFamilies(move);
  const cancelIds = [...new Set(move.cancelWindows.flatMap((window) => window.into))];
  const cancelsFrom = character.moves.filter((candidate) => candidate.cancelWindows.some((window) => window.into.includes(move.id)));
  const statuses = STATUS_RULES.filter((rule) => move.tags.includes(rule.tag));
  const movement = move.movement.length > 0
    ? move.movement.map((key) => `F${key.frame + 1}: ${signed(toPixels(key.vx))} forward / ${signed(toPixels(key.vy))} vertical`).join(" · ")
    : "None";
  const launch = hitbox && hitbox.launchVelocityY > 0 ? `${toPixels(hitbox.launchVelocityY)} upward` : "None";
  const armor = move.armorWindows.length > 0 ? move.armorWindows.map((window) => `${window.hits} hit · F${window.startFrame + 1}–${window.endFrame + 1}`).join(" · ") : "None";
  const invul = move.invulWindows.length > 0 ? move.invulWindows.map((window) => `${invulName(window.kind)} · F${window.startFrame + 1}–${window.endFrame + 1}`).join(" · ") : "None";
  const route = routeForMove(move, character);

  return `<header class="codex-detail-heading"><div><p>${role.toUpperCase()} · ${(families.length > 0 ? families : ["PHYSICAL"]).join(" · ").toUpperCase()}</p><h2>${escapeHtml(moveName(move))}</h2><span>${escapeHtml(move.description)}</span></div><strong data-equipped-move="${move.id}">${equippedSummary(loadout, move.id)}</strong></header>
    <div class="codex-detail-groups">
      ${detailGroup("IDENTITY", [
        ["Input / bank", equippedSlots(loadout, move.id).map((slot) => `${actionSlotLabel(slot)} (${actionSlotInput(slot)})`).join(" · ") || "Not equipped"],
        ["Ground / air", move.airOk ? "Air" : move.requiresCrouch ? "Ground · crouching" : "Ground"],
        ["Attack level", moveLevel(move)],
        ["Stamina", String(move.staminaCost)],
        ["Tags", move.tags.join(" · ")],
      ])}
      ${detailGroup("FRAME DATA", [
        ["Startup", `${frameData.startup}f`], ["Active", `${frameData.active}f`], ["Recovery", `${frameData.recovery}f`], ["Total", `${move.duration}f`],
        ["Armor", armor], ["Invulnerability", invul], ["Movement", movement],
      ])}
      ${detailGroup("INTERACTION", [
        ["Damage", String(hitbox?.damage ?? 0)], ["Hitstun", `${hitbox?.hitstun ?? 0}f`], ["Blockstun", `${hitbox?.blockstun ?? 0}f`],
        ["Hitstop", `${hitbox?.hitstopAttacker ?? 0}f / ${hitbox?.hitstopDefender ?? 0}f`],
        ["Pushback", hitbox ? `${signed(toPixels(hitbox.pushbackHitAttacker))} / ${signed(toPixels(hitbox.pushbackHitDefender))}` : "None"],
        ["Launch", launch], ["Status", statuses.map((rule) => `${rule.name}: ${rule.primer}`).join(" · ") || "None"],
      ])}
      ${detailGroup("ROUTE", [
        ["Role", role], ["Family", families.join(" · ") || "Universal"],
        ["Cancels into", cancelIds.map((id) => moveName(character.moves.find((candidate) => candidate.id === id) ?? move)).join(" · ") || "None"],
        ["Cancels from", cancelsFrom.map(moveName).join(" · ") || "None"],
        ["Recommended", route.map(moveName).join(" → ")],
        ["Equipped", equippedSummary(loadout, move.id)],
      ])}
    </div>
    ${routeTopologyMarkup(move, character, loadout)}`;
}

function detailGroup(title: string, rows: readonly (readonly [string, string])[]): string {
  return `<section><h3>${title}</h3><dl>${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></section>`;
}

function invulName(kind: number): string {
  if (kind === InvulKind.Full) return "Full";
  if (kind === InvulKind.Throw) return "Throw";
  return "Strike";
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
