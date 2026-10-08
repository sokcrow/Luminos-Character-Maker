# Enchanter's Update — Part D: Magic Item Runtime Integration

Status: **design contract frozen for implementation**.

This document closes the runtime-facing Enchantment rules needed before a separate **Magic Items Update** expands the actual catalog of native Magic Items, adapted D&D items, Relics, Wondrous Items, scrolls, talismans and enchanted ammunition.

Part D is a framework/integration pass. It does **not** import the full D&D Magic Item catalog into PR #931.

## 1. Enchanted Item = Magic Item

Every successfully enchanted Item is a **Magic Item**.

This does not automatically grant **Magic Hit**.

```text
Enchanted Item -> Magic Item
Magic Item != Magic Hit
```

Magic Hit remains an explicitly authored property/effect from the Enchantment definition.

## 2. Attunement capacity

Base Attunement capacity remains:

```text
3 Items
```

A Trait or other canonical effect may explicitly increase or otherwise modify that capacity.

One Item occupies **one Attunement Slot**, regardless of whether it contains one, two or three Enchantments/Gem Anchors.

Individual Gem Anchors never consume separate Attunement Slots from their parent Item.

## 3. Enchantment Rank and Attunement

For normal **Enchanted Items**:

- Rank I does not require Attunement by default;
- any Item carrying a Rank II or Rank III Enchantment requires Attunement;
- multiple Rank II/III Enchantments on the same Item still consume only one Attunement Slot.

Native Magic Items may author their own attunement requirement, but the future Magic Items catalog should use this same runtime rather than inventing a parallel attunement engine.

Rank IV/V Relics may define exceptional attunement behavior.

## 4. Unattuned Items

Breaking normal Attunement does not erase or remove Enchantments from the Item.

The Item keeps its complete magical state, but the wielder receives **none of the Enchantment benefits that require the Item's Attunement** while unattuned.

Physical/mundane use remains available when the Item has a valid mundane form.

A Rank II/III enchanted weapon that is no longer attuned therefore remains the same enchanted Item, but its magical benefits are dormant for that wielder until attuned again.

## 5. Activation timing is definition-driven

An Enchantment or native Magic Item may author when its effect activates.

Supported canonical activation families should include at minimum:

- passive;
- on hit;
- on Skill;
- on Spell;
- on damage received;
- action;
- bonus/action-equivalent hook;
- reaction;
- manual activation;
- channel selection;
- Item Spell activation;
- other explicitly whitelisted gameplay hooks.

The content definition chooses the trigger. UI does not invent activation behavior.

## 6. Installed Enchantment identity is not dynamically retuned

Once an Enchantment has been installed into a direct Enchantment slot or Gem Anchor, that installed identity is fixed during normal gameplay.

A wielder may choose between already-installed mutually exclusive channels, such as Fire **or** Cold for one action, but cannot dynamically turn a Flamebound slot into another Enchantment.

Changing the installed Enchantment requires the appropriate Enchanter remove/rewrite procedure from Part C, when that Enchantment is removable.

Bound installations remain non-removable under their Bound rules.

## 7. Magical Durability is the backing resource for Charges

Part D does **not** treat Charges as a completely independent magical battery.

Magical Durability / magical-power integrity is the underlying resource.

An Item may expose player-facing **Charges** as a convenient activation budget, but those Charges are backed by the Item's magical resource.

Example concept:

```text
Item Spell: 10 Charges
Cast cost: 1 Charge
Charge spend -> authored Magical Durability spend
```

Different Items may map Charges to Magical Durability differently.

Some Magic Items lose Magical Durability only when a special activated property is used rather than through ordinary passive operation.

The current `item-magic-runtime.js` charge API must therefore be adapted so Charges can project from / spend the canonical Magical Durability resource instead of silently creating a second unrelated battery.

## 8. Recharge is definition-driven

The Enchantment/Magic Item definition decides how its magical resource recharges.

Valid authored recharge families may include:

- time;
- rest;
- dawn/day cycle;
- Enchanter recharge;
- ritual;
- material consumption;
- environmental condition;
- specific action;
- life/SP/other user cost when explicitly authored;
- Relic-specific procedure.

There is no universal recharge rule for all Magic Items.

## 9. Item-bound Spells

A Magic Item may contain a Spell as an Item-bound magical property.

When the Item provides its own Spell Charges/resource:

- casting the bound Spell does **not** spend the user's normal Spell Slots;
- the Item spends its own charge/Magical Durability cost;
- the Item may author its own Spell Attack / Spell DC or use an explicitly defined wielder-derived value.

If the Item merely enables/channels a Spell but does not provide an independent Item Spell resource, the cast uses the wielder's normal Spell Slot/resource rules.

This preserves both families:

```text
"10 charges of Spell X"
-> Item pays

"While wielding this Item, you may cast Spell X with your own casting"
-> wielder pays
```

## 10. SP costs are authored, not automatic

Magic Item activation does not automatically spend SP.

SP is spent only when the Enchantment, Curse, Item Spell or Item property explicitly says so.

## 11. Depleted enchanted physical Items

When Magical Durability reaches 0 on an enchanted Item with a mundane physical form:

- the magic becomes depleted/inactive according to its rules;
- the Item is **not** automatically destroyed;
- the physical Item remains usable as its mundane/normal version while its Physical Durability permits.

A depleted Flamebound Longsword can therefore still function as a normal Longsword.

Physical Durability 0 follows the repository's existing damaged/broken Item rules; it does not mean the Item automatically explodes or vanishes.

## 12. Bind is a Curse-family state

Part D supersedes the earlier framing of Bind as a purely separate beneficial property.

**Bind is a special Curse-family magical state** that may occur accidentally or may be deliberately created through the difficult/profane Enchanter procedures already defined.

Bound magic retains its prior advantages but carries attachment costs.

Canonical Bound behavior:

- the Item cannot be normally unequipped/released while the Bind is active;
- when the Item requires Attunement, the Bound Item locks that Attunement Slot;
- normal voluntary unattunement is blocked;
- the Bound Enchantment cannot be normally removed;
- removing a Bound Gem Anchor destroys the Item under Part C;
- the Bound positive-effect multiplier remains x1.25 unless a specific definition overrides it;
- Bound magic does not suffer ordinary/background Magical Durability wear;
- special activated powers may still spend their authored magical resource;
- Bound magic recharges faster according to its definition;
- if its special-use magical resource reaches 0, a Bound Item may fully recharge by draining the user's Life/HP according to the authored Bind/Curse profile.

The exact HP/Life cost is definition-driven balance data and must not be invented by UI.

## 13. Curse persistence and self-preservation

Cursed magical effects are persistent by nature.

By default, a Curse is not disabled merely because an ordinary positive Enchantment would have depleted its Magical Durability.

Curses may author self-preservation behaviors such as:

- ignoring normal magical wear;
- restoring Magical Durability;
- restoring other Item integrity where explicitly authored;
- forcing or preserving equip/attunement state;
- draining HP, SP, Sanity or other resources;
- using the wielder as a recharge source.

Not every Curse must use every behavior.

**Bound** is the canonical Curse-family behavior that blocks normal unequip/unattune and locks the occupied Attunement Slot.

## 14. Practical activation knowledge versus arcane understanding

A user does not need complete scholarly understanding of a Magic Item to operate a known activatable function.

If the character has learned the practical activation method — for example a command, gesture or known use — they may activate that property even if deeper runic analysis remains unread.

Passive effects require no conscious understanding to operate.

Arcana/Identify/Compendium knowledge still controls how much of the Item's internal magical information the character can read or explain.

## 15. Native Magic Items versus Enchanted Items

The runtime recognizes two major origins:

### Enchanted Item

A mundane/physical Item that later received one or more Enchantments.

### Native Magic Item

An Item whose canonical definition is magical from creation and does not need to be modeled as "mundane chassis + player-applied Enchantment".

Both use the same shared Magic Item runtime for:

- Magic Item detection;
- Attunement;
- Item Spells;
- Magical Durability/Charges;
- activation;
- Curse/Bind behavior;
- identification;
- persistence.

Native Magic Items are not forced to consume normal Enchantment Slots or Gem Sockets unless their definition specifically uses those systems.

## 16. Wondrous / utility Magic Items are first-class

The future Magic Items Update must support useful magical objects that are not weapons/armor/accessories and do not fit ordinary equipment Enchantment Slots.

Examples include future adapted families such as:

- bags/containers;
- stones;
- decks;
- figurines;
- instruments;
- utility tools;
- other Wondrous Item-style objects.

These are a required runtime capability, not an optional edge case.

## 17. Consumable Magic Item scope

Potions are not a priority for the future D&D adaptation because the setting already has stronger modern alternatives.

The future Magic Items Update should still support:

- Spell Scrolls;
- talismans;
- enchanted ammunition;
- other setting-appropriate consumable magical objects.

Part D only preserves/extends the common runtime hooks needed for them.

## 18. Adapting classic +1/+2/+3 items

Future D&D-style `Weapon +1/+2/+3` and similar generic enhancement items must be adapted into this project's named Enchantment/Rank system.

Do not restore universal player-facing `+N` naming.

The mechanical intent may be preserved while the content is expressed through canonical Enchantment identities, Ranks and this project's combat rules.

## 19. Relics Rank IV/V

Rank IV/V Magic Items are outside normal reproducible Enchantment expectations.

They represent **Relics / Legendary Items** and may break the normal power curve deliberately.

They still use the same shared Magic Item runtime rather than a separate Relic engine.

A Relic may define:

- Rank IV/V effects;
- unique activation rules;
- exceptional Attunement behavior;
- inseparable drawbacks;
- exceptional recharge/repair procedures;
- nonstandard effect combinations;
- unique identity/instance restrictions.

Normal Players/Enchanters cannot reproduce their full Rank IV/V magic.

## 20. Relic maintenance

Relics do not use ordinary Enchanter repair as their universal solution.

A Relic may contain a hidden authored maintenance procedure such as:

- ritual;
- sacrifice;
- specific time/date/phase;
- specific location;
- specific action;
- rare material;
- other singular requirement.

Passing the required Arcana/knowledge gate reveals that procedure in the Item description.

Until understood, the procedure remains hidden/obfuscated.

## 21. Identify and Relics

`Identify` can interact with Relic mystery, but it does not guarantee a complete Relic reveal.

Canonical exceptional rule:

```text
Identify Relic breakthrough chance = 5%
```

A successful breakthrough may unlock a deeper Relic information layer that would otherwise require exceptional Arcana/Compendium/research.

The exact layer revealed is authored by the Relic; the runtime must not assume every 5% breakthrough reveals the entire Item.

## 22. Relic drawbacks are not always removable Curses

The most powerful Relics may contain severe negative properties that resemble Curses but are an inseparable part of the Relic's identity.

Therefore the runtime must distinguish:

- removable/normal Curse;
- Bound Curse;
- inseparable Relic drawback.

A generic Remove Curse service must not automatically strip an inseparable Relic drawback.

## 23. Unique / Artifact / Relic instances

Unique/Artifact/Relic definitions may require world uniqueness.

The runtime must support:

- unique instance identity;
- no normal duplication/generation;
- provenance/history;
- DM placement/ownership control.

Ordinary repeatable Magic Items do not require this uniqueness flag.

## 24. Destruction and zero Durability

A Magic Item reaching 0 Physical Durability is **damaged/broken according to existing Item rules**, not automatically annihilated.

Special destruction conditions may still exist when the Item definition explicitly authors them, but Part D does not replace the repository's normal destruction/damage rules with "0 = explode".

Relics/Artifacts may therefore be damaged at 0 Durability and require their authored restoration procedure unless an existing rule or explicit definition says they are destroyed.

## 25. DM authoring is required

DM tools must be able to create Magic Items from scratch and modify existing Items.

Validated authoring should support combinations of:

- Enchantments;
- native magic properties;
- Spells;
- Charges/Magical Durability mapping;
- activation triggers;
- Attunement;
- Curse;
- Bind;
- recharge;
- Relic flags;
- rarity;
- unique-instance rules;
- maintenance procedure;
- other whitelisted canonical effect payloads.

DM authoring must remain general-purpose and must not require raw arbitrary script execution.

## 26. Handoff to Magic Items Update

PR #931 should finish the **Enchantment-side framework and integration seam**, then the actual mass content adaptation moves to a separate **Magic Items Update**.

That future update may adapt D&D-derived Magic Item families into this project's rules in batches.

Part D requires representative runtime fixtures/tests, not hundreds of content definitions.

Recommended representative validation coverage:

- a Rank I enchanted physical Item without Attunement;
- a Rank II enchanted Item requiring Attunement;
- a multi-Enchantment Item still consuming one Attunement Slot;
- a Magic Item with Item-bound Spell Charges backed by Magical Durability;
- a Bound/Cursed Item that locks Attunement and uses life-backed emergency recharge;
- a Native Wondrous Magic Item without Enchantment Slots;
- a Relic Rank IV/V with hidden maintenance information and 5% Identify breakthrough.

## 27. Part D implementation tasks

### Shared Magic Item runtime

- [x] Extend `LuminousItemMagicRuntime.isMagicItem()` so every applied Enchantment is recognized as a Magic Item.
- [x] Keep Magic Item status independent from Magic Hit.
- [x] Keep base Attunement capacity at 3 and allow canonical Traits/effects to modify it.
- [x] Make each Item consume one Attunement Slot regardless of Enchantment/Gem count.
- [x] Make normal Enchanted Items require Attunement when any installed Enchantment is Rank II+.
- [x] Keep Rank I Enchanted Items unattuned by default unless another property requires Attunement.
- [x] Suppress attunement-gated Enchantment benefits while unattuned without deleting Item magic.
- [x] Add Native Magic Item origin support without forcing Enchantment Slot/Gem Socket semantics.

### Activation / effects

- [x] Add whitelisted activation trigger families and trigger-filtered runtime resolution for passive, hit, Skill, Spell, reaction, action, manual and channel-driven effects.
- [x] Keep installed Enchantment identity fixed during normal gameplay; activation selects effects/channels rather than rewriting the Enchantment.
- [x] Preserve per-action choice between already-installed exclusive channels.
- [ ] Permit practical activation knowledge without requiring full Arcana identification.
- [x] Keep passive effects automatically resolvable when otherwise active/eligible.

### Magical Durability / Charges

- [x] Refactor Item Charges so authored properties can be backed by canonical Magical Durability instead of a separate unrelated battery.
- [x] Add per-property Charge -> Magical Durability cost mapping.
- [x] Support Items that spend Magical Durability only on special activated powers.
- [x] Add definition-driven Magical Durability recharge hooks.
- [x] Keep depleted enchanted physical Items usable mundanely when Physical Durability permits.
- [x] Ensure 0 Physical Durability uses existing damaged/broken Item rules rather than automatic destruction.

### Item Spells

- [x] Preserve Item-bound Spell casting through the existing Spell runtime/executor.
- [x] Support Item-paid Spell casts that spend Item Charges/Magical Durability and no user Spell Slot.
- [x] Support conduit/enabler Items that mark the cast as using the wielder's normal Spell Slot/resource.
- [x] Support authored Item Spell Attack / Spell DC or explicitly wielder-derived values through the existing resolver.
- [x] Spend SP only when the Item/Curse/property explicitly requires it.

### Bind / Curse

- [x] Migrate Bind to a Curse-family state while preserving intentional/accidental creation support.
- [ ] Block normal unequip and unattune for Bound Items.
  - [x] Normal Bound unattunement is blocked in `LuminousItemMagicRuntime`; equipment unequip lock remains pending.
- [x] Lock the occupied Attunement Slot for an attuned Bound Item by blocking normal unattune/removal from the Attunement store.
- [x] Preserve x1.25 Bound positive-effect multiplier.
- [x] Ignore ordinary/background Magical Durability wear for Bound magic.
- [x] Allow authored special-use resource spend on Bound Items.
- [x] Add definition-driven Bound recharge multipliers.
- [x] Add life/HP-backed full recharge at zero for Bound Items according to authored profile.
- [x] Allow authored persistent Curses to ignore normal magical depletion and support self-preservation/recharge behavior.
- [ ] Distinguish normal Curse, Bound Curse and inseparable Relic drawback.

### Relics

- [ ] Support Rank IV/V through the same Magic Item runtime without normal reproduction.
- [ ] Add Relic-specific maintenance/recharge procedures.
- [ ] Reveal Relic maintenance requirements through Arcana/knowledge gates.
- [ ] Add 5% Identify Relic breakthrough resolution.
- [ ] Make Relic breakthrough reveal authored information layers rather than automatically exposing everything.
- [ ] Prevent generic Remove Curse from removing inseparable Relic drawbacks.
- [ ] Add unique-instance/provenance support for authored Relics/Artifacts.

### Future Magic Items compatibility

- [x] Support Native Wondrous/utility Magic Items without Enchantment Slots.
- [x] Preserve/support the existing Spell Scroll runtime.
- [ ] Add generic hooks for talismans and enchanted ammunition.
- [ ] Keep Potions out of the priority adaptation scope.
- [ ] Provide an adapter path for classic +1/+2/+3 items into named Enchantment/Rank definitions.
- [ ] Add validated DM creation/editing for Magic Items using canonical effect modules.

### Tests / handoff

- [x] Add Rank I no-attunement and Rank II+ attunement regression tests.
- [x] Add one-Item/one-Attunement-Slot multi-Enchantment test.
- [x] Add unattuned-benefit suppression test.
- [x] Add Magical-Durability-backed Charge tests.
- [x] Add Item-paid vs wielder-paid Spell cast tests.
- [ ] Add Bound equip/unattune lock and life-recharge tests.
  - [x] Bound unattune lock and life-backed recharge are covered; equipment unequip lock remains pending.
- [x] Add persistent Curse/self-preservation tests.
- [x] Add Native Magic Item/Wondrous Item fixture.
- [ ] Add Relic Rank IV/V and 5% Identify breakthrough tests.
- [x] Add 0-Durability damaged-not-annihilated regression coverage.
- [ ] Add Magic Items Update handoff document after Enchantment runtime integration is validated.
