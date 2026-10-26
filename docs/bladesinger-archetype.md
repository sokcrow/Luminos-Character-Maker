# Bladesinger Archetype Runtime

Bladesinger is a Wizard Archetype. It unlocks at Wizard Class Level 10.

## Automatic Trait progression

| Wizard Class Level | Trait |
|---:|---|
| 10 | Training in War and Song |
| 10 | Bladesong |
| 30 | Additional Attack (shared universal Trait) |
| 50 | Song of Defense |
| 70 | Song of Victory |

The Archetype engine grants these Traits automatically when the character has selected Bladesinger for Wizard and reaches the required Wizard Class Level.

## Training in War and Song

Automatically grants Light Armor and Performance proficiency.

The player also chooses one One-Handed Melee Weapon type. That choice is stored as:

```text
traitChoices.training_in_war_and_song_weapon
```

## Bladesong

Quick Action: activate the **Bladesong** Status.

Status icon:

```text
https://imgur.com/kkJI5mM.png
```

While active:

- Gain +INT Modifier Defense Power.
- Gain +1 Min Speed and +1 Max Speed.
- Gain +4 on Acrobatics Checks.
- Gain +INT Modifier to Constitution Saves made to maintain Concentration.

Bladesong ends if the unit becomes Incapacitated or uses incompatible equipment: Medium/Heavy Armor, a Shield, or a Two-Handed Weapon.

## Additional Attack

Bladesinger reuses the shared `additional_attack` Trait already defined by the core Trait catalog. It is not duplicated.

## Song of Defense

While Bladesong is active, use a Reaction and spend one Wizard Spell Slot.

```text
Damage Reduction = 10% × Spell Slot Level
```

Examples:

- Level 1 Slot: 10%
- Level 5 Slot: 50%
- Level 9 Slot: 90%

The selected Spell Slot is spent from the shared Wizard Spell Slot pool.

## Song of Victory

While Bladesong is active, Melee Attack Skills gain:

```text
Damage Bonus = 5% × INT Modifier
```

With INT Modifier +5, Melee Attack Skills deal +25% Damage.
