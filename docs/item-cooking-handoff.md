# Cooking / Food V1 handoff

Status: canonical V1 contract for PR #777.

This document freezes the Cooking/Food rules approved for the Items pass. The goal is to stop reopening already-closed design questions. Catalog expansion may add recipes and ingredients, but must not silently change these contracts.

## Design doctrine

Complexity lives in crafting; equipping/consuming stays simple.

Pipeline:

Base Item affinities -> procedural ingredient property -> Ingredient / Processed Item -> Recipe TH -> normal Limbus Check -> star quality -> Taste/SP -> culinary effects -> finished Item -> salary-anchored Production Value -> Retail/Restaurant reference price.

Cooking does not introduce a new dice system. Recipes use the existing Check resolver and declare DEX, INT or WIS as their governing ability. Easier/manual preparations generally use DEX. Harder technical or judgment-heavy recipes use INT or WIS. The recipe authors the ability; the player does not freely substitute a preferred Score.

## Recipe TH

Canonical authored Recipe TH range is 8..24.

A preparation method has Base TH 8..15:

| Method family | Base TH |
| --- | ---: |
| Assemble / Cut / Simple Mix | 8 |
| Mixing / Basic Boil | 9 |
| Grill / Pan Fry | 10 |
| Steam / Roast / Knead | 11 |
| Simmer / Stir Fry | 12 |
| Bake / Deep Fry | 13 |
| Smoke / Cure / Pickle / Dry | 14 |
| Ferment / Brew / Distill / Delicate technique | 15 |

Final authored Recipe TH:

Recipe TH = Base Method TH
+ ceil(Ingredient Complexity)
+ Auxiliary Complexity
+ Special Recipe Penalties
- Processed Stabilization

then clamp to 8..24.

Ingredient complexity:

| Role | Complexity |
| --- | ---: |
| Core / Major | 1.00 |
| Minor | 0.50 |
| Seasoning | 0.25 |
| Garnish | 0.00 |

Fractions are summed first and only then rounded with ceil().

Auxiliary steps use small TH deltas rather than another full method TH. Canonical auxiliary complexity is capped at +4.

Processed ingredients encapsulate their internal crafting complexity. Their internal source ingredients are not recounted in the final recipe. Appropriate Processed ingredients may stabilize by -1 TH; a key Processed component may contribute -2 TH. Total Processed stabilization is capped at -2 TH.

Using an inappropriate tool, station or equivalent required cooking element adds +3 TH per distinct mismatch.

## Cook's Utensils

Cook's Utensils modify TH rather than creating a second roll:

- present, not proficient: -1 TH;
- proficient: -(2 + Proficiency) TH.

Station- and specialized-tool modifiers are recipe/equipment data. No universal positive station bonus is invented in V1. Inappropriate equipment uses the +3 TH mismatch rule above.

The 8..24 clamp belongs to the authored Recipe TH. Equipment can make the effective Check TH lower or higher at runtime.

## Star quality

Margin = resolved Check result - effective TH.

| Margin | Quality |
| ---: | --- |
| <= -8 | ★ |
| -7..-1 | ★★ |
| 0..3 | ★★★ |
| 4..7 | ★★★★ |
| >= 8 | ★★★★★ |

Stars control active culinary effects and duration:

| Stars | Active effects | Duration | Taste mod |
| --- | ---: | ---: | ---: |
| ★ | 0 | 0h | -2 |
| ★★ | 1 | 1h | -1 |
| ★★★ | 1 | 2h | 0 |
| ★★★★ | 2 | 4h | +1 |
| ★★★★★ | 3 | 6h | +2 |

★ food remains edible/feeding when the underlying item is edible; it simply has no active special culinary effect.

## Taste and SP

Ingredients and Processed items use Taste 0..4. Finished cooking may reach Taste 0..6 after the star modifier.

Base Taste is a weighted average using the same culinary role weights as Ingredient Complexity:

Base Taste = sum(Taste x Role Weight) / sum(Role Weight)

Round Base Taste normally, then:

Final Taste = clamp(Base Taste + Star Taste Modifier, 0, 6).

For edible food:

| Final Taste | SP |
| ---: | ---: |
| 0 | +2 |
| 1 | +3 |
| 2 | +4 |
| 3 | +5 |
| 4 | +6 |
| 5 | +7 |
| 6 | +8 |

Equivalent formula: SP = Final Taste + 2, clamped to +2..+8.

For edible:false Ingredient/Processed consumption:

| Final Taste | SP |
| ---: | ---: |
| 0 | -10 |
| 1 | -9 |
| 2 | -8 |
| 3 | -7 |
| 4 | -6 |
| 5+ | -5 |

Non-edible raw/processed consumption may still restore exactly one Hunger or Hydration slot according to its physical consumption type, but it does not grant normal prepared-food culinary effects.

## Finished dish economy

AHN pricing is anchored to `js/item-economy-standard.js` and the canonical monthly salary reference of ₳1,000,000.

Finished recipes add a salary-relative labor value to consumed ingredient Production Value:

```
Created Dish PV =
  (sum consumed input PV x Recipe Creation Multiplier)
  + Recipe Labor Value
```

Labor classes are:

| Labor class | AHN |
| --- | ---: |
| Snack | ₳1,000 |
| Simple | ₳2,000 |
| Standard | ₳4,000 |
| Complex | ₳7,000 |
| Elaborate | ₳10,000 |
| Fine | ₳15,000 |

Star execution modifies the realized economic value:

| Stars | Value multiplier |
| --- | ---: |
| ★ | x0.70 |
| ★★ | x0.85 |
| ★★★ | x1.00 |
| ★★★★ | x1.20 |
| ★★★★★ | x1.50 |

Retail/Restaurant markup is a sales-layer concern and is not permanently baked into the Item's Production Value. Canonical venue references range from x1.20 prepared grocery to x4.00 luxury/prestige dining.

Food affordability is checked against salary-relative bands:

- Survival: ₳1,000..₳5,000;
- Cheap meal: ₳5,000..₳12,000;
- Normal meal: ₳12,000..₳30,000;
- Good restaurant: ₳30,000..₳100,000;
- Luxury meal: ₳100,000..₳800,000.

The full salary table and non-food Item affordability bands are frozen in `docs/item-economy-handoff.md`.

## Master recipe catalog

`js/item-cooking-recipe-catalog.js` now provides the canonical multicultural recipe catalog.

It covers at least 80 recipes across Bakery/Pastry, American, Japanese, Italian, Mexican/Latin, East Asian, South Asian, general comfort food and low-cost City survival food.

Recipes author:

- cuisine/course/dish family;
- Cooking method and DEX/INT/WIS ability;
- semantic ingredient requirements rather than one hard-coded creature/produce combination;
- Creation Multiplier;
- labor class;
- target food price class;
- default Retail/Restaurant venue.

The recipe never hard-codes final Skill/Save buffs. Actual ingredient instances still determine culinary properties.

The first catalog-expansion pass is now implemented.

Raw culinary coverage is now 122 Items:

- 76 Plant / Produce / Herb / Fungi;
- 39 Meat;
- 7 Culinary Staples: Egg, Milk, Seaweed, Avocado, Honey, Sugar Cane and Recycled Protein.

The new staple catalog is canonical in `js/item-catalog-culinary-staples.js`. Each staple has salary-anchored AHN value, culinary affinity distribution, Quality-aware stack creation and a bridge into Processing V1.

Missing recipe concepts that are transformations rather than raw resources are represented as Processed Items instead of inflating the raw catalog. Current added canonical intermediates are:

- Corn Flour;
- Corn Dough;
- Cream;
- Cheese;
- Batter;
- Coating;
- Pasta;
- Noodles;
- Wrapper;
- Ground Meat;
- Miso Paste.

Generic requirements such as `meat_or_vegetable`, `protein_or_vegetable`, `vegetable_or_seafood`, `filling`, `baked_base` and `processed_meat` are semantic resolver requirements, not inventory definitions.

## Recipe Resolver V1

`js/item-cooking-recipe-resolver.js` is the canonical inventory-to-recipe bridge for Master Recipe Catalog V1.

The resolver:

- enriches inventory stacks from Plant, Meat, Culinary Staples and legacy Food definitions;
- recognizes exact Item IDs, Processed forms, finished recipe IDs, dish families and semantic aliases;
- supports union requirements such as `meat_or_vegetable`;
- reserves real inventory quantities so one unit cannot satisfy multiple recipe requirements;
- prefers exact/direct matches over broad aliases;
- returns missing requirements for UI;
- returns `recipeInputs` already annotated with `Core/Major/Minor/Seasoning/Garnish` roles;
- returns an explicit `consumptionPlan`;
- can list currently craftable recipes from an inventory.

This resolver does not perform the Cooking Check itself. It prepares a valid concrete ingredient composition for the existing Cooking V1 engine.

## Cooking Execution Runtime V1

`js/item-cooking-runtime.js` closes the Recipe Resolver -> finished inventory Item bridge.

Runtime flow:

```text
Inventory
-> Recipe Resolver
-> concrete Core/Major/Minor/Seasoning/Garnish inputs
-> Recipe TH
-> tool/station evaluation
-> effective TH
-> normal Cooking Check result
-> stars / Taste / SP / culinary effects
-> salary-aware Production Value / Retail reference
-> consume exact inventory quantities
-> create finished Food Item in inventory
```

The runtime performs a preview before mutation, preserves exact resolver consumption quantities, and refuses to cook when the output inventory cannot accept the finished Item.

Finished food stores the resolved result. Rendering the Item later does not reroll affinities, recompute stars or re-resolve effects.

Raw culinary Items that predate explicit Taste authoring receive the V1 runtime fallback Taste 2 unless their authored flavor profile maps to a clearer V1 value. Explicit Item Taste always wins.

`js/item-cooking-ui.js` exposes this runtime from the player Inventory through a COOK control. It lists currently craftable recipes, lets the player declare the available station, displays Recipe TH/effective TH and equipment mismatches, accepts the already-resolved Cooking Check result, executes the recipe and persists the new Food Item.

## Cooking tools and stations V1

`js/item-cooking-equipment-engine.js` is the canonical equipment context for Cooking.

Real inventory tools currently used by Cooking are:

- `cooks_utensils` — normal cooking/prep;
- `brewers_supplies` — fermentation, brewing and distillation.

Canonical station contexts are:

- Prep Surface;
- Cooktop;
- Grill;
- Steamer;
- Oven;
- Fryer;
- Smoker;
- Preservation Station;
- Fermentation Station;
- Brewery;
- Distillation Station;
- Precision Kitchen.

Stations are context, not portable inventory Items.

Missing or inappropriate required tool: +3 effective TH.
Missing or inappropriate required station: +3 effective TH.

These mismatches stack exactly as already frozen by Cooking V1. Cook's Utensils still apply their normal TH reduction independently when present.

## Hunger / Hydration / Rest

Medium baseline:

- Hunger: 3 slots;
- Hydration: 3 slots;
- both decay by 1 slot every 6 hours;
- normal food/drink restoration is recipe/item data, usually +1 relevant slot;
- a filling/hydrating culinary property may add +1 additional relevant slot.

Daily survival Exhaustion:

- missing the required Long Rest/sleep: +1 Exhaustion;
- inadequate sustenance: +1 Exhaustion;
- Hunger and Hydration failures together are one sustenance penalty, not two;
- daily survival penalties therefore cap at +2 Exhaustion.

Current V1 adequacy check is Hunger >= 1 and Hydration >= 1 at the daily survival evaluation.

Short Rest:
- one active window;
- choose Activity OR Eat/Drink;
- no sleep;
- 2-hour Short Rest cooldown.

Long Rest:
- one active window;
- choose Activity OR Eat/Drink;
- mandatory sleep follows;
- only one Eat/Drink opportunity is implied by the rest flow.

Food and drink may both be chosen inside one Eat/Drink window when valid inventory consumables are available.

### Live Food / Rest runtime

`js/item-food-rest-runtime.js` now binds the slot contract to real inventory Food Items.

It provides:

- Eat/Drink from Active Inventory or accessible Stash;
- Hunger/Hydration restoration;
- SP restoration from finished-food Taste;
- 6-hour survival-slot decay;
- 2-hour Short Rest cooldown;
- Long Rest completion state;
- culinary-effect duration decay;
- exact-target culinary Final Power buffs through the Item Runtime modifier bridge.

The player Inventory now exposes an **EAT / DRINK** action for Food.

Short Rest and Long Rest now open `js/item-food-rest-ui.js`, allowing the player to choose Activity only or Eat/Drink and select the actual Food stack consumed.

Rest recovery is applied before the selected Rest meal's SP/effects, so the meal remains meaningful at rest completion.

Same-target culinary effects follow the frozen replacement contract: stronger replaces weaker, weaker does not overwrite stronger, and equal Power may refresh duration. Unrelated targets may coexist. The dedicated active-effect replacement/display UI remains a later presentation task.

## Culinary property targets

Food properties target individual Skills or individual Saves only. They do not generalize to the parent ability Score/Modifier and do not directly buff Speed, OFF, DEF, Guard, Clash or similar combat channels.

Skill targets:
Athletics, Acrobatics, Sleight of Hand, Stealth, Arcana, History, Investigation, Nature, Religion, Animal Handling, Insight, Medicine, Perception, Survival, Deception, Persuasion, Intimidation, Performance.

Save targets:
STR Save, DEX Save, CON Save, INT Save, WIS Save, CHA Save.

A culinary effect changes Final Power only for its exact target Check/Save.

## Item affinity and procedural ingredient properties

Ingredient definitions do **not** use Normal / Notable / Rare / Exceptional culinary variants and do not carry a per-ingredient culinary power score.

A culinary-capable base Item may instead declare a weighted `culinaryAffinities` map:

```js
culinaryAffinities: {
  survival: 40,
  athletics: 25,
  con_save: 20,
  nature: 10,
  arcana: 5,
}
```

These values are 0..100 authoring weights. They are relative RNG weights, not direct +Power, rarity, Item Quality or a score that must be recalculated on every ingredient. Canonical PR #777 catalog distributions sum to exactly 100; the Item Affinity engine only normalizes non-canonical external/legacy data defensively.

When a procedural ingredient instance is generated, one exact Skill/Save target is selected from its base Item affinity pool. The realized target is stored on the instance as a culinary property together with its source provenance.

The base Item may expose many possible targets. The instance adopts one result from that pool.

Exact culinary targets also project to gameplay branches for world placement:

- STR: Athletics, STR Save
- DEX: Acrobatics, Sleight of Hand, Stealth, DEX Save
- CON: CON Save
- INT: Arcana, History, Investigation, Nature, Religion, INT Save
- WIS: Animal Handling, Insight, Medicine, Perception, Survival, WIS Save
- CHA: Deception, Persuasion, Intimidation, Performance, CHA Save

Locations, districts and shops may inspect those base target/branch weights when deciding which Items they tend to stock. An INT-focused magical district can therefore prefer food Items whose catalog affinities lean toward INT. The world chooses which Items are more likely to appear; it does not rewrite the Item's intrinsic percentages.

Once an ingredient instance has realized its target, Cooking uses the recipe-role contribution weights below:

| Role | Recipe affinity contribution |
| --- | ---: |
| Core / Major | 3 |
| Minor | 2 |
| Seasoning | 1 |
| Garnish | 0 |

The catalog-side percentage and the recipe-side contribution are intentionally different layers. Catalog affinity determines **which target the instance adopts**; recipe role determines **how strongly that realized target contributes inside the dish**.

Equal realized targets from distinct source instances merge into one recipe affinity. The same source instance cannot duplicate its target by being processed repeatedly. Processing preserves the realized property and its `sourceInstanceId` instead of rerolling or cloning it by default.

Example:

Mystic Apple -> Mystic Apple Syrup -> Pancakes made with that Syrup.

If the source Apple realized Arcana, that Arcana property may survive the chain, but one source Apple does not become multiple Arcana sources merely because it passed through multiple processing stages.

When distinct ingredient sources share the same realized target, their recipe affinity legitimately combines.

Recipe affinity ranking determines Primary / Secondary / Tertiary. Recipe property priority breaks equal-affinity ties, followed by deterministic target ID order.

The recipe does not hard-code the final buff. Procedural ingredient instances determine the candidate targets.

## Concentration and Power

Distinct candidate targets deliberately dilute specialization.

Canonical power vectors:

| Distinct candidate targets | ★ | ★★ | ★★★ | ★★★★ | ★★★★★ |
| --- | --- | --- | --- | --- | --- |
| 1 | — | +2 | +3 | +4 | +6 |
| 2 | — | +1/— | +2/— | +3/+1 | +4/+2 |
| 3 | — | +1/—/— | +2/—/— | +2/+1/— | +3/+2/+1 |
| 4+ | all — | +1/— | +1/— | +1/+1 | +1/+1/+1 |

— means the property is not active.

Recipe difficulty also caps any one culinary effect:

| Recipe TH | Maximum individual Power |
| ---: | ---: |
| 8..11 | +2 |
| 12..15 | +3 |
| 16..19 | +4 |
| 20..24 | +6 |

Therefore +6 requires all of the following:
- a TH 20..24 recipe;
- one distinct target after composition;
- ★★★★★ execution.

More ingredients can increase TH and broaden candidate properties, but 4+ targets are intentionally diluted to +1 effects. More ingredients are not automatically stronger.

## Effect replacement

Same-target culinary effects do not stack. A stronger same-target effect replaces a weaker one; a weaker same-target effect does not overwrite a stronger one.

Finished food stores its resolved effects, Taste, SP, stars, duration and provenance. It is not recalculated every time inventory UI renders it.

The generic live active-effect replacement UI when three unrelated culinary effects are already occupied remains a runtime binding concern; the Item itself already resolves to no more than three active effects.

## Catalog / provenance

Processed ingredients are real inventory Items with their own recipes. Processing can be multi-stage. A Processed item carries provenance and inherited culinary properties into later recipes.

Processing Methods V1 is canonical in `js/item-processing-engine.js`, `js/item-processing-recipe-data.js` and `docs/item-processing-handoff.md`. It derives legal transformations from existing Item families/tags, supports both procedural source-derived forms and shared canonical Processed outputs, preserves original affinity source provenance without rerolling, and now freezes integer batch yields, Taste deltas and Production Value multipliers. Processing stabilization stored on an output is only a hint; the later recipe remains responsible for deciding whether that Processed ingredient is appropriate (-1) or key (-2), subject to the existing -2 total cap.

Normal finished names remain compact. UI should show stars and small Skill/Save icons rather than prefix every property into the item name.

Example:
Wolf Meat with Rice ★★★★★
[Survival +3] [CON Save +2] [Athletics +1]

Detailed view may show provenance such as Made with Mystic Apple Syrup.

## Canonical implementation

- js/item-economy-standard.js
- tests/item-economy-standard-smoke.cjs
- docs/item-economy-handoff.md
- js/item-affinity-engine.js
- tests/item-affinity-engine-smoke.cjs
- docs/item-affinity-handoff.md
- js/item-processing-recipe-data.js
- js/item-processing-engine.js
- tests/item-processing-engine-smoke.cjs
- docs/item-processing-handoff.md
- js/item-cooking-engine.js
- js/item-cooking-recipe-catalog.js
- js/item-cooking-recipe-resolver.js
- js/item-cooking-equipment-engine.js
- js/item-cooking-runtime.js
- js/item-cooking-ui.js
- js/item-food-rest-runtime.js
- js/item-food-rest-ui.js
- tests/item-cooking-recipe-resolver-smoke.cjs
- tests/item-cooking-equipment-smoke.cjs
- tests/item-cooking-runtime-smoke.cjs
- tests/item-food-rest-runtime-smoke.cjs
- tests/item-culinary-intermediates-smoke.cjs
- tests/item-cooking-recipe-catalog-smoke.cjs
- tests/item-cooking-engine-smoke.cjs
- docs/item-cooking-handoff.md

The older js/item-catalog-food.js 0..100 hunger/ration helpers remain legacy compatibility only until catalog migration. New Cooking/Rest/culinary-effect work must use the Cooking V1 contract above rather than extending the old 100-point Hunger model.

Current PR #777 culinary affinity coverage is 76 Plant / Produce / Herb / Fungi Items plus 39 Meat Items plus 7 Culinary Staples. Canonical base distributions total 100 percentage points. The 39 simple Cooked Meat outputs and all Processing V1 intermediates preserve realized source affinity/provenance instead of rerolling it.

## Explicitly not reopened by this handoff

The following are catalog/runtime follow-ups, not reasons to redesign Cooking V1:

- world/shop demand profiles and semantic district tags that consume target/branch affinity data;
- non-Medium body-size Hunger/Hydration slot scaling;
- exceptional source-specific processing overrides where a future concrete recipe needs them;
- dedicated active culinary-effect replacement/display UI when more than three unrelated effects compete for slots;
- world-owned station availability/permission binding beyond the current explicit station context selector.

Those tasks must consume this V1 contract rather than redefining it.
