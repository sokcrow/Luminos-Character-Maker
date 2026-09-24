# Tool System Handoff

This document records the approved Tool-system contract already integrated in `js/item-catalog-tools.js`, the Craft / Industrial Component layer now integrated in `js/item-catalog-craft-components.js`, and the work intentionally left for later passes.

## Integrated Tool rules

### Tool requirement and improvisation

Every Craft declares a required Tool type. A correct Tool permits the Craft at its normal Threshold.

If the actor does not have the required Tool but has a physically plausible object with which to improvise, the Craft may still be attempted at **TH +3**.

A physically unsuitable object does not permit the attempt. A weapon or other physical item may serve as an improvised work implement when its construction makes sense for the task; this does not turn that weapon into a specialized Tool item.

The current resolver is `LuminousToolCatalog.resolveToolCheck()`.

### Tool Check Power

The approved contract is:

`Tool Check Power = associated Skill Power + Tool Base Power + Tool Proficiency Power + other modifiers`

Current catalog behavior:

- possessing the correct Tool does not require Tool Proficiency;
- the correct Tool contributes its Tool Base Power;
- Tool Proficiency contributes only when the character has proficiency with that Tool type;
- improvisation adds +3 TH;
- an improvised object contributes **0 Tool Base Power**;
- Tool Proficiency may still contribute while improvising because the character retains the knowledge even without the professional Tool;
- if there is no valid Tool and no plausible improvisation, the action is blocked.

### Quality

Tools use the universal Item Quality system. Final Quality of a crafted Tool comes from the Craft Check, not automatically from ingredient Quality.

`baseToolPower` is intentionally `null` in the current catalog. The Tool Power scale has **not** been approved yet and must not be invented during unrelated work.

## Integrated Tool catalog

`js/item-catalog-tools.js` contains **32 reusable Tool items** with approved Standard Ahn values, Tool proficiencies and semantic Recipes.

Canonical Tool icon families include:

- `tool`
- `repair_kit`
- `harvest_kit`
- `cooking_tools`
- `smithing_tools`
- `fabrication_tools`
- `textile_tools`
- `medical_tools`
- `technical_tools`
- `lapidary_tools`
- `chemical_tools`

### Approved Standard prices

| Tool | Ahn |
| --- | ---: |
| Calligrapher's Supplies | ₳8,000 |
| Painter's Supplies | ₳10,000 |
| Disguise Kit | ₳18,000 |
| Cartographer's Tools | ₳20,000 |
| Forgery Kit | ₳25,000 |
| Navigator's Tools | ₳25,000 |
| Harvesting Tools | ₳25,000 |
| Herbalism / Botanical Gathering Kit | ₳20,000 |
| Cook's Utensils | ₳15,000 |
| Brewer's Supplies | ₳22,000 |
| Smith's Tools | ₳35,000 |
| Carpenter's Tools | ₳25,000 |
| Woodcarver's Tools | ₳20,000 |
| Mason's Tools | ₳30,000 |
| Potter's Tools | ₳20,000 |
| Glassblower's Tools | ₳35,000 |
| Cobbler's Tools | ₳18,000 |
| Weaver's Tools | ₳22,000 |
| Leatherworker's Tools | ₳25,000 |
| Tailor / Sewing Kit | ₳20,000 |
| Medical Instruments | ₳35,000 |
| Surgical Tools | ₳60,000 |
| Tinker's Tools | ₳40,000 |
| Thieves' Tools | ₳35,000 |
| Electronics Tools | ₳55,000 |
| Diagnostic Tools | ₳65,000 |
| Jeweler's Tools | ₳40,000 |
| Lapidary Tools | ₳60,000 |
| Alchemist's Supplies | ₳45,000 |
| Poisoner's Kit | ₳50,000 |
| Chemical Processing Tools | ₳55,000 |
| Repair Kit | ₳30,000 |

## Craft / Industrial Components — integrated

`js/item-catalog-craft-components.js` now defines **28 processed Craft Components** that can be referenced as canonical recipe inputs by Tools and future Weapons, Armor, Augments and other crafted equipment.

The component layer does not assign an arbitrary fixed retail value. Its approved base-value contract is:

`Craft Base Value = sum(consumed input values) × process multiplier`

Retail markup is **not included** in this calculation. This prevents chained Recipes from applying retail markup repeatedly when one crafted component becomes the input of another crafted item.

Universal Quality is applied to the crafted output after the Craft Base Value is calculated.

### Process multipliers and Checks

The current process scale spans:

- processed stock and paper: ×1.20;
- wire, textile, leather and basic containers: ×1.25;
- hardware and structural fabrication: ×1.30;
- housing, glass and ceramic fabrication: ×1.35;
- chemical processing: ×1.40;
- chemical-resistant containers: ×1.45;
- electrical and mechanical fabrication: ×1.50;
- precision, optical and electronics fabrication: ×1.65;
- calibration: ×1.70;
- circuitry: ×1.80;
- sensors: ×1.85;
- Augment-grade fabrication: ×2.00;
- Corp / Wing precision fabrication: ×2.20;
- exotic industrial fabrication: ×2.50.

Each component Recipe declares a semantic Craft Check, required Tool type and base Threshold. The approved Threshold bands remain:

- Generic processing: **TH18**;
- Workshop processing: **TH22**;
- Corp / Wing processing: **TH28**.

Improvisation continues to use the universal Tool rule of **TH +3** when physically plausible.

Exact canonical Character Skill IDs remain a later binding step; component Recipes store semantic Checks so the Recipe definitions do not have to be redesigned when that binding is completed.

### Integrated component icon families

Existing icon families are reused wherever they already describe the component clearly. Five additional families are integrated:

- `structural_stock` — Assets/Icons/items/material/structural_stock.png
- `fasteners_hardware` — Assets/Icons/items/material/fasteners_hardware.png
- `wire_cable` — Assets/Icons/items/material/wire_cable.png
- `glass_component` — Assets/Icons/items/material/glass_component.png
- `container` — Assets/Icons/items/material/container.png

Ceramic components reuse `craft_component`. Optical components reuse `precision_component`.

The component catalog also reuses `scrap_mechanical`, `electronic_parts`, `precision_component`, `circuitry`, `chemical`, `textile`, `hide_mammal` and `craft_component` where appropriate.

### Recipe-input contract

Components expose canonical IDs plus `requirementTags`. Future Recipes may therefore request either a specific component ID or a compatible semantic requirement without duplicating material definitions.

Examples include:

- `mechanical_parts`;
- `precision_component`;
- `electronic_parts`;
- `circuitry`;
- `textile_component`;
- `container`;
- `chemical_component`;
- `chemical_resistant_container`;
- `glass_or_optical_material`;
- `structural_component`;
- `structural_handle`;
- `generic_component`.

Finished equipment should consume refined or processed inputs when appropriate rather than consuming Raw Ore directly.

## Tool Recipes: intentionally still semantic

Every Tool still has a semantic Recipe with:

- output item and quantity 1;
- required Tool type;
- required Tool reusable and not consumed;
- improvisation allowed at +3 TH;
- output Quality from Craft Check;
- semantic component requirements.

Now that the component catalog exists, a later Tool-recipe pass may replace those semantic requirements with exact canonical component IDs and quantities. That pass is intentionally separate from the component-family integration so the project can continue to the next item family without prematurely locking Work Units, Stations or Skill-ID bindings.

## Work intentionally left for later Crafting passes

1. Replace semantic Tool-recipe requirements with exact canonical component IDs and quantities.
2. Assign each Tool recipe its final Craft TH and Work Units where not already defined by process.
3. Bind each Tool/action and Component semantic Check to the actual canonical Character Skill ID used by Luminous.
4. Balance the Tool Base Power scale against Character Skill and Tool Proficiency.
5. Decide whether universal Quality modifies Tool Base Power, durability, both, or neither.
6. Connect reusable physical Tools to the future universal Condition/Durability engine.
7. Design Stations separately: Forge, Furnace, Lapidary Bench, Electronics Bench, Chemical Station, etc. A Tool is not a Station.
8. Preserve the weapon crossover rule: knives, hammers, picks, saws and similar real objects remain their normal item/weapon archetype and can improvise suitable work; do not duplicate them as Tool items only to unlock a Craft.
9. Bind component input quantities and material-lineage transforms where a future Production/Crafting pass needs exact conservation rules.

## Standing workflow rule

For every new family or material-system change: **show the full proposed list/rules/icons/prices first, wait for explicit approval, then update PR #777.**
