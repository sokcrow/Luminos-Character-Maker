# Item Affinity V1 handoff

Status: canonical Item-affinity contract for PR #777.

This contract replaces the former Normal / Notable / Rare / Exceptional ingredient-property count model. Ingredient instances do not carry a culinary rarity tier or a per-ingredient power score.

## Purpose

Item Affinity V1 answers two related questions with one lightweight data model:

1. Which exact culinary Skill/Save target is a procedural instance likely to adopt?
2. Which base Items should world-generation systems prefer when a shop, district or location is looking for a particular gameplay branch such as INT or WIS?

The affinity data belongs to the base Item definition. Cooking consumes the realized property on an Item instance; it does not reroll the base affinity table.

## Base Item schema

A culinary-capable base Item may declare:

```js
culinaryAffinities: {
  survival: 40,
  athletics: 25,
  con_save: 20,
  nature: 10,
  arcana: 5,
}
```

Rules:

- each value is a percentage-point weight on a 0..100 authoring scale;
- canonical catalog distributions sum to exactly 100;
- values are relative selection weights, not direct Power, rarity or Item Quality;
- zero/negative/invalid entries are ignored by the engine as defensive compatibility behavior;
- non-canonical external/legacy data may still be normalized for selection/reporting, but PR #777 catalog data must total 100;
- a base Item may expose many valid targets with different weights.

## Procedural instance resolution

When a new procedural ingredient instance needs a culinary property, Item Affinity V1 performs one weighted selection from the base Item's `culinaryAffinities`.

The realized instance carries one exact target:

```js
culinaryProperties: [{
  target: "arcana",
  sourceInstanceId: "ingredient-instance-123",
  affinityBranch: "int",
  source: "item_affinity_v1",
}]
```

The source percentage is not copied into the instance. It served only to resolve the RNG result; Power continues to come from recipe composition, Recipe TH and star quality.

There is no Normal / Notable / Rare / Exceptional roll and no separate property-count roll.

The selected target is the property Cooking later consumes. The base percentage table remains catalog data and is not recalculated into a persistent score on every ingredient.

The realized target is part of stack identity. Two otherwise-identical stacks with different realized targets do not merge. Current culinary stacks use affinity-aware stack policies alongside their existing Quality/Size/Lineage identity.

## Ability-branch projection

Exact culinary targets project to their normal gameplay branch:

- STR: Athletics, STR Save
- DEX: Acrobatics, Sleight of Hand, Stealth, DEX Save
- CON: CON Save
- INT: Arcana, History, Investigation, Nature, Religion, INT Save
- WIS: Animal Handling, Insight, Medicine, Perception, Survival, WIS Save
- CHA: Deception, Persuasion, Intimidation, Performance, CHA Save

The engine can aggregate an Item's exact-target weights into branch weights.

Example:

```text
Arcana 30
History 20
Survival 40
CON Save 10

=> INT 50 / WIS 40 / CON 10
```

World-generation systems may use this projection to prefer Items for a location or seller. For example, a food shop in an INT-focused magical district can prefer Items with stronger INT branch weight.

World placement does not rewrite the Item's intrinsic affinity table. The location chooses which Items are more likely to appear; the generated Item instance still resolves from its own base affinity pool.

Semantic world tags such as `magic`, `military`, `luxury` or `rural` may later map to branch/target demand profiles. They are not baked into Cooking V1 and are not required to resolve a culinary property.

## Cooking interaction

Item Affinity and recipe affinity are separate concepts:

- Item Affinity = catalog-side RNG weights used to materialize one exact property on an ingredient instance.
- Recipe affinity contribution = the realized ingredient property's contribution after the ingredient is assigned a recipe role.

Cooking V1 keeps the recipe-role contribution weights:

- Core / Major = 3
- Minor = 2
- Seasoning = 1
- Garnish = 0

Distinct source instances with the same realized target legitimately combine inside a recipe.

## Processing and provenance

Processing must not silently reroll or clone an already-realized source property.

If an ingredient instance with `sourceInstanceId=A` becomes a Processed Item, the Processed Item carries that realized property and source provenance forward unless a later explicitly approved processing rule says otherwise.

The default affinity engine therefore preserves existing `culinaryProperties` and does not reroll them.

This keeps chains such as:

```text
Mystic Apple -> Syrup -> Pastry
```

from turning one original source Item into multiple independent affinity rolls.

Processing Methods V1 is now defined in `js/item-processing-engine.js`. Generic processing preserves existing `culinaryProperties` and source provenance by default. Concrete source-to-output yields, Taste/economy and exceptional affinity-transforming methods remain later recipe/catalog data.

## Canonical implementation

- `js/item-affinity-engine.js`
- `tests/item-affinity-engine-smoke.cjs`
- `docs/item-affinity-handoff.md`
- `js/item-cooking-engine.js`
- `docs/item-cooking-handoff.md`

## Current catalog coverage

PR #777 currently assigns canonical 100-point `culinaryAffinities` distributions to:

- all 76 Plant / Produce / Herb / Fungi catalog Items;
- all 39 Meat catalog Items.

The 39 simple Cooked Meat definitions expose the source Meat affinity profile, and cooked stacks preserve the already-realized source target/provenance rather than rerolling.

Canonical data lives in `js/item-culinary-affinity-data.js`. Shared profiles keep similar ingredients coherent while `PROFILE_BY_ITEM` explicitly covers every current culinary Item ID.

Future culinary catalogs must add affinity coverage and pass the same 100-point validation rather than inventing a parallel system.
