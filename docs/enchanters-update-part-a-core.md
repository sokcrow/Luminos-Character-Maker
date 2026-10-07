# Enchanter's Update — Part A: Enchantment Core

Status: **design contract frozen for implementation**.

This document records the canonical Part A rules for PR #931. It is the source of truth for the first Enchantment Core implementation pass. Random magical loot generation remains deferred to the future **Magic Loot Update**.

## 1. Equipment eligibility and Enchantment Slots

Direct/pure Item Enchantments use a dedicated **Base Enchantment Slot** capacity with a hard maximum of 3. Part C clarifies that physical **Enchantment Gem Sockets are a separate capacity track** and do not use the same Rank-to-Base-Slot arithmetic.

Canonical Item Tier capacity:

| Item Tier | Enchantment Slots |
| --- | ---: |
| I | 0 |
| II | 1 |
| III | 1 |
| IV | 2 |
| V | 3 |

An Enchantment Rank normally consumes the matching number of slots:

- Rank I -> 1 slot
- Rank II -> 2 slots
- Rank III -> 3 slots

A Rank III Enchantment is therefore a full specialization on a Tier V Item rather than a minor complementary effect.

Multiple direct/pure Enchantments may coexist when total Base Slot cost fits capacity and their interaction rules allow it. Base capacity never exceeds 3. Gem-Anchored Enchantments are validated separately through Enchantment Gem Sockets under Part C.

## 2. Naming and player knowledge

The Item's true magical state and a character's knowledge of that state are separate.

An unidentified magical weapon is presented generically:

```text
Enchanted Longsword
```

A character with sufficient magical identification knowledge may instead see the authored Enchantment identity:

```text
Flamebound Longsword
```

Rank is shown in the Item description/property surface rather than as a `+N` suffix:

```text
Flamebound III
```

The generic offensive enhancement previously represented as `+1/+2/+3` should use explicit Enchantment naming/ranks instead of a `Longsword +N` item name.

Unknown magical inscriptions render as runic/obfuscated text. The existing Theatre language rune presentation may be reused visually, but **Arcane inscription comprehension is not a spoken language** and must use its own knowledge/identification contract.

Baseline identification thresholds:

| Enchantment Rank | Arcana TH |
| --- | ---: |
| I | 22 |
| II | 28 |
| III | 34 |

`Identify` reveals ordinary Enchantment identity without requiring the Arcana TH. If the Item is cursed, Identify may reveal that the Item is **Cursed**, but it does **not** reveal the hidden Curse drawback/effect description. The Curse detail remains on its dedicated Curse-reading path and stays obfuscated until understood.

## 3. Magic Item versus Magic Hit

Every successfully enchanted Item is a **Magic Item**.

Being a Magic Item does **not** automatically make every attack a **Magic Hit**.

Each Enchantment explicitly declares whether it grants Magic Hit for a compatible Skill/Spell/action.

Magic Hit is the property used to bypass defenses that reduce damage from **Non-Magic Hits**, including the existing rule case where compatible Ranged/Melee Skill damage received is reduced to 50%.

An Enchantment that does not author Magic Hit does not receive that bypass merely because the Item is magical.

## 4. Offensive scaling

Dedicated damage-focused Enchantments use the following baseline offensive scale:

| Rank | Damage-focused bonus |
| --- | ---: |
| I | +10% |
| II | +15% |
| III | +25% |

An Enchantment whose main purpose is not damage may author a smaller secondary damage contribution:

| Rank | Secondary damage baseline |
| --- | ---: |
| I | +4% |
| II | +8% |
| III | +18% |

The secondary damage bonus is **not universal**. Enchantments only gain it when explicitly authored.

Accessories are primarily defensive/buff-oriented Enchantment targets, e.g. Max HP increases, elemental/status damage reduction and similar support effects.

## 5. Effect model

Enchantments behave like equipment-bound Traits.

Effects are resolved from canonical Enchantment definitions and their Rank. Item Instances keep references/state; they do not clone arbitrary executable logic.

The engine should support authored effect payloads such as:

- Skill/Spell damage modification;
- Magic Hit grants;
- resistance/defensive modification;
- Max HP or other explicitly supported buffs;
- Status interaction;
- conditional triggers;
- charges/limited use where authored;
- passive effects;
- equipment/action-specific effect hooks.

The runtime must not use arbitrary `eval`/script payloads from content data.

## 6. Strengthening an Enchantment

An existing Enchantment may be strengthened to a higher Rank if the Item has enough Enchantment Slot capacity.

The target Rank uses the following baseline Threshold:

| Target Rank | TH |
| --- | ---: |
| I | 22 |
| II | 28 |
| III | 34 |

Baseline minimum magical labor:

| Work | Minimum magical labor |
| --- | ---: |
| Create Rank I | 750,000 AHN |
| Rank I -> II | 2,500,000 AHN |
| Rank II -> III | 7,500,000 AHN |

These values are labor floors. Magical reagents/catalysts are additional costs.

Reference labor formula:

```text
Magical Labor =
MAX(
  Rank Labor Floor,
  enchantmentBaseValueAhn x Rank Factor
)
```

Rank factors:

- Rank I -> x0.75
- Rank II -> x1.50
- Rank III -> x3.00

Service price remains separate from Item resale value:

```text
Enchantment Service Cost =
Magical Labor
+ Consumed Magical Materials
+ Local Enchanter Modifier
```

The economy must continue to use the existing AHN salary/value scale and must not silently apply normal Shop purchase markup a second time to a service.

### Outcome baseline

Player self-enchanting Checks resolve **control/deviation**, not a mundane binary success/failure.

- Margin >= 0 -> intended/controlled result.
- Margin -1 to -3 -> minor altered/abstract result from the authored outcome pool.
- Margin -4 to -7 -> major magical deviation; Gem Anchor or Magical Durability may be damaged/depleted and the result may gain an unintended property.
- Margin <= -8 -> Arcane Backlash; severe authored deviation may include Curse, accidental Bind, Anchor loss/depletion or other recipe-defined consequences.

Ritual-consumed materials remain consumed once the attempt begins according to Part B. Recoverable/unconsumed Items are handled by the service contract in Part C.

A Curse is not automatic on every negative margin. Only authored instability/backlash outcomes may create one.

NPC Enchanter services do not roll this Player-style Check; Part C uses provider reliability/specialization and controlled-outcome probability instead.

## 7. Enchantment interactions

The system supports both hard incompatibility and per-action channel conflicts.

### Hard conflict

Two Enchantments cannot coexist on the same Item.

### Channel conflict

Two Enchantments may coexist, but cannot both participate in the same action.

When a Skill/Spell/action can use multiple mutually exclusive properties, the wielder chooses which compatible Enchantment/property to channel before resolution.

Example:

```text
Flamebound I
Frostbound I

Skill selection:
- Flamebound
- Frostbound
```

If only one compatible choice exists, it may be selected automatically.

This rule allows elemental versatility without automatically stacking contradictory elements.

## 8. Material compatibility and magical wear

An Enchantment definition declares compatible material/resonance requirements.

An incompatible physical material does not automatically make application impossible. Instead, when that Enchantment causes magical wear:

```text
compatible material   -> Magical Durability wear x1
incompatible material -> Magical Durability wear x2
```

The penalty affects Magical Durability rather than inventing extra physical wear.

Material/reagent requirements for actually creating the Enchantment are handled by the Enchanter service and later content passes.

## 9. Physical and Magical Durability

Part C supersedes the earlier 50/50 split model.

Enchanting an Item does **not** reduce or divide its existing Physical Durability.

The Item keeps its normal Physical Durability and gains a separate **Magical Durability / magical-power integrity** resource.

- Physical Durability tracks the mundane/mechanical body of the Item.
- Magical Durability tracks the usable integrity/charge of its Enchantment.
- active and passive Enchantments may spend Magical Durability according to their authored behavior;
- Gem-Anchored Enchantments generally support more Magical Durability than equivalent direct/pure Item Enchantments;
- where magic is the protective/consumed layer, magical wear is resolved before ordinary physical wear.

At zero Magical Durability, the Enchantment is depleted/inactive rather than permanently erased. It may be repaired/recharged by the appropriate magical service. Player self-repair materials remain deferred to the **Magic Loot Update**.

Bound Enchantments do not discharge through the normal Magical Durability cycle, although the physical Item itself can still be damaged or destroyed.

## 10. Removal, replacement, Bind and Curse

Normal removable Enchantments may be removed/replaced through the Enchanter service.

### Bind

`bind` is an Enchantment property.

- Bind is not shown in the Item's display name.
- A Bound Enchantment remains upgradable.
- A Bound Enchantment cannot be removed/replaced/transferred through the normal Enchanter procedure.
- A Bound Enchantment does not discharge through the normal Magical Durability cycle.
- A Bound Gem Anchor is permanent to the Item under normal gameplay; attempting to remove that Bound Gem Anchor destroys the Item.
- Bind increases the positive authored Enchantment effect by **25% (x1.25)**.
- The x1.25 applies to the authored effect, not automatically to weapon damage.

Example:

```text
Flamebound II secondary damage = +8%
Bound Flamebound II = +10%
```

The Item may still display:

```text
Flamebound Longsword
```

while identified details reveal the Bind property.

### Curse

`curse` is also an Enchantment property/state.

- Curse is hidden from normal Item naming until detected.
- Ordinary Identify/Arcana knowledge of the Enchantment does not automatically imply Curse detection.
- Before Curse detection, a cursed Flamebound weapon still appears as `Flamebound Longsword` to someone who identified Flamebound.
- After Curse detection, the presentation may become `Cursed Flamebound Longsword`.
- Cursed Enchantments can be strengthened.
- Curse increases the positive authored Enchantment effect by **50% (x1.50)**.
- Curse penalties/prejudices may also scale with Rank.
- Cursed Items have lower market value than clean equivalents because sellers have an incentive to dispose of them.

Initial market baseline:

```text
Cursed market value = clean equivalent market value x0.60
```

This market discount does **not** reduce the actual magical labor/material cost required to create the effect.

Curse detection and Curse identification should remain separate states so the game may reveal that an Item is cursed before revealing the complete curse behavior.

## 11. Instance representation

Item Instances should persist stable Enchantment references and instance-specific state rather than cloning full resolved definitions.

Reference shape:

```js
magic: {
  enabled: true,
  enchantmentSlots: {
    max: 3,
    used: 2
  },
  enchantments: [
    {
      definitionId: "flamebound",
      rank: 1
    },
    {
      definitionId: "frostbound",
      rank: 1
    }
  ],
  magicalDurability: {
    max: 50,
    current: 47
  }
}
```

Effect values, interaction rules, Magic Hit grants, Bind/Curse modifiers and authored compatibility come from canonical definitions.

## 12. Part A implementation tasks

### Registry / schema

- [ ] Create `js/item-catalog-enchantments.js`.
- [ ] Create `js/item-enchantment-engine.js`.
- [ ] Define canonical Enchantment schema: stable ID, Rank data, slot cost, effects, compatibility, interaction channels, material compatibility, properties and economy metadata.
- [ ] Validate malformed definitions and unsupported effect payloads.
- [ ] Bridge positive Enchantment state into `LuminousItemMagicRuntime.isMagicItem()`.
- [ ] Remove the old assumption that generic `enhancementLevel +1/+2/+3` is the player-facing universal Enchantment identity.

### Capacity / validation

- [ ] Implement canonical Tier I-V Enchantment Slot capacity.
- [ ] Implement Rank I/II/III slot consumption.
- [ ] Enforce hard maximum of 3 Base Slots for direct/pure Item Enchantments; validate Gem-Anchored capacity separately through Part C Gem Sockets.
- [ ] Validate available capacity before application/strengthening.
- [ ] Implement hard conflicts.
- [ ] Implement exclusive per-action channel conflicts.
- [ ] Implement material compatibility lookup and x2 Magical Durability wear for incompatible materials.

### Item Instance / persistence

- [ ] Add canonical `magic.enchantments[]` Item Instance state.
- [ ] Add used/max Enchantment Slot state.
- [ ] Preserve normal Physical Durability and add separate Magical Durability / magical-power integrity state.
- [ ] Preserve enchantment state through inventory, stash, transfer, equip/unequip and save/load.
- [ ] Prevent stack merging when magical state differs.
- [ ] Keep player knowledge/identification state separate from Item truth.

### Identification / display

- [ ] Add generic unidentified naming: `Enchanted {Base Item Name}`.
- [ ] Add identified naming: `{Enchantment Name} {Base Item Name}` without `+N` suffixes.
- [ ] Show Rank in Item details/properties.
- [ ] Implement Arcana TH 22/28/34 identification.
- [ ] Connect `Identify` to ordinary Enchantment reveal.
- [ ] Reuse rune obfuscation presentation for unread magical inscriptions without registering Arcane script as a normal language.
- [ ] Add separate Curse detected / Curse identified knowledge states.
- [ ] Keep Bind out of the Item display name.

### Effects / combat

- [ ] Implement authored Magic Hit grants independently from Magic Item status.
- [ ] Integrate Magic Hit with Non-Magic Hit damage-reduction bypass.
- [ ] Implement damage-focused 10%/15%/25% Rank baseline.
- [ ] Support optional secondary 4%/8%/18% damage scaling only when authored.
- [ ] Implement equipment-Trait style effect resolution.
- [ ] Add accessory defensive/buff effect support.
- [ ] Add action-time Enchantment channel choice when mutually exclusive compatible properties are available.
- [ ] Ensure inactive/broken magical state cannot contribute effects.

### Strengthening / economy

- [ ] Implement TH 22/28/34 application/strengthening checks.
- [ ] Implement magical labor floors: 750k / 2.5m / 7.5m AHN.
- [ ] Implement Rank factors x0.75 / x1.50 / x3.00 against `enchantmentBaseValueAhn`.
- [ ] Add reagent/material costs on top of labor.
- [ ] Keep Enchanter service price separate from resale value and normal Shop purchase markup.
- [ ] Implement failure margins and Magical Durability damage.
- [ ] Allow authored Arcane Backlash consequences without universal automatic curses.

### Bind / Curse

- [ ] Implement Bind property and x1.25 positive-effect multiplier.
- [ ] Block normal removal/replacement/transfer procedure for Bound Enchantments.
- [ ] Allow Bound Enchantments to strengthen.
- [ ] Implement Curse hidden naming/knowledge behavior.
- [ ] Implement x1.50 positive-effect multiplier for Cursed Enchantments.
- [ ] Support scaling authored Curse penalties.
- [ ] Implement initial x0.60 cursed market-value baseline independently from creation/service cost.
- [ ] Allow Cursed Enchantments to strengthen.

### Maintenance

- [ ] Route physical repair to physical specialists.
- [ ] Route Magical Durability repair to Enchanter service.
- [ ] Prevent a normal physical repair service from silently restoring Magical Durability.
- [ ] Prevent Enchanter magical repair from silently restoring physical damage.
- [ ] Reserve player magical self-repair materials/tools for Magic Loot Update.

### Tests / CI

- [ ] Add Enchantment schema smoke tests.
- [ ] Add Tier/slot/rank-capacity tests.
- [ ] Add hard-conflict and channel-choice tests.
- [ ] Add material compatibility / doubled magical wear tests.
- [ ] Add Magic Item versus Magic Hit tests.
- [ ] Add damage scaling tests.
- [ ] Add physical/magical Durability split and repair-authority tests.
- [ ] Add strengthening TH/economy/failure tests.
- [ ] Add Bind tests.
- [ ] Add Curse knowledge/power/value tests.
- [ ] Add Arcana/Identify/rune-obfuscation tests.
- [ ] Add inventory persistence/transfer/stacking tests.
- [ ] Add Enchanter's Update CI workflow/path coverage.

## 13. Deferred from Part A

Part A does not author the complete Enchantment catalog, magical reagent catalog or random loot tables.

The following remain later passes:

- full Enchantment content catalog expansion;
- Enchanter NPC/service UI polish beyond the core contract;
- magical reagent/repair-item content under Magic Loot Update;
- random magical drops/affix rolls;
- random cursed loot;
- artifacts/random legendary generation.
