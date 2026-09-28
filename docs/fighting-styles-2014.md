# Universal Fighting Styles — D&D 5e 2014

This runtime is the canonical shared source for the six core 2014 Fighting Styles. Class runtimes and Traits should reference these definitions instead of copying their mechanics.

## Canonical style IDs

| Style | Trait ID | Luminous adaptation |
| --- | --- | --- |
| Archery | `fighting_style_archery` | Ranged Attack Skills gain +1 Clash Power. |
| Defense | `fighting_style_defense` | While Armor is equipped, gain +1 Defensive Level. |
| Dueling | `fighting_style_dueling` | One-handed melee weapon, no second weapon: +10% Damage to Melee Attack Skills. A Shield is allowed. |
| Great Weapon Fighting | `fighting_style_great_weapon_fighting` | Two-handed melee weapon: +10% Damage to Melee Attack Skills. |
| Protection | `fighting_style_protection` | Reaction with Shield: protect a visible Ally while adjacent and apply -2 Final Power to the incoming Attack Skill for that attack. |
| Two-Weapon Fighting | `fighting_style_two_weapon_fighting` | One-handed melee weapon in each hand: +10% Damage to Melee Attack Skills. |

The three damage styles use the existing `damage_dealt_multiplier` Rule-of-0.1 channel. They are mutually separated by equipment conditions rather than class checks.

## 2014 class availability

| Class | D&D unlock | Limbus unlock | Options |
| --- | ---: | ---: | --- |
| Fighter | 1 | 1 | Archery, Defense, Dueling, Great Weapon Fighting, Protection, Two-Weapon Fighting |
| Ranger | 2 | 10 | Archery, Defense, Dueling, Two-Weapon Fighting |
| Paladin | 2 | 10 | Defense, Dueling, Great Weapon Fighting, Protection |

A style cannot be selected more than once.

## Runtime API

The browser bootstrap exposes:

- `LuminousFightingStyleCatalog.get(id)`
- `LuminousFightingStyleCatalog.forClass(classId)`
- `LuminousFightingStyleCatalog.choiceForClass(classId)`
- `LuminousFightingStyleCatalog.grantFor(styleId, source)`
- `LuminousFightingStyleCatalog.validateSelection(selection, options)`
- `LuminousFightingStyleRuntime.selectedStyles(character)`
- `LuminousFightingStyleRuntime.resolveSelectedTraits(character, options)`
- `LuminousFightingStyleRuntime.canUseProtection(context)`
- `LuminousFightingStyleRuntime.useProtection(context)`

No class receives a Fighting Style automatically from this module. A class or Trait owns the choice/grant; this module owns the shared definition and execution contract.

## Protection contract

`useProtection()` validates that the protector actually has Protection, has a Shield, is protecting another visible Ally while adjacent, is responding to an Attack Skill, and has a Reaction available. It consumes that Reaction and returns a `this_attack` outcome with `finalPowerModifier: -2` for the incoming Skill.

The combat caller that owns the attack timing window is responsible for applying that returned modifier to the current attack resolution. This avoids introducing a second Reaction or attack engine.

## Equipment note

The current weapon catalog exposes `equipment.handCost`. Great Weapon Fighting therefore recognizes weapons currently represented as using two hands. If a versatile one-handed chassis is later given an explicit two-handed grip state, that state should materialize as a two-hand equipment profile/hand cost before Fighting Style resolution rather than adding weapon-name exceptions here.
