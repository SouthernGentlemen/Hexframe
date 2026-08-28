import { describe, expect, it } from "vitest";

import { armorById, equipmentForSet } from "../../src/content/armor";
import { armorDetailMarkup } from "../../src/lab/view";

describe("armor item details", () => {
  it("explains threshold effects and prospective three-piece set progress", () => {
    const item = armorById("stormglass-chest")!;
    const equipment = equipmentForSet("gravecloth");
    equipment.head = "stormglass-head";

    const markup = armorDetailMarkup(item, armorById(equipment.chest), equipment);
    expect(markup).toContain("Conductive crystal mail designed to accumulate");
    expect(markup).toContain("+10 shock resistance");
    expect(markup).toContain("+25 shock resistance");
    expect(markup).toContain("Static Conductor");
    expect(markup).toContain("2 / 3");
    expect(markup).toContain("Maximum shock stacks +1");
  });
});
