# Enchanter's Update — Implementation Checklist

This PR is the living implementation tracker for the **Enchanter's Update**.

The Enchanter's Update is responsible for **authoring, validating, applying, removing, persisting and resolving enchantments on existing Item Instances**.

Random magical drops, random affix rolls, cursed random loot and artifact generation remain outside this update and belong to a later **Magic Loot Update**.


## Part A — Enchantment Core (design frozen)

Canonical contract: [`docs/enchanters-update-part-a-core.md`](./enchanters-update-part-a-core.md)

Design decisions are marked complete here; implementation remains open.

### Frozen design decisions

- [x] Item Tier capacity is fixed at Tier I = 0, Tier II = 1, Tier III = 1, Tier IV = 2, Tier V = 3 Enchantment Slots.
- [x] Hard maximum is 3 Base Enchantment Slots for direct/pure Item Enchantments; physical Gem-Anchored Enchantments use a separate max-3 Enchantment Gem Socket track.
- [x] Rank I/II/III normally consumes 1/2/3 slots respectively.
- [x] Multiple compatible Enchantments may coexist while total slot use fits capacity.
- [x] Unknown magic equipment uses generic naming such as `Enchanted Longsword`.
- [x] Identified named Enchantments use naming such as `Flamebound Longsword`; Rank is shown in details, not as a `+N` suffix.
- [x] Arcana identification baseline is TH 22 / 28 / 34 for Rank I / II / III.
- [x] `Identify` reveals ordinary Enchantment identity; Curse detection remains separate.
- [x] Unread magical inscriptions use rune-style obfuscation without treating Arcane script as a spoken language.
- [x] Every enchanted Item is a Magic Item, but Magic Hit is an independently authored Enchantment property.
- [x] Magic Hit is the bypass used against defenses that reduce compatible Non-Magic Hit Ranged/Melee damage to 50%.
- [x] Damage-focused Rank baseline is +10% / +15% / +25%.
- [x] Optional secondary damage baseline is +4% / +8% / +18% and is never automatic.
- [x] Enchantment effects resolve like equipment-bound Traits from canonical definitions.
- [x] Strengthening uses TH 22 / 28 / 34 with sharply increasing labor/material cost.
- [x] Baseline magical labor floors are 750k / 2.5m / 7.5m AHN and Rank factors x0.75 / x1.50 / x3.00 against `enchantmentBaseValueAhn`.
- [x] Failed strengthening preserves the previous Enchantment; worse margins consume materials and damage Magical Durability according to the Part A contract.
- [x] Interaction model supports hard conflicts plus mutually exclusive per-action channels where the wielder chooses which compatible property to use.
- [x] Incompatible materials double Magical Durability wear rather than automatically making the Enchantment impossible.
- [x] Enchanting preserves full Physical Durability and adds separate Magical Durability / magical-power integrity.
- [x] Physical damage and magical damage require their appropriate specialists; one repair path cannot silently restore the other half.
- [x] `bind` is a Curse-family state: x1.25 positive effect, upgradable, not normally removable/replaced/transferred, and subject to Part D equip/Attunement lock + recharge rules.
- [x] `curse` is hidden until detected, x1.50 positive effect, can strengthen, may scale penalties, and has lower market value than the clean equivalent.
- [x] Initial cursed market baseline is x0.60 of the clean equivalent; creation/service cost is not discounted by that market penalty.
- [x] Item Instances persist stable Enchantment IDs/Ranks/state while canonical definitions remain effect authority.

### Part A implementation gate

- [x] Add canonical Enchantment catalog/schema.
- [x] Add Enchantment engine/runtime.
- [x] Add Tier/Rank slot validation and conflict/channel resolution.
- [x] Persist/hydrate canonical Enchantment state, slot state and existing separate Magical Durability through Item Instances.
- [x] Add Arcana/Identify/Curse knowledge resolution and rune-obfuscated display.
- [x] Add Magic Item vs Magic Hit combat bridge.
- [x] Add equipment-Trait effect resolution and authored damage/buff support.
- [ ] Add strengthening TH, AHN/material economy and failure resolution.
- [x] Add Bind and Curse runtime behavior.
- [ ] Add physical/magical repair authority.
- [ ] Add regression/smoke tests and CI path coverage.
  - [x] Initial Enchantment core schema/engine smoke is wired into Inventory Runtime Validation CI.
  - [x] Enchantment inventory persistence + Magic Item Attunement bridge smokes are wired into CI.

## Part B — Resonance, Gem Anchors and Enchantment Recipes (design frozen)

Canonical contract: [`docs/enchanters-update-part-b-resonance.md`](./enchanters-update-part-b-resonance.md)

### Frozen design decisions

- [x] Keep Physical Item Material, Gem Anchor, Consumed Ritual Material and Enchantment Effect as separate concepts.
- [x] Preserve the existing 12 gemstone `resonanceTags` as canonical core resonance.
- [x] Let gemstones expose multiple coherent Enchantment Affinities instead of one hard-coded Enchantment each.
- [x] One mounted Gem Anchor channels one installed Enchantment at a time even if the gem has many compatible affinities.
- [x] Mounted Gem Anchors remain physically in the Item on successful application; non-gem ritual materials are consumed by the ritual.
- [x] Once an application attempt begins, consumed ritual materials are lost on success or failure.
- [x] A failed/unstable attempt may break, deplete, destabilize or corrupt its Gem Anchor.
- [x] Gem Quality governs stable Enchantment Rank capacity: Poor Rank I unstable, Standard Rank I, Fine up to Rank II, Exceptional up to Rank III.
- [x] Overchanneling above a gem's stable Rank is allowed as an unstable attempt and increases failure risk.
- [x] Enchantment compatibility supports primary/ideal, accepted and incompatible resonance/affinity routes.
- [x] Non-elemental branches such as HP, regeneration, SP, Intelligence, Speed and resistance may be gem-compatible when authored.
- [x] Opal/Prismatic and Starstone/Exotic are specialized routes, not universal substitutes.
- [x] Same-family Gem Anchors create Resonance Specialization; mixed families create Hybrid Resonance.
- [x] Hybrid builds gain more branches but do not receive the full accumulated same-branch specialization benefit.
- [x] Compatible Gem Anchor baseline stabilization is -2 TH.
- [x] Gem Quality/specialization may improve the Item/Gem stabilization contribution until Rank I base TH 22 can reach TH 18.
- [x] TH 18 is only the Item/Gem stabilization floor for that Rank-I example; proper tables, workshops, tools and facilities may reduce TH further.
- [x] Base Enchantment Slots and Enchantment Gem Sockets are separate capacity tracks.
- [x] Enchantment Gem Sockets have a hard maximum of 3 where the Item chassis supports them.
- [x] One Gem Anchor occupies one Gem Socket and channels one Enchantment.
- [x] Up to three Rank II Gem-Anchored Enchantments may coexist where all three sockets are valid.
- [x] Only one Rank III Gem-Anchored Enchantment may exist on an Item.
- [x] A fourth Enchantment Gem is catastrophic if forcibly attempted: the Item and prior Gem Anchors are destroyed and only the last inserted gem remains.
- [x] Multiple conflicting elemental/branch Enchantments may coexist, but exclusive action channels require the wielder to choose which property participates in an action.
- [x] Bind can occur accidentally or be intentionally attempted; intentional Bind initially adds +4 TH and retains the Part A x1.25 positive-effect modifier.
- [x] Curse can occur through instability/backlash or be intentionally authored with profane/corrupted materials; intentional Curse initially adds +6 TH.
- [x] Cursed drawbacks are authored per Enchantment and may include HP/SP/Sanity drain, stat penalties or other explicit disadvantages.
- [x] Gem-affinity authoring is separate from effect authoring: a Ruby can enable Fire/HP/Regeneration-compatible paths but never grants all of them simultaneously.
- [x] Approved example affinity directions include Ruby -> Fire/Heat plus HP/Vigor/Regeneration/Fire Resistance; Sapphire -> Cold/Ice plus SP/INT/Focus/Cold Resistance; Topaz -> Lightning/Energy plus Speed/Initiative/Movement.

### Part B implementation gate

- [x] Add canonical `gemMagicProfile` data for all 12 gemstone identities.
- [x] Author and validate the full 12-gem Enchantment Affinity matrix.
- [x] Add Gem Quality -> stable Rank capacity and Overchannel resolution.
- [x] Add one-Gem-Anchor -> one-Enchantment linkage and persistence.
- [x] Add Gem Anchor broken/depleted/unstable states and Dormant dependent Enchantments.
- [x] Add primary/accepted/incompatible resonance and affinity recipe validation.
- [x] Add semantic consumed-material requirements and exact-Item recipe escape hatch.
- [x] Add Resonance Specialization versus Hybrid Resonance resolution.
- [x] Add compatible-gem/quality/specialization TH stabilization with Item/Gem cap.
- [x] Add external Enchantment Table / Arcane Workshop / tool modifier seam.
- [x] Add separate max-3 Enchantment Gem Socket validation, Rank II multi-anchor support, exclusive Rank III handling and fourth-gem catastrophe handling.
- [x] Add Bind recipe modifier / accidental Bind outcome flow.
- [x] Add intentional/accidental Curse recipe flow with profane reagent tags.
- [x] Add Gem Anchor, recipe, specialization/hybrid, Gem Socket, Bind/Curse and channel-choice regression tests.
  - [x] Gem profile/Quality-Rank smoke is wired into Inventory Runtime Validation CI.
  - [x] Gem Anchor/Gem Socket persistence, Dormant-state, Rank pressure, catastrophe and channel-choice smoke is wired into CI.
  - [x] Gem compatibility/Specialization/Hybrid/TH-cap smoke is wired into CI.
  - [x] Ritual material consumption + Overchannel + Bind/Curse outcome smoke is wired into CI.
  - [x] Magical Durability/activation/CombatEngine bridge smoke is wired into CI.
  - [x] Arcana/Identify/Curse knowledge + player rune presentation smoke is wired into CI.
  - [x] Bound equipment/unattune lock smoke is wired into CI.
  - [x] Enchanter provider/quote/delivery + gem procedure smokes are wired into CI.

## Part C — Enchanter Services, Knowledge and Magical Maintenance (design frozen)

Canonical contract: [`docs/enchanters-update-part-c-services.md`](./enchanters-update-part-c-services.md)

### Frozen design decisions

- [x] Canonical services include Enchant, Strengthen, Remove/Rewrite, Identify, Curse analysis, Magical Repair/Recharge, Bind, Curse, Mount Gem and Extract Gem.
- [x] Normal Player/Enchanter reproduction is capped at Rank III.
- [x] Rank IV/V are Relic Enchantments from deep Dungeons/Ruins/high-end content and cannot be reproduced at full Rank.
- [x] Relics may be studied to derive lower Rank I-III known recipes.
- [x] Enchantments use a discoverable Compendium/recipe-knowledge layer with source/provenance.
- [x] Recipe books/manuals/tablets obey language comprehension; unread sources render as runes/obfuscation rather than leaking recipes.
- [x] NPC Enchanters do not make normal Player-style crafting Checks.
- [x] NPC service quality uses provider specialization/knowledge/reliability and a controlled-result probability.
- [x] Knowing/providing an unfamiliar recipe does not grant an NPC automatic mastery.
- [x] Enchanting outcomes are not binary mundane pass/fail; altered results, unexpected properties, Bind, Curse and Anchor damage/depletion are valid authored outcomes.
- [x] Player self-enchanting continues to use Arcana/TH.
- [x] Passive Arcana is 10 + Arcana Mod for automatic magical-information tiers.
- [x] Active deeper Arcana study may be retried and costs 1 SP per attempt.
- [x] Difficulty/probability/details above the character's knowledge tier remain runic/obfuscated.
- [x] Player-supplied valid materials discount the full-service quote; mixed Player/provider material supply is supported.
- [x] Service cost separates labor/facility from provider-supplied materials and does not double-apply normal Shop retail markup.
- [x] Rank I service time is measured in hours; Rank II is approximately 1-3 days; Rank III is approximately one week or more.
- [x] Enchantment rarity may affect knowledge, availability, time, materials, price and provider reliability without allowing Rank IV/V reproduction.
- [x] Magical Durability is a separate resource added on top of full Physical Durability.
- [x] Magical Durability represents usable magical integrity/charge; depletion makes the Enchantment inactive/depleted rather than permanently erasing it.
- [x] Gem-Anchored Enchantments generally have better Magical Durability than equivalent direct/pure Enchantments.
- [x] Depleted magical runes stop glowing as a visible cue.
- [x] Bound Enchantments ignore ordinary/background Magical Durability wear; special activated powers may spend authored magic and use Part D accelerated/life-backed recharge.
- [x] Magical Repair/Recharge restores magical integrity only; physical repair restores physical condition only.
- [x] Removing a Bound Gem Anchor destroys the Item 100%.
- [x] Item-side Enchantment removal/rewrite and destructive Gem-Anchor-side removal are separate service procedures.
- [x] Safe Item-side de-enchant/rewrite may preserve the gem but reduces its magical quality/rarity because it has already been magically written.
- [x] Gem-Anchor-side Enchantment removal may destroy the gem while preserving the Item.
- [x] Identify reveals ordinary magical properties and may flag Cursed, but does not reveal the hidden Curse drawback.
- [x] Dedicated Curse reading reveals the hidden Curse information; Curse text remains distinct purple/red runic content while unknown.
- [x] Enchanter profiles may attach to specialized NPCs, Shops, Workshops, Jewelers/magic specialists or occult/Black Market providers using one backend.
- [x] Existing Workshop Tier/specialization/reputation/quality should be reused rather than duplicated.
- [x] DM tooling must support general provider authoring and validated custom Enchantment/Curse combinations without raw debug UI.
- [x] Player Item/service visibility depends on Arcana/Identify/Curse knowledge rather than raw Item truth.
- [x] Future Magic Loot handoff records ordinary enemy magical-equipment intent around 5-10% and magic-user intent around 50-75%, with exact rates deferred to encounter/content balance.

### Part C implementation gate

- [x] Create canonical Enchanter Service runtime on top of Shop/Workshop service architecture.
- [x] Add provider profile: known Enchantments, specialties, Rank cap III, reliability, delivery time, material supply, Bind/Curse capability and price modifiers.
- [x] Implement controlled/altered NPC magical outcome selection instead of NPC crafting Checks.
- [ ] Add Enchantment Compendium with language-aware recipe sources and Relic-derived lower-rank knowledge.
- [x] Block Player/NPC service reproduction of Rank IV/V Relic Enchantments.
- [x] Implement Passive Arcana information tiers and repeatable 1-SP active Arcana study.
- [ ] Implement knowledge-gated service preview with rune obfuscation.
- [x] Implement Identify -> Cursed flag without Curse drawback leakage and dedicated Curse-detail resolution.
- [x] Implement Player/mixed/provider material quote paths, consume only allocated ritual materials, and return recoverable procedure outputs.
- [x] Implement in-world delivery job state for Rank I/II/III services.
- [x] Replace obsolete 50/50 Durability logic with full Physical Durability + separate proportional Magical Durability.
- [ ] Add Magical Durability wear, depletion, recharge/repair and rune-glow state.
- [x] Give Gem-Anchored Enchantments greater proportional magical endurance than equivalent direct/pure Enchantments (75% vs 50% of Physical Durability Max).
- [x] Exempt Bound Enchantments from normal magical discharge.
- [x] Implement separate Item-side removal/rewrite and Gem-Anchor destructive removal flows.
- [x] Implement Bound Gem Anchor removal -> 100% Item destruction once the destructive procedure is confirmed.
- [x] Implement authored post-writing gem quality degradation handling after safe de-enchant/rewrite without hard-coding the balance step.
- [x] Implement explicit max-3 Enchantment Gem Sockets separately from Base Enchantment Slots.
- [x] Support up to three Rank II Gem-Anchored Enchantments; Rank III Gem-Anchored magic is exclusive.
- [x] Finalize/test Rank III Gem-Anchor coexistence: Rank III cannot coexist with lower-rank Gem Anchors.
- [x] Block/warn normal fourth-gem installation and implement catastrophic forced fourth-gem outcome.
- [ ] Add DM Enchanter authoring and Player service UI without internal IDs/debug schema.
- [ ] Add Part C regression tests for services, knowledge, outcomes, durability, gem removal, Relics, time and economy.

## Part D — Magic Item Runtime Integration (design frozen)

Canonical contract: [`docs/enchanters-update-part-d-magic-items.md`](./enchanters-update-part-d-magic-items.md)

### Frozen design decisions

- [x] Every enchanted Item is a Magic Item, but Magic Item does not automatically mean Magic Hit.
- [x] Base Attunement capacity remains 3 Items unless a canonical Trait/effect modifies it.
- [x] One Item consumes one Attunement Slot regardless of how many Enchantments/Gem Anchors it contains.
- [x] Normal Rank I Enchanted Items do not require Attunement by default.
- [x] Any normal Enchanted Item carrying Rank II or Rank III magic requires Attunement.
- [x] Unattuning preserves the Item's Enchantments but suppresses its attunement-gated magical benefits.
- [x] Individual Gem Anchors never consume separate Attunement Slots from their parent Item.
- [x] Enchantments may author their own activation timing/trigger family.
- [x] Installed Enchantment identity cannot be dynamically retuned during normal gameplay; changing it requires the proper rewrite/removal service when allowed.
- [x] Player-facing Charges are backed by Magical Durability/magical-power integrity rather than an unrelated second battery.
- [x] Some Items spend Magical Durability only when activating special properties.
- [x] Recharge behavior is definition-driven.
- [x] Item-bound Spells with their own Charges/resource do not consume the wielder's Spell Slots.
- [x] Spell-enabling/conduit Items without their own Item resource use the wielder's normal Spell Slot/resource.
- [x] SP is spent only when explicitly authored by the Item, Enchantment or Curse.
- [x] A depleted enchanted physical Item remains usable as its mundane form while Physical Durability permits.
- [x] Physical Durability 0 uses existing damaged/broken Item rules and does not automatically annihilate/explode the Item.
- [x] Bind is a special Curse-family state.
- [x] Bound magic ignores ordinary/background Magical Durability wear, but special activated powers may still spend authored magic.
- [x] Bound magic recharges faster according to its definition and may fully recharge at zero by draining the user's Life/HP.
- [x] Bound Items block normal unequip; if Attuned, they also block normal unattunement and lock that Attunement Slot.
- [x] Persistent Curses may ignore normal magical depletion and author self-preservation/recharge behavior.
- [x] A character can use a known activatable function without fully understanding the Item's arcane internals; passive effects require no conscious understanding.
- [x] Native Magic Items and Enchanted Items are distinct origins but share one `item-magic-runtime.js` backend.
- [x] Native Wondrous/utility Magic Items need not use normal Enchantment Slots or Gem Sockets.
- [x] Scrolls, talismans and enchanted ammunition remain supported future Magic Item families; Potions are not a priority for the adaptation.
- [x] Classic D&D-style +1/+2/+3 items must be adapted into named Enchantment/Rank content rather than restoring universal +N naming.
- [x] Rank IV/V are Relic/Legendary Magic Items that may exceed normal curves but still use the shared Magic Item runtime.
- [x] Relics use authored special repair/recharge procedures discoverable through Arcana/knowledge.
- [x] Identify has a 5% exceptional breakthrough chance on Relics to reveal an authored deeper information layer.
- [x] Relic drawbacks may be inseparable properties rather than removable normal Curses.
- [x] Unique/Artifact/Relic definitions may require unique Item Instances and provenance.
- [x] DM tooling must support creating Magic Items from scratch and modifying existing Items through validated canonical effect modules.
- [x] Full D&D Magic Item content adaptation is deferred to a separate Magic Items Update after this Enchantment framework is ready.

### Part D implementation gate

- [x] Extend `LuminousItemMagicRuntime.isMagicItem()` to recognize applied Enchantments.
- [x] Keep Magic Item status independent from Magic Hit.
- [x] Implement Rank II+ automatic Attunement requirement for normal Enchanted Items.
- [x] Preserve base Attunement capacity 3 plus Trait/effect modifiers.
- [x] Enforce one Item = one Attunement Slot regardless of Enchantment/Gem count.
- [x] Suppress attunement-gated Enchantment benefits when unattuned without deleting magic state.
- [x] Add Native Magic Item origin support through the same runtime.
- [x] Add whitelisted activation trigger families; practical activation does not require full Arcana identification.
- [x] Keep installed Enchantment identity fixed outside proper service rewrite/removal.
- [x] Refactor Charges to project from/spend canonical Magical Durability.
- [x] Add per-property Charge -> Magical Durability mapping and definition-driven recharge.
- [x] Preserve Item-bound Spell casting without user Spell Slot cost when the Item provides its own resource.
- [x] Support conduit Items that use the wielder's normal Spell Slots/resources.
- [x] Spend SP only when explicitly authored.
- [x] Keep depleted enchanted physical Items mundanely usable when physically intact.
- [x] Migrate Bind to Curse-family runtime behavior.
- [x] Block normal unequip/unattune for Bound Items and lock their occupied Attunement Slot.
- [x] Add Bound accelerated recharge and authored life/HP-backed full recharge at zero.
- [x] Add persistent Curse self-preservation/recharge hooks.
- [ ] Distinguish normal Curse, Bound Curse and inseparable Relic drawback.
- [ ] Add Rank IV/V Relic support without normal reproduction.
- [ ] Add Relic maintenance/repair knowledge gates and 5% Identify breakthrough.
- [ ] Add unique-instance/provenance support for Relics/Artifacts.
- [ ] Preserve Native Wondrous Item, Scroll, talisman and enchanted-ammunition seams for the Magic Items Update.
  - [x] Native Wondrous Item and existing Scroll seams are preserved; talisman/ammunition generic hooks remain pending.
- [ ] Add validated DM Magic Item creation/editing.
- [ ] Add representative Part D regression fixtures/tests before starting mass Magic Item content adaptation.

## 1. Scope and hard rules

- [x] Keep Enchanter's Update separate from Magic Loot random generation.
- [x] Apply enchantments to Item Instances, not by mutating canonical Item definitions.
- [x] Preserve the original Item definition as the non-magical source of truth.
- [x] Keep every applied enchantment traceable to a canonical Enchantment definition ID.
- [ ] Make enchantment state persist through inventory, stash, transfer and equipment flows.
- [ ] Do not allow client UI to invent enchantments that the canonical registry does not contain.
- [x] Keep player-facing UI free of debug-only controls/data.
- [x] Reserve an integration seam for a future Magic Loot Provider without implementing random magic loot now.

## 2. Canonical Enchantment definition contract

- [x] Create a canonical Enchantment registry/runtime.
- [x] Give every Enchantment a stable internal ID.
- [x] Store player-facing name and description separately from internal IDs.
- [x] Define Enchantment tier/power level.
- [x] Define Enchantment tags/categories.
- [x] Define eligible Item families/categories/types.
- [x] Define explicit ineligible Item families/categories/types.
- [x] Define allowed equipment slots where relevant.
- [x] Define conflict/exclusion groups.
- [x] Define stacking policy.
- [x] Define maximum copies per Item.
- [x] Define whether the Enchantment is permanent, removable or replaceable.
- [ ] Define charges/uses when an Enchantment is charge-based.
- [x] Define activation trigger when an Enchantment is conditional.
- [x] Define canonical effect payloads without arbitrary eval/script execution.
- [ ] Define canonical icon/visual metadata.
- [ ] Define economy metadata: AHN cost/value contribution.
- [x] Define material/reagent requirements.
- [x] Validate malformed Enchantment definitions before runtime use.

## 3. Item Instance integration

- [x] Add canonical applied-enchantment state to Item Instances.
- [x] Preserve Enchantment definition ID, Rank and instance-specific state.
- [ ] Preserve application provenance.
- [ ] Preserve who/what applied the Enchantment.
- [ ] Preserve application Encounter/Location/Service context when relevant.
- [ ] Preserve Item Charge presentation/state per Item Instance while keeping its resource authority mapped to canonical Magical Durability.
- [ ] Preserve dormant/disabled state independently per Item Instance.
- [ ] Preserve removal/replacement history where needed.
- [x] Hydrate/serialize enchantment state through Item Inventory Runtime.
- [x] Ensure stack merging refuses Items with different enchantment state.
- [ ] Ensure stack splitting preserves the correct enchantment state.
- [x] Ensure transfer/trade does not strip enchantments.
- [x] Ensure equipped Items keep their enchantments after save/load.

## 4. Enchantment capacity / slots

- [x] Define how many Enchantments an Item can support.
- [ ] Allow Item definitions to override default enchantment capacity.
- [x] Support zero-capacity Items.
- [ ] Support Item-family defaults for enchantment capacity.
- [x] Validate slot/capacity before application.
- [x] Prevent applying more Enchantments than allowed.
- [x] Prevent conflict-group combinations.
- [x] Prevent duplicate non-stackable Enchantments.
- [x] Allow compatible multi-Enchantment Items where capacity permits.
- [ ] Expose capacity/used slots to player-facing Enchanter UI.

## 5. Canonical effect model

- [x] Define a whitelist of supported Enchantment effect types.
- [ ] Support flat Item stat modifiers where applicable.
- [ ] Support percentage Item stat modifiers where applicable.
- [ ] Support damage-type additions/modifiers where applicable.
- [ ] Support resistance/defense-related effects where applicable.
- [ ] Support conditional effects with explicit triggers.
- [ ] Support limited-use/charge-based effects.
- [ ] Support passive effects.
- [ ] Define deterministic ordering when multiple Enchantments modify the same value.
- [ ] Define additive vs multiplicative stacking rules.
- [ ] Prevent Enchantments from directly mutating unrelated player/NPC fields.
- [ ] Resolve effects through Battle Engine adapters rather than UI-only display values.
- [ ] Ensure unequipped equipment-only Enchantments do not remain active.
- [ ] Ensure broken/disabled/dormant Enchantments do not contribute effects.
- [ ] Add effect-resolution provenance for debugging/tests without exposing debug UI to players.

## 6. Enchanter service / application transaction

- [ ] Create a canonical Enchanter service runtime.
- [ ] Validate Item eligibility before showing/applying an Enchantment.
- [ ] Preview resulting Item state before committing.
- [ ] Preview AHN cost before committing.
- [ ] Preview reagent/material requirements before committing.
- [ ] Validate player has required AHN/materials.
- [ ] Consume AHN and materials atomically with the Enchantment application.
- [ ] Roll back the transaction if any required payment/material consumption fails.
- [ ] Apply Enchantment atomically to the intended Item Instance.
- [ ] Prevent double-submit/duplicate application.
- [ ] Return a stable transaction/result ID.
- [ ] Record application provenance on success.
- [ ] Support DM-authored free application without bypassing validation.
- [ ] Support explicitly authored service discounts/surcharges.
- [ ] Keep service economy separate from random magical-loot rarity generation.

## 7. Removal, replacement and re-enchanting

- [ ] Define whether each Enchantment can be removed.
- [ ] Define removal costs/material requirements.
- [ ] Support atomic removal transactions.
- [ ] Support replacement of removable Enchantments.
- [ ] Preserve history/provenance after replacement.
- [ ] Define whether removed Enchantments return reagents.
- [ ] Prevent removing permanent Enchantments through normal service.
- [ ] Prevent capacity/conflict violations during replacement.
- [ ] Support re-enchant preview before commit.

## 8. Charges and usage lifecycle

- [x] Define charge initialization/resource authority: Charges are Item-defined projections backed by Magical Durability; concrete maxima/recharge remain authored content.
- [ ] Persist current/max player-facing Charge state per Item Instance when authored, with Charge spending backed by canonical Magical Durability.
- [ ] Consume authored Charges/Magical Durability through authoritative gameplay actions.
- [ ] Prevent negative Charges or Magical Durability.
- [x] Define behavior at zero magical resource: ordinary enchanted effects deplete/inactivate while physical Items remain usable; Bind/Curse may author persistence/recharge.
- [x] Support recharge rules only when authored by the Enchantment/Magic Item definition.
- [ ] Prevent UI/client-only charge resets.
- [ ] Preserve charge state across save/load, transfer and equipment changes.
- [ ] Add charge lifecycle regression tests.

## 9. Inventory / equipment / transfer integration

- [ ] Validate enchanted Items through Item Inventory Runtime.
- [x] Preserve Enchantments in Active Inventory.
- [x] Preserve Enchantments in Stash.
- [x] Preserve Enchantments during player-to-player transfer.
- [x] Preserve Enchantments when equipping/unequipping.
- [x] Prevent stack merge across non-identical Enchantment state.
- [ ] Ensure Item comparison/details expose canonical Enchantment differences.
- [ ] Ensure Item provenance and Enchantment provenance remain separate but linked.
- [ ] Add inventory serialization/hydration regression tests.

## 10. Battle Engine integration

- [ ] Add a Battle Engine adapter for equipped Item Enchantments.
- [ ] Resolve passive effects from equipped enchanted Items.
- [ ] Resolve conditional/triggered Enchantment effects.
- [ ] Resolve charge consumption from authoritative combat outcomes.
- [ ] Ensure duplicate equipment references do not double-apply an Enchantment.
- [ ] Ensure unequipped Items stop contributing equipment-only effects.
- [ ] Ensure defeated/dead actors do not continue emitting invalid triggered effects.
- [ ] Add deterministic combat-effect regression tests.
- [ ] Add Battle Viewer smoke coverage for enchanted equipment.

## 11. Economy / value

- [x] Define how Enchantments contribute to Item AHN value.
- [x] Keep base Item value separate from Enchantment value contribution.
- [x] Define service application cost independently from resale value.
- [ ] Support tier-based cost curves.
- [ ] Support reagent/material costs.
- [ ] Support authored Enchanter markup/discount profiles.
- [ ] Prevent negative or NaN Enchantment prices.
- [ ] Add economy regression tests.

## 12. Enchanter UI

- [ ] Add an Enchanter service screen/panel.
- [ ] Show eligible Items only.
- [ ] Show why an Item is ineligible.
- [ ] Show current Enchantments on the selected Item.
- [ ] Show used/available Enchantment capacity.
- [ ] Show conflicts before commit.
- [ ] Show resulting Item preview.
- [ ] Show AHN cost.
- [ ] Show required materials/reagents.
- [ ] Show insufficient-payment/material state clearly.
- [ ] Require explicit confirmation before committing.
- [ ] Prevent duplicate click/double-submit.
- [ ] Refresh Item state after successful application/removal.
- [ ] Keep internal schema/debug data out of player-facing UI.

## 13. DM Enchantment controls

- [ ] Add DM Enchantment management controls.
- [ ] Let DM inspect canonical Enchantment definitions.
- [ ] Let DM inspect Enchantments on an Item Instance.
- [ ] Let DM apply an Enchantment through the same validation contract.
- [ ] Let DM remove a removable Enchantment through the same validation contract.
- [ ] Let DM grant a free service transaction while preserving provenance.
- [ ] Show validation/conflict reasons to the DM.
- [ ] Do not expose raw debug controls in normal player UI.

## 14. Player knowledge / display

- [ ] Display known Enchantments on Item details.
- [ ] Keep internal IDs separate from player-facing names.
- [x] Define whether Enchantments can be hidden/unidentified.
- [x] If hidden Enchantments are supported, store knowledge separately from Item truth.
- [ ] Ensure sharing/trading an Item does not automatically leak hidden metadata unless rules allow it.
- [ ] Integrate identified Enchantment knowledge with Compendium/knowledge systems only where useful.

## 15. Tests / validation / CI

- [ ] Add Enchantment schema validation tests.
- [ ] Add eligibility tests.
- [ ] Add capacity/slot tests.
- [ ] Add conflict-group tests.
- [ ] Add duplicate/stacking tests.
- [ ] Add Item Instance serialization tests.
- [ ] Add inventory transfer tests.
- [ ] Add application transaction rollback tests.
- [ ] Add material/AHN payment tests.
- [ ] Add removal/replacement tests.
- [ ] Add charge lifecycle tests.
- [ ] Add Battle Engine effect tests.
- [ ] Add player-facing UI smoke tests.
- [ ] Add DM Enchantment UI smoke tests.
- [ ] Add Enchanter's Update CI workflow/path coverage.

## 16. Explicitly deferred to Magic Loot Update

- [x] RANDOM MAGIC LOOT — intentionally deferred.
- [x] Random Enchantment/Affix rolls on enemy drops — intentionally deferred.
- [x] Random magical rarity generation — intentionally deferred.
- [x] Random cursed Item generation — intentionally deferred.
- [x] Artifact/random legendary property generation — intentionally deferred.
- [x] Random magic-loot tables/pools — intentionally deferred.
- [x] Zone/Event-driven random magical drop generation — intentionally deferred.
- [ ] Connect a future Magic Loot Provider only after the Enchanter core is stable.
