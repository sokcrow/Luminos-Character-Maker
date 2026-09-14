# Tool System Handoff

This document records the approved Tool-system contract already integrated in `js/item-catalog-tools.js` and the exact work intentionally left for the next pass.

## Integrated rules

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

Canonical Tool icon families now include:

- `tool` — existing generic Tool icon
- `repair_kit` — existing Repair Kit icon
- `harvest_kit` — https://imgur.com/o1ZbzmZ.png
- `cooking_tools` — https://imgur.com/9J5aoNo.png
- `smithing_tools` — https://imgur.com/U9eG3Iw.png
- `fabrication_tools` — https://imgur.com/KBJtJvx.png
- `textile_tools` — https://imgur.com/GroyHFc.png
- `medical_tools` — https://imgur.com/q0qnACw.png
- `technical_tools` — https://imgur.com/oPFjjqC.png
- `lapidary_tools` — https://imgur.com/EWDbp22.png
- `chemical_tools` — https://imgur.com/jlcBHuz.png

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

## Recipes: current state

Every Tool already has a semantic Recipe with:

- output item and quantity 1;
- required Tool type;
- required Tool is reusable and not consumed;
- improvisation allowed at +3 TH;
- output Quality from Craft Check;
- component requirements expressed as semantic tags;
- exact component quantities explicitly deferred.

Do not invent exact component amounts yet. The catalog intentionally uses requirements such as `precision_component`, `mechanical_parts`, `refined_metal`, `textile`, `container`, `circuitry`, `chemical_component`, and similar component tags.

## Next family: Craft / Industrial Components

This is the next family to design before returning to exact Tool recipe quantities.

Present the complete proposed list for approval before touching PR #777. Recommended coverage:

1. Mechanical Parts and Scrap refinement.
2. Fasteners / generic assembly hardware.
3. Precision Components.
4. Electronic Parts.
5. Circuitry.
6. Processed Textile components / textile stock.
7. Chemical components and suitable containers.
8. Glass / Ceramic / Optical components.
9. Structural stock / handles needed by fabrication.
10. Standard intermediate component forms shared by Tools, Weapons, Armor and Augments.

The icon registry already contains these relevant material groups and should be checked before requesting new art:

- `scrap_mechanical`
- `electronic_parts`
- `precision_component`
- `circuitry`
- `chemical`
- `textile`
- `craft_component`

Do not make finished equipment consume Raw Ore directly when a refined or intermediate component is appropriate.

## Work intentionally left after Components

Once Craft / Industrial Components is approved and integrated:

1. Replace semantic component requirements in Tool recipes with exact canonical item IDs and quantities.
2. Assign each Tool recipe its final Craft TH and Work Units.
3. Bind each Tool/action to the actual canonical Character Skill ID used by Luminous.
4. Balance the Tool Base Power scale against Character Skill and Tool Proficiency.
5. Decide whether universal Quality modifies Tool Base Power, durability, both, or neither.
6. Connect reusable physical Tools to the future universal Condition/Durability engine.
7. Design Stations separately: Forge, Furnace, Lapidary Bench, etc. A Tool is not a Station.
8. Preserve the weapon crossover rule: knives, hammers, picks, saws and similar real objects remain their normal item/weapon archetype and can improvise suitable work; do not duplicate them as Tool items only to unlock a Craft.

## Standing workflow rule

For every new family or material-system change: **show the full proposed list/rules/icons/prices first, wait for explicit approval, then update PR #777.**
