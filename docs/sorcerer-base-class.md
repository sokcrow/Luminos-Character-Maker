# Sorcerer Base Class Runtime

This document records the Luminous base-class integration for the D&D 5e 2014 Sorcerer. Sorcerous Archetypes are intentionally deferred.

## Progression

| Sorcerer Class Level | Trait |
|---:|---|
| 1 | Spellcasting (provided by the generic caster spellcasting runtime) |
| 1 | Sorcerous Origin |
| 10 | Font of Magic |
| 15 | Metamagic: choose 2 options |
| 50 | Metamagic: +1 option |
| 85 | Metamagic: +1 option |
| 100 | Sorcerous Restoration |

Sorcerer ASIs are not class Traits in Luminous; the universal Class Milestone system handles those choices.

## Sorcery Points

`Sorcery Points = floor(Sorcerer Class Level / 5)`, minimum 1 while the character has Sorcerer levels.

Sorcery Points recover fully on Long Rest. At Sorcerer Class Level 100, Sorcerous Restoration also recovers 4 Sorcery Points on Short Rest.

Sorcery Points are stored separately from normal Luminous `SP` to avoid collision with Overcast.

## Font of Magic

As a Quick Action, Font of Magic can create a temporary Spell Slot or convert a Spell Slot into Sorcery Points.

| Slot Level | Sorcery Point Cost |
|---:|---:|
| 1 | 2 |
| 2 | 3 |
| 3 | 5 |
| 4 | 6 |
| 5 | 7 |

Converting a Spell Slot restores Sorcery Points equal to its Slot Level, up to the character's Sorcery Point maximum. Created Spell Slots are tracked separately and are removed on Long Rest.

## Metamagic

The runtime registers ten Metamagic option Traits:

- Careful Spell
- Distant Spell
- Empowered Spell
- Extended Spell
- Heightened Spell
- Quickened Spell
- Subtle Spell
- Twinned Spell
- Seeking Spell
- Transmuted Spell

Normally only one Metamagic applies to a Spell. Empowered Spell and Seeking Spell may each combine with one other Metamagic.

The Limbus adaptations use native combat channels where possible: Clash Power, Final Power, ATK Weight, `isUnclashable`, unbreakable Coins, Sin Type, Save Thresholds, and Speed comparison.

## Sorcerous Origin

Sorcerous Origin is granted at Class Level 1. The Trait records the later archetype progression points (1, 30, 70, 90), but archetype selection and archetype Trait definitions are deliberately not implemented in this runtime yet.

## Runtime API

`js/sorcerer-class-runtime.js` exposes `LuminousSorcererClassRuntime` in the browser and CommonJS exports in tests. The API owns Sorcery Point state, Font of Magic conversions, Metamagic selection/transforms, created Spell Slots, Sorcerer casting through created slots, rest recovery, and catalog registration.
