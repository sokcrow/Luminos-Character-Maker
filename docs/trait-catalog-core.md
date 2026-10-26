# Core Trait Catalog

This module is the canonical code catalog for Traits whose mechanics were explicitly fixed while designing Trait Engine V1.

## Contract

Every entry is declarative and follows the same rule shape:

`WHEN trigger -> IF conditions -> DO operations -> VALUE/formula`

Definitions and progression Grants are separate. No Trait is implemented with `if (traitId === ...)` inside Theatre or Combat.

The exported canonical `DEFINITIONS` and `GRANTS` graphs are recursively frozen. Consumers that need editable values must use `getDefinition()`, `allDefinitions()` or `allGrants()`, which return copies.

## Programmed definitions

### Danger Senses

- Context: Theatre
- Activation: Passive
- Trigger: `before_check`
- Condition: `check.abilityId === "dex"`
- Operation: `check.difficulty += -4`
- Source metadata: Barbarian
- No acquisition level is hardcoded until the original class progression is explicitly confirmed.

### Green Eyed Heir

- Context: Theatre
- Activation: Passive
- Trigger: `before_check`
- Condition: `check.skillId in ["insight", "perception"]`
- Operation: `check.finalPower += 2`
- No progression Grant is hardcoded because its source/progression was not fixed in the recovered rules.

### Rage

- Context: Combat
- Activation: Manual
- Action Cost: Quick Action
- Uses: `floor(ClassLevel / 7)`
- Reset: Long Rest
- Activation condition: Rage Status is absent
- On Use: apply `rage` Status until removed
- Source metadata: Barbarian
- No acquisition level is hardcoded until the original class progression is explicitly confirmed.

### Devil Body

- Context: Combat
- Activation: Automatic
- Trigger: `turn_start`
- Operation: heal HP by `floor(DefensiveLevel / 2)` capped by Max HP
- Confirmed source: `devil_lineage`
- Core Grant: `devil_lineage -> devil_body`

### Devil Trigger

- Context: Combat
- Activation: Manual
- Action Cost: None
- On Use: consume all `devil_gauge` and store the consumed value as `ConsumedGauge`
- Known threshold: if `ConsumedGauge >= 7`, add `OffensiveLevel` to `self.damagePercent`
- No progression Grant is hardcoded because its exact source/progression was not fixed in the recovered rules.

## Progression rule

A Definition can be mechanically complete without a Grant. Grants are only included in the code catalog when ownership/progression is known without guessing. Class acquisition levels that appeared only as examples are deliberately not converted into canonical progression.

The DM can assign those Definitions through the normal Grant UI after their intended Class/Race/Background/Lineage and level are confirmed.

## Safe DM import

`js/dm-trait-catalog-importer.js` imports the catalog into `campaña/config/traits`.

Import uses one Firebase Realtime Database transaction at `campaña/config/traits`. The transaction callback rebuilds the import plan from the current transaction state every time Firebase invokes or retries it. This makes the absence check and write atomic: if another DM creates or edits a Trait/Grant during import, Firebase retries against that newer state before the catalog can commit.

The importer:

- never replaces an existing Definition with the same ID;
- preserves unrelated data under the Traits root;
- deduplicates Grants by semantic identity, including Grants stored under arbitrary push IDs;
- uses deterministic IDs for catalog Grants;
- adds missing Definitions and Grants inside the same root transaction;
- is idempotent;
- aborts cleanly when there is nothing to add.

## Tests

`tests/trait_catalog_core.spec.js` covers:

- validation of every Definition;
- positive and negative Theatre conditions;
- Rage action economy, ClassLevel scaling, Status and reactivation guard;
- Devil Body healing and HP cap;
- Devil Trigger resource consumption and threshold behavior;
- confirmed Lineage Grant resolution;
- absence of guessed Class acquisition Grants;
- copy-based mutable accessors;
- recursive immutability of exported canonical Definitions and Grants.

`tests/dm_trait_catalog_importer.spec.js` covers:

- import planning for an empty library;
- no overwrite of DM-custom Definitions;
- semantic Grant deduplication;
- atomic mutation preserving custom concurrent state;
- simulated Firebase transaction retry after a concurrent DM write;
- preservation of unrelated data under the Traits root;
- Firebase-safe deterministic Grant IDs;
- DM loader ordering contract.

## Adding another Trait

1. Add one Definition to `js/trait-catalog-core.js`.
2. Add a Grant only when its source/progression is explicitly known.
3. Validate it with `TraitEngine.validateTrait()`.
4. Add at least one positive and one negative behavior test.
5. If the mechanic cannot be expressed with current operations, add a generic operation to Trait Engine first. Do not special-case the Trait by name.
