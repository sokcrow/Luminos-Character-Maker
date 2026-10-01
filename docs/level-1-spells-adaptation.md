# Level 1 Spells Adaptation

This branch is the dedicated integration line for Level 1 D&D spells in Luminous/Limbus.

## Scope

Working target: **82 published Level 1 spells**.

- **64** Player's Handbook 2024 Level 1 spells.
- **16** additional published official 5e Level 1 spells from legacy supplemental / setting books that remain relevant to the project's broad spell scope.
- **2** current 2024-rules Level 1 spells from *Forgotten Realms: Heroes of Faerûn* (2025).
- Unearthed Arcana is **not** included in this working target.
- When a spell has a revised official 2024 version, use that version.
- Otherwise use the latest published official legacy version available to the project.

## Current Repository Inventory

### Present in `js/spell-catalog-core.js` — 9 / 82

These are **present, not automatically approved**. Each still needs review against the current design rules and latest official version before being considered finished.

- [ ] Absorb Elements
- [ ] Animal Friendship
- [ ] Charm Person
- [ ] Chromatic Orb
- [ ] Dissonant Whispers
- [ ] Expeditious Retreat
- [ ] Shield
- [ ] Silvery Barbs
- [ ] Thunderwave

### Missing — 73 / 82

#### 2024 PHB baseline missing — 57

- [ ] Alarm
- [ ] Armor of Agathys
- [ ] Arms of Hadar
- [ ] Bane
- [ ] Bless
- [ ] Burning Hands
- [ ] Color Spray
- [ ] Command
- [ ] Compelled Duel
- [ ] Comprehend Languages
- [ ] Create or Destroy Water
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
- [ ] Speak with Animals
- [ ] Tasha's Hideous Laughter
- [ ] Tenser's Floating Disk
- [ ] Thunderous Smite
- [ ] Unseen Servant
- [ ] Witch Bolt
- [ ] Wrathful Smite

#### Published legacy supplemental / setting spells missing — 14

- [ ] Beast Bond
- [ ] Catapult
- [ ] Cause Fear
- [ ] Ceremony
- [ ] Chaos Bolt
- [ ] Distort Value
- [ ] Earth Tremor
- [ ] Frost Fingers
- [ ] Gift of Alacrity
- [ ] Jim's Magic Missile
- [ ] Magnify Gravity
- [ ] Snare
- [ ] Tasha's Caustic Brew
- [ ] Zephyr Strike

#### Forgotten Realms: Heroes of Faerûn (2025) — 2 missing

- [ ] Spellfire Flare
- [ ] Wardaway

## Published supplemental / setting spells already present

These count toward the 9 present above:

- [ ] Absorb Elements
- [ ] Silvery Barbs

## Adaptation Rules

- Keep player-facing spell descriptions compact.
- Reuse existing statuses and runtimes before adding spell-specific one-offs.
- Explicitly choose Clash, Save, Unopposed, Reaction, Quick Action, or non-combat resolution.
- D&D movement/range language should be converted to Luminous mechanics rather than exposed as feet in player-facing copy.
- Concentration effects must clean up dependent statuses/entities.
- Summons use the shared Summon HP contract unless the spell defines a justified exception.
- Background Units do not automatically use Summon HP.
- Temporary Items use the shared inventory/expiry systems.
- Visual assets must use the shared `LuminousSpellVisualAssetRegistry` / item icon registry and be tagged by domain.
- Add smoke coverage as each batch is implemented.

## Review Workflow

1. Review every spell already present in the catalog.
2. Adapt the missing spells in manageable batches.
3. Mark each spell complete only when its catalog definition, runtime behavior, status/entity/item dependencies, visuals when required, and tests are all in place.
4. Keep this checklist updated so the PR always shows exact Level 1 progress.
