# Enchanter's Update — Implementation Checklist

This PR is the living implementation tracker for the **Enchanter's Update**.

The Enchanter's Update is responsible for **authoring, validating, applying, removing, persisting and resolving enchantments on existing Item Instances**.

Random magical drops, random affix rolls, cursed random loot and artifact generation remain outside this update and belong to a later **Magic Loot Update**.


## Part A — Enchantment Core (design frozen)

Canonical contract: [`docs/enchanters-update-part-a-core.md`](./enchanters-update-part-a-core.md)

Design decisions are marked complete here; implementation remains open.

### Frozen design decisions

- [x] Item Tier capacity is fixed at Tier I = 0, Tier II = 1, Tier III = 1, Tier IV = 2, Tier V = 3 Enchantment Slots.
- [x] Hard maximum is 3 Enchantment Slots.
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
- [x] First Enchantment splits maintenance into 50% Physical Durability / 50% Magical Durability without changing total Max Durability.
- [x] Physical damage and magical damage require their appropriate specialists; one repair path cannot silently restore the other half.
- [x] `bind` is a property: hidden from naming, x1.25 positive effect, upgradable, and not normally removable/replaced/transferred.
- [x] `curse` is hidden until detected, x1.50 positive effect, can strengthen, may scale penalties, and has lower market value than the clean equivalent.
- [x] Initial cursed market baseline is x0.60 of the clean equivalent; creation/service cost is not discounted by that market penalty.
- [x] Item Instances persist stable Enchantment IDs/Ranks/state while canonical definitions remain effect authority.

### Part A implementation gate

- [ ] Add canonical Enchantment catalog/schema.
- [ ] Add Enchantment engine/runtime.
- [ ] Add Tier/Rank slot validation and conflict/channel resolution.
- [ ] Add Item Instance persistence/hydration for enchantments and split Durability.
- [ ] Add Arcana/Identify/Curse knowledge resolution and rune-obfuscated display.
- [ ] Add Magic Item vs Magic Hit combat bridge.
- [ ] Add equipment-Trait effect resolution and authored damage/buff support.
- [ ] Add strengthening TH, AHN/material economy and failure resolution.
- [ ] Add Bind and Curse runtime behavior.
- [ ] Add physical/magical repair authority.
- [ ] Add regression/smoke tests and CI path coverage.

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

- [ ] Create a canonical Enchantment registry/runtime.
- [x] Give every Enchantment a stable internal ID.
- [x] Store player-facing name and description separately from internal IDs.
- [x] Define Enchantment tier/power level.
- [ ] Define Enchantment tags/categories.
- [ ] Define eligible Item families/categories/types.
- [ ] Define explicit ineligible Item families/categories/types.
- [ ] Define allowed equipment slots where relevant.
- [x] Define conflict/exclusion groups.
- [x] Define stacking policy.
- [ ] Define maximum copies per Item.
- [x] Define whether the Enchantment is permanent, removable or replaceable.
- [ ] Define charges/uses when an Enchantment is charge-based.
- [ ] Define activation trigger when an Enchantment is conditional.
- [x] Define canonical effect payloads without arbitrary eval/script execution.
- [ ] Define canonical icon/visual metadata.
- [ ] Define economy metadata: AHN cost/value contribution.
- [x] Define material/reagent requirements.
- [ ] Validate malformed Enchantment definitions before runtime use.

## 3. Item Instance integration

- [ ] Add canonical applied-enchantment state to Item Instances.
- [ ] Preserve Enchantment definition ID, tier and instance-specific state.
- [ ] Preserve application provenance.
- [ ] Preserve who/what applied the Enchantment.
- [ ] Preserve application Encounter/Location/Service context when relevant.
- [ ] Preserve charge state independently per Item Instance.
- [ ] Preserve dormant/disabled state independently per Item Instance.
- [ ] Preserve removal/replacement history where needed.
- [ ] Hydrate/serialize enchantment state through Item Inventory Runtime.
- [ ] Ensure stack merging refuses Items with different enchantment state.
- [ ] Ensure stack splitting preserves the correct enchantment state.
- [ ] Ensure transfer/trade does not strip enchantments.
- [ ] Ensure equipped Items keep their enchantments after save/load.

## 4. Enchantment capacity / slots

- [x] Define how many Enchantments an Item can support.
- [ ] Allow Item definitions to override default enchantment capacity.
- [x] Support zero-capacity Items.
- [ ] Support Item-family defaults for enchantment capacity.
- [ ] Validate slot/capacity before application.
- [ ] Prevent applying more Enchantments than allowed.
- [ ] Prevent conflict-group combinations.
- [ ] Prevent duplicate non-stackable Enchantments.
- [ ] Allow compatible multi-Enchantment Items where capacity permits.
- [ ] Expose capacity/used slots to player-facing Enchanter UI.

## 5. Canonical effect model

- [ ] Define a whitelist of supported Enchantment effect types.
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

- [ ] Define charge initialization.
- [ ] Persist current/max charges per Item Instance.
- [ ] Consume charges through authoritative gameplay actions.
- [ ] Prevent negative charges.
- [ ] Define behavior at zero charges.
- [ ] Support recharge rules only when authored by the Enchantment definition.
- [ ] Prevent UI/client-only charge resets.
- [ ] Preserve charge state across save/load, transfer and equipment changes.
- [ ] Add charge lifecycle regression tests.

## 9. Inventory / equipment / transfer integration

- [ ] Validate enchanted Items through Item Inventory Runtime.
- [ ] Preserve Enchantments in Active Inventory.
- [ ] Preserve Enchantments in Stash.
- [ ] Preserve Enchantments during player-to-player transfer.
- [ ] Preserve Enchantments when equipping/unequipping.
- [ ] Prevent stack merge across non-identical Enchantment state.
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

- [ ] Define how Enchantments contribute to Item AHN value.
- [ ] Keep base Item value separate from Enchantment value contribution.
- [ ] Define service application cost independently from resale value.
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
