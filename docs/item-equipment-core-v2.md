# Item + Equipment Core v2

## Scope
The first equipment delivery is a deterministic content foundation plus a DM Equipment Forge. It does not replace the legacy item creator and does not execute every module effect in combat yet.

## Identity
New definitions use explicit stable IDs. Display names never generate identity. Items use `item:<local-id>`, modules use `module:<local-id>`, and recipes use `recipe:<local-id>`.

The legacy Firebase item payload remains available through a compatibility projection. It keeps Roman `tier` for old consumers while v2 stores numeric `tier_value` and an `equipment_v2` definition.

## Tier and MK
- Tier is numeric 1–10 internally and displayed as I–X.
- Tier represents rarity, availability and technological sophistication; it is not a direct damage rank.
- MK is a product revision. The base revision is internally MK I but omits the suffix in the visible name. MK II and above are displayed.
- MK and Tier are independent.
- Workshop products render the manufacturer as `<Name> Workshop` in the visible product name.

## First delivery counts
The base item catalog contains exactly 100 definitions: 18 basic/structural materials, 18 mechanical/electronic components, 16 elemental components, 8 specialized/Workshop components, 20 weapon chassis, 10 armor chassis, and 10 accessory chassis.

The module catalog contains exactly 60 module lines: 20 elemental, 18 status-oriented, 8 physical/weapon engineering, 5 defensive, 5 utility/sensor/mobility, and 4 general engineering.

Module lines contain MK revision data instead of duplicating each revision as an unrelated module definition.

## Elemental compatibility
The item system consumes `LuminousElementalStatusRuntime`. It does not define a second elemental translation table. The existing runtime remains authoritative for D&D element → Sin → Luminous status resolution.

## Crafting
Recipes use material definitions and material roles. Tier derivation uses weighted material rarity rather than a simple average: filler 0.5, structural 1.0, precision 1.25, core 1.5, signature 2.0. A core/signature component also imposes a floor of `highest core Tier - 1`. Recipe complexity can add a Tier step. All results remain bounded to Tier I–X.

Craft checks are required by the recipe contract, but the core does not invent a Skill or threshold. The DM Equipment Forge must configure both before saving a craftable custom product.

## DM Equipment Forge
`dm-equipment-forge.html` is a desktop HUD with Build, Catalog, Materials, Modules and Recipes views. The Build view composes `Workshop + chassis + compatible module lines + MK` and previews the derived material recipe, material cost, Tier, effects and display name.

DM-authenticated saves write the item to `campaña/base_datos_items/<id>` and its recipe to `campaña/recetas/<recipeId>`. The Catalog view can deploy the 100 base item definitions and 60 module lines to Firebase; modules use `campaña/base_datos_modulos/<moduleId>`.

## Art policy
Custom art is optional. Default v2 items use reusable category/subtype glyph identifiers; named, unique or story equipment can still provide a custom asset.
