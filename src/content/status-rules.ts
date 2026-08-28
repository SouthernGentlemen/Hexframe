import { DebuffKind } from "../combat/types";

export interface StatusRule {
  tag: "burn" | "poison" | "freeze" | "shock" | "bleed";
  name: string;
  glyph: string;
  debuff: (typeof DebuffKind)[keyof typeof DebuffKind];
  primer: string;
  payoff: string;
  maxStacks: number;
}

export const STATUS_RULES: readonly StatusRule[] = [
  { tag: "burn", name: "Burn", glyph: "B", debuff: DebuffKind.Burn, primer: "Deals damage over time for 1.5 seconds and stacks three times.", payoff: "Another burn move scorches for +4 damage per active stack, then refreshes it.", maxStacks: 3 },
  { tag: "poison", name: "Poison", glyph: "P", debuff: DebuffKind.Poison, primer: "Stacks up to five times; every stack increases the next poison tick.", payoff: "Link several fast poison attacks before the six-second decay window closes.", maxStacks: 5 },
  { tag: "freeze", name: "Freeze", glyph: "F", debuff: DebuffKind.Freeze, primer: "One stack chills movement, two stacks slow it further, three stacks freeze for 0.4 seconds.", payoff: "Freeze-tagged follow-ups gain +3 damage per cold stack and refresh the setup.", maxStacks: 3 },
  { tag: "shock", name: "Shock", glyph: "S", debuff: DebuffKind.Shock, primer: "Marks the target with up to three voltage stacks for three seconds.", payoff: "The next direct hit consumes shock for +8% damage per stack, rewarding a heavy finisher.", maxStacks: 3 },
  { tag: "bleed", name: "Bleed", glyph: "L", debuff: DebuffKind.Bleed, primer: "Deals movement-triggered damage and stacks three times.", payoff: "An execute-tagged move consumes every stack for +8 damage each.", maxStacks: 3 },
];

export function statusRuleFor(tag: string): StatusRule | null {
  return STATUS_RULES.find((rule) => rule.tag === tag) ?? null;
}
