# Spellcasting Basic Rules v1

## Scope

`js/spellcasting-runtime.js` owns the shared Spellcasting Ability registry, Limbus caster progression, automatic Spell Slot tables, Spell Mod, Spell Attack and Spell Save DC bridge. `js/spellcasting-basic-rules-runtime.js` extends it with resource spending, recovery, Overcast, Upcast, Saving Throw, Casting Time and Concentration contracts.

`js/caster-spellcasting-traits-runtime.js` exposes the Level 1 **Spellcasting Ability** Trait for every caster Class and is auto-loaded by the Spellcasting runtime.

This version intentionally does **not** invent a universal Spell Power formula. Spells may define their own Skill/Coin power while the runtime owns the shared resources and resolution metadata below.

## Limbus Class Level conversion

Caster progression follows the project conversion:

- D&D Level 1 = Limbus Class Level 1.
- From D&D Level 2 onward, `Limbus milestone = D&D Level × 5`.
- Intermediate Limbus Levels keep the latest unlocked D&D row.

Runtime conversion:

`Effective D&D Level = max(1, floor(Limbus Class Level / 5))`, capped at 20, for any Class Level above 0.

Examples:

- Limbus 1–9 -> D&D row 1
- Limbus 10–14 -> D&D row 2
- Limbus 15–19 -> D&D row 3
- Limbus 25–29 -> D&D row 5
- Limbus 85–89 -> D&D row 17
- Limbus 100 -> D&D row 20

Spell Slots use the **source Class Level**, not total Character Level.

## Spellcasting Ability Trait

Every caster Class receives one passive Level 1 Trait named **Spellcasting Ability**.

The Trait records:

- Spellcasting Ability
- caster progression
- automatic Slot generation
- recovery rule
- `Spell Attack = Proficiency + SpellMod`
- `Spell Save DC = 8 + Proficiency + SpellMod`

Bard keeps its existing `spellcasting` Trait id for compatibility; the shared caster runtime normalizes that definition to the same Spellcasting Ability contract and de-duplicates the Level 1 grant.

### Class profiles

| Class | Spellcasting Ability | Progression | Slot recovery |
| --- | --- | --- | --- |
| Artificer | Intelligence | Half | Long Rest |
| Bard | Charisma | Full | Long Rest |
| Cleric | Wisdom | Full | Long Rest |
| Druid | Wisdom | Full | Long Rest |
| Paladin | Charisma | Half | Long Rest |
| Ranger | Wisdom | Half | Long Rest |
| Sorcerer | Charisma | Full | Long Rest |
| Warlock | Charisma | Pact | Short Rest or Long Rest |
| Wizard | Intelligence | Full | Long Rest |

Spanish/legacy aliases such as `hechicero`, `mago`, `brujo`, `bardo`, `clerigo` and `druida` normalize to the canonical Class ids.

## Spellcasting Ability, Spell Attack and DC

A Class profile supplies the default Spellcasting Ability. A saved Class entry may explicitly override its Ability when a future Class feature requires it.

- `SpellMod = Class Spellcasting Ability modifier`
- `SpellAttack = SpellMod + Proficiency`
- `SpellDC = 8 + SpellMod + Proficiency`
- Archetype Traits inherit their parent `classId` and therefore the parent Class Spellcasting Ability.

## Automatic Spell Slots

Slots are tracked **per Class and Slot Level** in `character.spellcastingState.slotsByClass`.

If saved Class data explicitly supplies a Slot table, that table remains an override for compatibility. Otherwise the runtime derives the table automatically from:

`source Class Level -> effective D&D Level -> caster progression -> Slot table`

Current V1 keeps Class Slot pools independent. It does not merge Full/Half/Third caster levels into one D&D multiclass pool.

### Full Caster progression

Used by Bard, Cleric, Druid, Sorcerer and Wizard.

| Limbus | Effective D&D | SL1 | SL2 | SL3 | SL4 | SL5 | SL6 | SL7 | SL8 | SL9 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 2 | - | - | - | - | - | - | - | - |
| 10 | 2 | 3 | - | - | - | - | - | - | - | - |
| 15 | 3 | 4 | 2 | - | - | - | - | - | - | - |
| 20 | 4 | 4 | 3 | - | - | - | - | - | - | - |
| 25 | 5 | 4 | 3 | 2 | - | - | - | - | - | - |
| 30 | 6 | 4 | 3 | 3 | - | - | - | - | - | - |
| 35 | 7 | 4 | 3 | 3 | 1 | - | - | - | - | - |
| 40 | 8 | 4 | 3 | 3 | 2 | - | - | - | - | - |
| 45 | 9 | 4 | 3 | 3 | 3 | 1 | - | - | - | - |
| 50 | 10 | 4 | 3 | 3 | 3 | 2 | - | - | - | - |
| 55 | 11 | 4 | 3 | 3 | 3 | 2 | 1 | - | - | - |
| 60 | 12 | 4 | 3 | 3 | 3 | 2 | 1 | - | - | - |
| 65 | 13 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | - | - |
| 70 | 14 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | - | - |
| 75 | 15 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | - |
| 80 | 16 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | - |
| 85 | 17 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | 1 |
| 90 | 18 | 4 | 3 | 3 | 3 | 3 | 1 | 1 | 1 | 1 |
| 95 | 19 | 4 | 3 | 3 | 3 | 3 | 2 | 1 | 1 | 1 |
| 100 | 20 | 4 | 3 | 3 | 3 | 3 | 2 | 2 | 1 | 1 |

### Half Caster progression

Used by Artificer, Paladin and Ranger.

| Limbus | Effective D&D | SL1 | SL2 | SL3 | SL4 | SL5 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 2 | - | - | - | - |
| 10 | 2 | 2 | - | - | - | - |
| 15 | 3 | 3 | - | - | - | - |
| 20 | 4 | 3 | - | - | - | - |
| 25 | 5 | 4 | 2 | - | - | - |
| 30 | 6 | 4 | 2 | - | - | - |
| 35 | 7 | 4 | 3 | - | - | - |
| 40 | 8 | 4 | 3 | - | - | - |
| 45 | 9 | 4 | 3 | 2 | - | - |
| 50 | 10 | 4 | 3 | 2 | - | - |
| 55 | 11 | 4 | 3 | 3 | - | - |
| 60 | 12 | 4 | 3 | 3 | - | - |
| 65 | 13 | 4 | 3 | 3 | 1 | - |
| 70 | 14 | 4 | 3 | 3 | 1 | - |
| 75 | 15 | 4 | 3 | 3 | 2 | - |
| 80 | 16 | 4 | 3 | 3 | 2 | - |
| 85 | 17 | 4 | 3 | 3 | 3 | 1 |
| 90 | 18 | 4 | 3 | 3 | 3 | 1 |
| 95 | 19 | 4 | 3 | 3 | 3 | 2 |
| 100 | 20 | 4 | 3 | 3 | 3 | 2 |

### Pact Caster progression

Warlock keeps Pact Slots separate from Full/Half progression.

| Limbus | Effective D&D | Pact Slots | Slot Level |
| ---: | ---: | ---: | ---: |
| 1 | 1 | 1 | 1 |
| 10 | 2 | 2 | 1 |
| 15 | 3 | 2 | 2 |
| 20 | 4 | 2 | 2 |
| 25 | 5 | 2 | 3 |
| 30 | 6 | 2 | 3 |
| 35 | 7 | 2 | 4 |
| 40 | 8 | 2 | 4 |
| 45 | 9 | 2 | 5 |
| 50 | 10 | 2 | 5 |
| 55–80 | 11–16 | 3 | 5 |
| 85–100 | 17–20 | 4 | 5 |

The base runtime also exposes a reusable `third` progression table for future archetypes such as Eldritch Knight or Arcane Trickster; those archetypes are not assigned by this caster-Class patch.

### Slot spending and recovery

- Cantrips (`slotLevel: 0`) spend no Slot.
- A leveled Spell normally spends one Slot of the level used to cast it.
- Casting with a higher Slot Level is Upcast.
- Long Rest restores Full and Half caster Slots.
- Warlock Pact Slots restore on Short Rest or Long Rest.

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

- Trait Engine: receives `SpellMod`, `SpellAttack` and `SpellDC` from the source Class Spellcasting profile.
- Trait Catalog: receives one Level 1 Spellcasting Ability grant for each caster Class.
- Fixed Damage: owns Overcast overflow damage application.
- Scene Time: owns elapsed time and Action Instance progression.
- Rest Runtime: emits `luminous:rest-completed`; Spellcasting restores Slots according to each Class recovery profile and persists `spellcastingState` when Firebase/player identity is available.
- Combat/Save UI: consumes the returned casting, Save, Upcast, target and Concentration contracts. This module does not replace Coin Engine or Check execution.
