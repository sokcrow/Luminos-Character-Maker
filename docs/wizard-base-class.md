# Wizard Base Class Runtime

This document records the Luminous Wizard base-class implementation. Arcane Traditions are intentionally deferred.

## Progression

| Wizard Class Level | Trait |
|---:|---|
| 1 | Spellcasting Ability (shared caster runtime) |
| 1 | Spellbook |
| 1 | Ritual Casting |
| 1 | Arcane Recovery |
| 90 | Spell Mastery |
| 100 | Signature Spells |

Universal Class Milestones handle ASIs separately.

## Spellbook

At Wizard Level 1, learn 3 Wizard Cantrips and add 6 Level 1 Wizard Spells to the Spellbook.

At Wizard Level 10 and every 5 Wizard Levels afterward, add 2 Wizard Spells the Wizard can cast.

Prepared Spell Limit:

```text
max(1, floor(Wizard Level / 5)) + Intelligence Modifier
```

The result has a minimum of 1. Cantrips do not require preparation. Combat availability is Cantrips + Prepared Spells + Signature Spells.

## Ritual Casting

A Wizard Spell with the Ritual tag can be cast as a Ritual when it is in the Spellbook, even if it is not Prepared.

Ritual Casting consumes no Spell Slot and adds 10 minutes to the normal Casting Time.

## Arcane Recovery

After a Short Rest, the Wizard may recover expended Spell Slots once per Long Rest.

```text
Recovery Limit = max(1, floor(Wizard Level / 10))
```

The sum of recovered Slot Levels cannot exceed the Recovery Limit. Level 6 or higher Spell Slots cannot be recovered.

## Spell Mastery

At Wizard Level 90, choose one Level 1 and one Level 2 Wizard Spell from the Spellbook.

While Prepared, each selected Spell can be cast at its base Level without consuming a Spell Slot. Upcasting consumes a normal Spell Slot. The selections may be changed after a Long Rest.

## Signature Spells

At Wizard Level 100, choose two Level 3 Wizard Spells from the Spellbook.

They are always Prepared and do not count against the Prepared Spell Limit. Each can be cast once without consuming a Spell Slot, recovering that free use on a Short or Long Rest. Upcasting consumes a normal Spell Slot.

## Runtime state

Wizard-specific state is stored under:

```text
classResources.wizard
```

Shared Spell Slot state remains owned by the shared Spellcasting runtime.
