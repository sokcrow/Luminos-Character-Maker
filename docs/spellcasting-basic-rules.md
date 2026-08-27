# Spellcasting Basic Rules v1

## Scope

`js/spellcasting-runtime.js` remains the shared Spell Mod / Spell DC bridge. `js/spellcasting-basic-rules-runtime.js` extends it with the reusable resource and resolution contract without replacing the Trait, Combat, Fixed Damage, Rest, Action Economy, or Scene Time engines.

This version intentionally does **not** invent a universal Spell Power formula. Spells may define their own Skill/Coin power, while the runtime owns the shared resources and resolution metadata below.

## Spellcasting Ability and DC

A Class registers one default Spellcasting Ability. Bard remains Charisma. A saved Class entry may explicitly override its Spellcasting Ability when a Class or feature requires it.

- `SpellMod = Class Spellcasting Ability modifier`
- `SpellDC = 8 + SpellMod + Proficiency`
- Archetype Traits inherit their parent `classId` and therefore the parent Class Spellcasting Ability.

## Spell Slots

Slots are tracked **per Class and Slot Level** in `character.spellcastingState.slotsByClass`. The runtime does not assume a multiclass slot-merging policy. Each Class supplies its own slot table.

- Cantrips (`slotLevel: 0`) spend no Slot.
- A leveled Spell normally spends one Slot of the level used to cast it.
- Casting with a higher Slot Level is Upcast.
- Long Rest restores spent Spell Slots.

## Overcast

If the required Slot is unavailable, callers may explicitly permit Overcast.

`Overcast SP Cost = Slot Level × 15 SP`

SP is paid first. Any unpaid remainder becomes the same canonical **Fixed Damage** already owned by `LuminousFixedDamageRuntime`.

Example: a Level 3 Spell costs 45 SP. At 20 SP, the caster goes to 0 SP and receives 25 Fixed Damage.

Fixed Damage keeps its existing contract: defensive reductions cannot lower it, but Shield still absorbs it before HP.

## Upcast

Upcast scaling is metadata-driven and exposes four independent per-extra-level channels:

- `finalPower`
- `coinPower`
- `atkWeight`
- `duration`

A Spell may use any subset. Missing channels are zero. The runtime returns resolved deltas and does not force every Spell to scale in every channel.

## Saving Throws

A Spell Save declares:

- Save Ability (`str`, `dex`, `con`, `int`, `wis`, `cha`)
- success behavior: `negates`, `half`, `reduced`, or `special`

The DC always comes from the source Class Spellcasting contract. The runtime returns Save metadata; the existing Check/Save execution layer remains responsible for the actual roll and downstream effects.

## Target Type

The shared target categories are:

`self`, `single`, `multi`, `area`, `allies`, `enemies`, `special`.

Unknown/custom target descriptions normalize to `special` rather than creating engine-specific exceptions.

## Casting Time and Scene Time

Casting Time uses the existing Scene Time clock rather than a new timer.

- normal Action cast: 6 seconds
- Quick/Bonus Action cast: 3 seconds
- explicit `castingTimeRounds`: rounds × 6 seconds
- explicit `castingTimeSeconds`: exact declared seconds
- instant/free casts create no blocking Scene Time Action Instance

`buildCastingActionMessage()` produces the same `actuar` Action Instance contract used by Scene Time. During Combat, completed rounds already advance that same clock by 6 seconds, so long casts continue across rounds without double-counting time.

## Concentration

Only one active Concentration Spell is stored per caster. Starting another Concentration Spell replaces the previous one.

When the caster takes damage from one Skill:

1. collect the damaging Final Power values produced by that Skill;
2. use the **highest Final Power** as the Constitution Check DC;
3. create only one Concentration Check for that Skill event, even if the Skill has multiple damaging Coins/hits;
4. success preserves Concentration;
5. failure ends the active Concentration Spell.

The runtime de-duplicates checks by `skillEventId` / event id so repeated combat bookkeeping cannot request multiple Concentration checks for the same Skill.

## Integration boundaries

- Trait Engine: continues to receive `SpellMod` and `SpellDC` through the existing wrapper; the V1 extension may override the Class Ability from saved Class data.
- Fixed Damage: owns Overcast overflow damage application.
- Scene Time: owns elapsed time and Action Instance progression.
- Rest Runtime: emits `luminous:rest-completed`; Spellcasting listens for Long Rest, restores Slots, and persists `spellcastingState` when Firebase/player identity is available.
- Combat/Save UI: consumes the returned casting, Save, Upcast, target, and Concentration contracts. This module does not replace Coin Engine or Check execution.
