# Core Trait Catalog

This module is the canonical code catalog for Traits whose mechanics were explicitly fixed while designing Trait Engine V1.

## Contract

Every entry is declarative and follows the same rule shape:

`WHEN trigger -> IF conditions -> DO operations -> VALUE/formula`

Definitions and progression Grants are separate. No Trait is implemented with `if (traitId === ...)` inside Theatre or Combat.

## Programmed definitions

### Danger Senses

- Context: Theatre
- Activation: Passive
- Trigger: `before_check`
- Condition: `check.abilityId === "dex"`
- Operation: `check.difficulty += -4`
- Core Grant: Barbarian level 2

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
- Core Grant: Barbarian level 2

### Devil Body

- Context: Combat
- Activation: Automatic
- Trigger: `turn_start`
- Operation: heal HP by `floor(DefensiveLevel / 2)` capped by Max HP
- Core Grant: `devil_lineage`

### Devil Trigger

- Context: Combat
- Activation: Manual
- Action Cost: None
- On Use: consume all `devil_gauge` and store the consumed value as `ConsumedGauge`
- Known threshold: if `ConsumedGauge >= 7`, add `OffensiveLevel` to `self.damagePercent`
- No progression Grant is hardcoded because its exact source/progression was not fixed in the recovered rules.

## Why some Grants are absent

The catalog only persists progression that is known. A missing Grant does not mean the Trait is unfinished mechanically; it means Class/Race/Background/Lineage ownership must be assigned through the DM Grant system instead of guessed in source code.

## Tests

`tests/trait_catalog_core.spec.js` covers:

- validation of every Definition;
- positive and negative Theatre conditions;
- Rage action economy, ClassLevel scaling, Status and reactivation guard;
- Devil Body healing and HP cap;
- Devil Trigger resource consumption and threshold behavior;
- Class and Lineage Grant resolution;
- level-gated Grants;
- immutable access through catalog copy helpers.

## Adding another Trait

1. Add one Definition to `js/trait-catalog-core.js`.
2. Add a Grant only when its source/progression is explicitly known.
3. Validate it with `TraitEngine.validateTrait()`.
4. Add at least one positive and one negative behavior test.
5. If the mechanic cannot be expressed with current operations, add a generic operation to Trait Engine first. Do not special-case the Trait by name.
