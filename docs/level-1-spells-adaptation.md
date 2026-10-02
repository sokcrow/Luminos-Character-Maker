# Level 1 Spells Adaptation

This branch is the dedicated integration line for Level 1 D&D spells in Luminous/Limbus.

## Scope

Working target: **82 published Level 1 spells**.

- **64** Player's Handbook 2024 Level 1 spells.
- **16** additional published official 5e Level 1 spells from legacy supplemental / setting books that remain relevant to the project's broad spell scope.
- **2** current 2024-rules Level 1 spells from *Forgotten Realms: Heroes of Faerûn* (2025).
- Unearthed Arcana is **not** included.
- When a spell has a revised official 2024 version, use that version.
- Otherwise use the latest published official legacy version available to the project.

## Inventory

There are **82** Level 1 spells in scope.

### Canonical catalog definitions present — 16 / 82

The 9 pre-existing definitions remain review items until their metadata, mechanics, visuals/dependencies and smoke coverage meet the current spell contract. A checkbox is only completed after explicit user review/approval; implementation presence alone does not close the task.

- [ ] Absorb Elements
- [ ] Animal Friendship
- [ ] Charm Person
- [ ] Chromatic Orb
- [ ] Dissonant Whispers
- [ ] Expeditious Retreat
- [ ] Shield
- [ ] Silvery Barbs
- [ ] Thunderwave
- [ ] Alarm
- [ ] Armor of Agathys
- [ ] Arms of Hadar
- [ ] Bane
- [ ] Bless
- [ ] Burning Hands
- [x] Create or Destroy Water

#### Review decision for the 9 pre-existing definitions

Do **not** rewrite the shared Spell Slot / class-gating infrastructure. Reuse it and review the definitions/runtimes spell by spell.

- **Absorb Elements** — keep the Reaction/resource shell; review only the Luminous resistance/retaliation mapping and expiry details.
- **Animal Friendship** — metadata updated to the current Beast/WIS-save contract; remove the obsolete Intelligence cap. Runtime/charm cleanup can stay shared.
- **Charm Person** — metadata/target contract updated; still needs runtime support for the fighting-target Save advantage and end-of-spell awareness where relevant.
- **Chromatic Orb** — **mechanics review required**. The current `onCritJump` is a project approximation and should be re-evaluated against the revised leap mechanic before marking complete.
- **Dissonant Whispers** — **mechanics restructuring required**. It should enter the Save pipeline and model the failed-save forced Reaction movement rather than remain a plain focused attack.
- **Expeditious Retreat** — keep the Concentration + Quick Action shell; review whether the existing Haste mapping is still the intended Luminous movement abstraction.
- **Shield** — keep the Reaction shell and shared Shield runtime; review trigger/expiry semantics as a deliberate Luminous adaptation.
- **Silvery Barbs** — **mechanics restructuring required**. The current `combat_start` trigger is not a valid reaction trigger for the spell.
- **Thunderwave** — **mechanics restructuring required**. Move it to the CON Save / failed-save effect pipeline and model the push through Luminous positioning/control rather than as a plain AoE attack.

### Legacy role definitions awaiting canonical migration — 3 / 82

These already exist in `js/role-spell-catalog-core.js` and are covered by the Angelo smoke, so they must **not** be reimplemented as unrelated duplicates. They still count as pending work because the role catalog is not the authoritative shared spell definition.

- [ ] Comprehend Languages
- [ ] Speak with Animals
- [ ] Distort Value

### Truly absent definitions — 63 / 82

#### 2024 PHB baseline — 48

- [ ] Color Spray
- [ ] Command
- [ ] Compelled Duel
- [ ] Cure Wounds
- [ ] Detect Evil and Good
- [ ] Detect Magic
- [ ] Detect Poison and Disease
- [ ] Disguise Self
- [ ] Divine Favor
- [ ] Divine Smite
- [ ] Ensnaring Strike
- [ ] Entangle
- [ ] Faerie Fire
- [ ] False Life
- [ ] Feather Fall
- [ ] Find Familiar
- [ ] Fog Cloud
- [ ] Goodberry
- [ ] Grease
- [ ] Guiding Bolt
- [ ] Hail of Thorns
- [ ] Healing Word
- [ ] Hellish Rebuke
- [ ] Heroism
- [ ] Hex
- [ ] Hunter's Mark
- [ ] Ice Knife
- [ ] Identify
- [ ] Illusory Script
- [ ] Inflict Wounds
- [ ] Jump
- [ ] Longstrider
- [ ] Mage Armor
- [ ] Magic Missile
- [ ] Protection from Evil and Good
- [ ] Purify Food and Drink
- [ ] Ray of Sickness
- [ ] Sanctuary
- [ ] Searing Smite
- [ ] Shield of Faith
- [ ] Silent Image
- [ ] Sleep
- [ ] Tasha's Hideous Laughter
- [ ] Tenser's Floating Disk
- [ ] Thunderous Smite
- [ ] Unseen Servant
- [ ] Witch Bolt
- [ ] Wrathful Smite

#### Published legacy supplemental / setting — 13

- [ ] Beast Bond
- [ ] Catapult
- [ ] Cause Fear
- [ ] Ceremony
- [ ] Chaos Bolt
- [ ] Earth Tremor
- [ ] Frost Fingers
- [ ] Gift of Alacrity
- [ ] Jim's Magic Missile
- [ ] Magnify Gravity
- [ ] Snare
- [ ] Tasha's Caustic Brew
- [ ] Zephyr Strike

#### Forgotten Realms: Heroes of Faerûn (2025) — 2

- [ ] Spellfire Flare
- [ ] Wardaway

Current catalog state: **16 canonical Level 1 definitions**, **3 role-only definitions awaiting canonical migration**, and **63 truly absent definitions**. That leaves **66 missing/migration items** before the Level 1 catalog is complete, plus the separate review debt on the original 9 definitions.

## Canonical Spell Metadata Contract

Every canonical spell definition must carry enough data for both authorization and filtering:

- `id`, `name` / `nombre`
- `level` / `spellLevel`, `cantrip`
- `classIds` — authoritative class availability
- `school` — one of `abjuration`, `conjuration`, `divination`, `enchantment`, `evocation`, `illusion`, `necromancy`, `transmutation`
- `contexts` — at least one of `combat`, `theater`
- `castingTime`, `concentration`, and `ritual` when applicable
- canonical targeting / resolution fields and `mechanics`
- `upcast` where the spell changes with a higher-level slot

Player-facing catalogs may filter the player's legal/known spells by school, level and context. DM/catalog surfaces may additionally filter the full catalog by `classIds`. UI filters never replace the cast-time class gate.

## Spell Slot Contract

Spell Slot spending remains owned by the shared Spellcasting + CombatAction resource pipeline:

- cantrips / level 0: no Spell Slot resource;
- leveled spells: one canonical `spell_slot` resource at the selected slot level;
- class legality is validated from `classIds` before planning/casting;
- ritual/free-cast features must opt into their existing class runtime rather than bypassing the resource system ad hoc.

Individual spell runtimes must not decrement Spell Slots themselves.

## Adaptation Rules

- Keep player-facing spell descriptions compact.
- Reuse existing statuses and runtimes before adding spell-specific one-offs.
- Explicitly choose Clash, Save, failed-Save Unopposed, Reaction, Quick Action, automatic, or non-combat resolution.
- D&D movement/range language is converted to Luminous mechanics rather than exposed as feet in player-facing copy.
- Concentration effects clean up dependent statuses/entities.
- Summons use the shared Summon HP contract unless the spell defines a justified exception.
- Background Units do not automatically use Summon HP.
- Temporary Items use the shared inventory/expiry systems.
- Visual assets use the shared `LuminousSpellVisualAssetRegistry` / item icon registry and are tagged by domain.
- Every batch adds smoke coverage.

## Batch Plan

Keep integration batches at **5–6 spells** so each batch can be reviewed and reverted independently.

### Batch 1 — foundational Level 1 shapes (implemented, pending explicit user review)

- [ ] Alarm
- [ ] Armor of Agathys
- [ ] Arms of Hadar
- [ ] Bane
- [ ] Bless
- [ ] Burning Hands

This batch intentionally covers ritual/theater, self-defense, save/AoE, concentration debuff, concentration buff, and elemental AoE so the reusable Level 1 runtime shapes are established before the remaining spells.

### Batch 2 — SPR review in progress

SPR/design review is tracked separately from implementation completion so approved adaptations are not lost between sessions.

- [x] **Color Spray — SPR approved**: Save Spell, CON Save, Failed Save applies Blinded until the end of the caster's next turn. No damage.
- [x] **Command — SPR approved**: WIS Save. Commands: Approach = Aggro to caster; Drop = drop held items to Loot and end turn; Flee = Retreat 1 turn; Grovel = Prone and end turn; Halt = no movement, Action, or Quick Action that turn.
- [x] **Compelled Duel — SPR approved**: WIS Save, Concentration, Quick Action; failed Save locks Aggro to caster and ends on the agreed hostile/interference conditions.
- [x] **Comprehend Languages — SPR approved**: migrate the existing Theater definition into the canonical catalog without changing its current Theater behavior.
- [x] **Create or Destroy Water — SPR approved**: canonical definition added. Combat Rain uses the Rain Encounter Modifier; Destroy Fog suppresses Light Fog for 5 turns or Heavy Fog for 2 turns. Theater keeps Create/Destroy Water, Rain, and Destroy Fog utility modes.
- [ ] **Color Spray — implementation**
- [ ] **Command — implementation**
- [ ] **Compelled Duel — implementation**
- [ ] **Comprehend Languages — canonical migration**
- [x] **Create or Destroy Water — canonical definition + weather modifier contract**

#### Encounter Weather Modifier decisions locked during Batch 2

- **Rain** — all units take +10% damage from Electric effects, Hazards, and Skills.
- **Thunderstorm** — Rain electric modifier; 15% lightning-strike chance per unit; lightning deals 30 Fixed Damage + 5 Shock + 5 Shock Count; conductive metal adds 10 Fixed Damage + 3 Shock; Spears add +10% strike chance.
- **Light Fog** — units without True Sight suffer -1 Clash Power, Analyse, and Sight Perception Checks.
- **Heavy Fog** — units without True Sight suffer -3 Clash Power, Analyse, and Sight Perception Checks.


## Review Workflow

1. Normalize the shared spell metadata/filter contract.
2. Review the 9 existing canonical Level 1 spells against the same contract.
3. Migrate the 3 role-only Level 1 definitions into the canonical catalog without duplicate IDs.
4. Adapt the truly missing spells in 5–6 spell batches.
5. Mark a spell complete only when its definition, runtime behavior, status/entity/item dependencies, visuals when required, and tests are all in place.
6. Keep this checklist as the single progress source of truth.
