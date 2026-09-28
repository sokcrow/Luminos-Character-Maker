# Armor V1 handoff

Armor V1 is a modular physical-equipment layer. Shields are intentionally excluded from this pass.

## Modules

- `js/item-armor-material-profile.js` — canonical Armor material aliases/profiles, physical affinity, Durability, Weight and elemental wear.
- `js/item-catalog-armor-components.js` — seven craftable Armor Components and material compatibility.
- `js/item-catalog-armor-upgrades.js` — mundane physical component Upgrades.
- `js/item-armor-upgrade-engine.js` — slot validation and Upgrade application.
- `js/item-armor-composition-engine.js` — twelve canonical chassis/presets, modular assembly, naming, affinity ordering and Weight resolution.
- `js/item-armor-runtime.js` — character-facing Speed, STR relief, CON, Armorless Defense and Armor Proficiency formulas.
- `tests/item-armor-smoke.cjs` — contract coverage.

## Canonical chassis

Clothing, Padded Armor, Leather Armor, Hide Armor, Chain Shirt, Scale Mail, Breastplate, Half Plate, Ring Mail, Chain Mail, Splint Armor and Plate Armor.

Studded Leather is not a chassis. It is represented by Leather Armor with Reinforcement/physical Upgrades.

## Resistance pipeline

`Material -> Component affinity -> weighted finished scores -> Strong / Secondary / Sacrifice -> chassis budget -> character CON / Proficiency`

Mundane chassis resistance budgets:

| Chassis | Strong | Secondary | Sacrifice |
| --- | ---: | ---: | ---: |
| Clothing | 0.95 | 1.05 | 1.10 |
| Padded / Leather | 0.80 | 1.00 | 1.20 |
| Hide | 0.75 | 0.95 | 1.30 |
| Chain Shirt | 0.70 | 0.95 | 1.30 |
| Scale Mail / Breastplate | 0.70 | 0.90 | 1.30 |
| Half Plate / Ring Mail | 0.65 | 0.90 | 1.35 |
| Chain Mail / Splint / Plate | 0.65 | 0.85 | 1.35 |

Mundane Armor has no `-3..+3` Grade axis. Physical resistance comes from material affinity, component geometry, chassis budget, physical Upgrades, CON and Proficiency. Armor-generated physical multipliers remain clamped to 0.30..1.50. Legacy `armorGrade` inputs are ignored rather than translated into another mundane bonus.

Normal CON adjustment is `0.03 * CON MOD`. Armorless Defense does not grant a 1.10 baseline; while unarmored it uses the normal 1.35 physical baseline and changes the CON rate to `0.05 * CON MOD`. Armor Proficiency contributes another `-0.02` only for an equipped Armor chassis for which the character is proficient.

## Speed and Weight

Base Speed:

- `Min = max(1, floor(DEX MOD / 4) + 1)`
- `Max = max(2, floor(DEX MOD) + 2)`

Armor stores signed Weight effects to Min/Max Speed. Heavy chassis primarily reduce Max Speed. Sufficiently light material composition may improve a chassis Weight effect; heavy materials can worsen it.

Armor STR Target is capped at 13. V1 uses a configurable Strength relief threshold of **+3** over the final target. When relief applies, each negative Weight effect is halved by flooring its positive magnitude. Positive lightweight bonuses are not reduced.

## Components and Upgrade slots

Armor Padding, Leather / Hide Layer, Mail / Links, Scale Layer, Armor Plate, Armor Reinforcement and Straps / Fittings.

Upgrade capacity is based on the primary material's unit Durability and does not change after reinforcement:

- 1-19 -> 1 slot
- 20-34 -> 2 slots
- 35+ -> 3 slots
- hard cap: 3

Mundane Upgrades may alter physical affinity, Weight, Speed Weight effects, Durability, elemental equipment wear, repair, noise and handling. They do not grant supernatural character resistance or immunity.

## Hardened Steel compatibility

Armor canonicalizes `hardened_weapon_steel` and `armor_steel` to `hardened_steel`. The Armor profile uses Durability 42 and reference Production Value 90,000 AHN/MU. Legacy IDs remain accepted by the Armor resolver so existing data does not break.

## Deferred

- Shield composition / Guard interaction.
- Full live Combat binding and UI presentation.
- Enchantment effect definitions. The universal equipment Enhancement namespace reserves only +1/+2/+3 for Enchantments; mundane Armor remains Enhancement 0.
- Full material economy migration of legacy steel IDs outside the Armor resolver.
