# Ingredient Processing V1 handoff

Status: canonical Processing Methods V1 contract for PR #777.

This layer exists because the culinary catalog is dense. Processing is driven primarily by Item families/tags rather than by authoring a separate recipe for every Apple, Pear, Carrot, Wolf Meat, Mushroom, Herb, etc.

## Doctrine

Processing sits between raw ingredient generation and recipe composition:

```text
Base Item
  -> procedural affinity instance
  -> Processing Method
  -> Processed Item
  -> later recipe composition
```

The Processed Item is a real inventory Item. It preserves the realized culinary property/provenance of its source ingredients by default.

Processing does not reroll Item Affinity.

## Procedural vs canonical Processed Items

Processing produces two kinds of outputs.

### Procedural outputs

These are source-derived forms and do not require a separate authored catalog entry for every source Item.

Examples:

- Apple -> Sliced Apple
- Carrot -> Chopped Carrot
- Wolf Meat -> Smoked Wolf Meat
- Common Mushroom -> Dried Common Mushroom

The output identity contains its processing form plus source/provenance.

### Canonical outputs

These are shared culinary building blocks used by many later recipes.

Current canonical output identities:

- Flour
- Oil
- Paste
- Dough
- Stock
- Sauce Base
- Syrup
- Ferment Base
- Brew Base
- Distillate
- Culinary Extract

Canonical outputs still preserve source Item IDs, source instance IDs and culinary properties. Wheat Flour and another Flour source may share the canonical `processed_flour` definition while remaining distinguishable through provenance/stack identity.

## Canonical method table

| Method | Cooking family | Base TH | Input mode | Default output | Output class | Stabilization hint |
| --- | --- | ---: | --- | --- | --- | ---: |
| Cut / Slice | Cut | 8 | single | Sliced {Source} | procedural | 0 |
| Chop / Dice | Cut | 8 | single | Chopped {Source} | procedural | 0 |
| Crush | Cut | 8 | single | Crushed {Source} | procedural | 0 |
| Simple Mix | Simple Mix | 8 | multi | Mixed Base | procedural | 0 |
| Grind | Mixing | 9 | single | Ground {Source} | canonical when tags demand it | 0 |
| Mash / Purée | Mixing | 9 | single | {Source} Purée | procedural | 1 |
| Juice | Mixing | 9 | single | {Source} Juice | procedural | 1 |
| Press | Mixing | 9 | single | Pressed output | canonical when tags demand it | 1 |
| Boil | Basic Boil | 9 | single | Boiled {Source} | procedural | 1 |
| Blanch | Basic Boil | 9 | single | Blanched {Source} | procedural | 0 |
| Grill | Grill | 10 | single | Grilled {Source} | procedural | 1 |
| Pan Fry | Pan Fry | 10 | single | Pan-Fried {Source} | procedural | 1 |
| Steam | Steam | 11 | single | Steamed {Source} | procedural | 1 |
| Roast | Roast | 11 | single | Roasted {Source} | procedural | 1 |
| Knead | Knead | 11 | multi | Dough | canonical | 2 |
| Simmer | Simmer | 12 | single/multi | Simmered source / Stock / Sauce Base | mixed | 1 |
| Reduce | Simmer | 12 | single | Reduction / Syrup / Sauce Base | mixed | 2 |
| Stir Fry | Stir Fry | 12 | single/multi | Stir-Fried source/mix | procedural; usually final | 0 |
| Bake | Bake | 13 | single/multi | Baked source/mix | procedural; usually final | 0 |
| Deep Fry | Deep Fry | 13 | single | Deep-Fried {Source} | procedural; usually final | 0 |
| Smoke | Smoke | 14 | single | Smoked {Source} | procedural | 2 |
| Cure | Cure | 14 | single | Cured {Source} | procedural | 2 |
| Pickle | Pickle | 14 | single | Pickled {Source} | procedural | 2 |
| Dry / Dehydrate | Dry | 14 | single | Dried {Source} | procedural | 2 |
| Ferment | Ferment | 15 | single | Ferment Base | canonical | 2 |
| Brew | Brew | 15 | single/multi | Brew Base | canonical | 2 |
| Distill | Distill | 15 | single | Distillate | canonical | 2 |
| Delicate Extract | Delicate | 15 | single | Culinary Extract | canonical | 2 |

The stabilization column is a **hint**, not an automatic Recipe TH reduction.

Cooking V1 remains authoritative:

- appropriate Processed ingredient: may contribute -1 TH;
- key Processed ingredient: may contribute -2 TH;
- total Processed stabilization: capped at -2 TH.

A Processed Item therefore stores `processedStabilizationHint`; the later recipe decides `processedRole` / actual stabilization.

## Tag-driven eligibility

`js/item-processing-engine.js` resolves methods from existing Item data:

- family/group;
- recipeRoles;
- flavorTags;
- functionalTags;
- craftTags;
- normal Item tags;
- processing form/tags created by earlier processing stages.

Examples:

```text
fruit
-> Cut, Chop, Crush, Mash, Dry, Pickle, Bake

vegetable
-> Cut, Chop, Mash, Boil, Blanch, Grill, Pan Fry, Steam,
   Roast, Simmer, Stir Fry, Dry, Pickle

grain
-> Grind, Boil, Roast

meat
-> Cut, Chop, Boil, Grill, Pan Fry, Steam, Roast, Simmer,
   Deep Fry, Smoke, Dry, Cure
```

Specific semantic tags add routes:

```text
juice          -> Juice
flour_source   -> Grind
oil_source     -> Press
paste_source   -> Grind / Mash
fermentable    -> Ferment
tea            -> Brew
broth_base     -> Simmer
sauce          -> Simmer / Reduce
bake           -> Bake
roast          -> Roast
stir_fry       -> Stir Fry
pickle         -> Pickle
preserve       -> Dry / Pickle
medicinal      -> Brew / Delicate Extract
```

This is additive by default.

An Item can explicitly override the derived set with:

- `processingMethodsAllowed`
- `processingMethodsDenied`

Explicit deny wins. This provides the "specific tag/Item rule wins over broad family behavior" escape hatch without hard-coding every current ingredient.

## Multi-stage processing

Processed forms expose the next legal methods through form rules.

Examples:

```text
Wheat [Affinity]
  -> Grind
Flour [same Affinity]
  -> Knead + liquid/binder
Dough [same Affinity]
  -> Bake / Steam / Deep Fry
```

```text
Apple [Affinity]
  -> Juice
Apple Juice [same Affinity]
  -> Reduce
Syrup [same Affinity]
```

```text
Ferment Base
  -> Brew or Distill
```

Knead requires at least Flour plus a liquid/binder input.
Reduce requires a liquid/concentrated-compatible form.
Distill requires a fermented or brewed source.

## Affinity and provenance

Every Processed output carries:

- `culinaryProperties`;
- original `sourceInstanceId` values on those properties;
- `sourceItemIds`;
- `sourceInstanceIds`;
- a provenance snapshot of its direct inputs.

Distinct original source instances remain distinct contributors.

Repeated processing of the same original source does not clone the same affinity contribution.

Example:

```text
Apple A [Arcana]
  -> Apple Juice
  -> Syrup
  -> later recipe
```

Apple A remains one Arcana source throughout the chain.

If Wolf A and Carrot B are simmered into Stock, the Stock may carry both realized properties and both source IDs.

## TH integration

Each processing method maps directly to an existing Cooking V1 method family and Base TH. The processing engine validates its method table against `LuminousCookingEngine.methodBaseTh`.

`buildProcessingRecipe()` creates a Cooking-compatible recipe descriptor so later UI/runtime work can route processing through the normal Limbus Check resolver rather than inventing a second dice system.

## Quantity / Taste / economy

V1 deliberately does not invent universal conversion yields, Taste deltas or Processed Production Values.

The engine accepts authored output quantity, Quality and Taste when a concrete processing recipe supplies them.

Future catalog data should define:

- consumed input quantity;
- output yield;
- Processed Taste change where relevant;
- Production Value / AHN economics;
- tool/station requirements.

Those values belong to concrete processing recipes and economy data, not the generic method taxonomy.

## Current coverage

The Processing V1 rules are tested against all current culinary raw definitions:

- 76 Plant / Produce / Herb / Fungi Items;
- 39 Meat Items.

All 115 receive at least one valid processing route from their current family/tags.

The Plant and Meat catalogs expose:

- `processingMethodsFor(itemOrId)`
- `processIngredient(stackOrId, methodId, options)`

so callers do not need to manually reconstruct definition tags around a generated stack.

## Canonical implementation

- `js/item-processing-engine.js`
- `tests/item-processing-engine-smoke.cjs`
- `docs/item-processing-handoff.md`
- `js/item-cooking-engine.js`
- `js/item-catalog-plant-produce.js`
- `js/item-catalog-meat.js`

## Next pass

Processing Methods V1 provides the transformation grammar.

The next data layer is concrete Processed recipes/outputs: authored quantities, Taste/economy, equipment/stations and any specific source-to-output overrides that cannot be represented by the generic tag rules.
