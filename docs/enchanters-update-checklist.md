# Enchanter's Update — Implementation Checklist

This PR is the living implementation tracker for the **Enchanter's Update**.

The Enchanter's Update is responsible for **authoring, validating, applying, removing, persisting and resolving enchantments on existing Item Instances**.

Random magical drops, random affix rolls, cursed random loot and artifact generation remain outside this update and belong to a later **Magic Loot Update**.

## 1. Scope and hard rules

- [ ] Keep Enchanter's Update separate from Magic Loot random generation.
- [ ] Apply enchantments to Item Instances, not by mutating canonical Item definitions.
- [ ] Preserve the original Item definition as the non-magical source of truth.
- [ ] Keep every applied enchantment traceable to a canonical Enchantment definition ID.
- [ ] Make enchantment state persist through inventory, stash, transfer and equipment flows.
- [ ] Do not allow client UI to invent enchantments that the canonical registry does not contain.
- [ ] Keep player-facing UI free of debug-only controls/data.
- [ ] Reserve an integration seam for a future Magic Loot Provider without implementing random magic loot now.

## 2. Canonical Enchantment definition contract

- [ ] Create a canonical Enchantment registry/runtime.
- [ ] Give every Enchantment a stable internal ID.
- [ ] Store player-facing name and description separately from internal IDs.
- [ ] Define Enchantment tier/power level.
- [ ] Define Enchantment tags/categories.
- [ ] Define eligible Item families/categories/types.
- [ ] Define explicit ineligible Item families/categories/types.
- [ ] Define allowed equipment slots where relevant.
- [ ] Define conflict/exclusion groups.
- [ ] Define stacking policy.
- [ ] Define maximum copies per Item.
- [ ] Define whether the Enchantment is permanent, removable or replaceable.
- [ ] Define charges/uses when an Enchantment is charge-based.
- [ ] Define activation trigger when an Enchantment is conditional.
- [ ] Define canonical effect payloads without arbitrary eval/script execution.
- [ ] Define canonical icon/visual metadata.
- [ ] Define economy metadata: AHN cost/value contribution.
- [ ] Define material/reagent requirements.
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

- [ ] Define how many Enchantments an Item can support.
- [ ] Allow Item definitions to override default enchantment capacity.
- [ ] Support zero-capacity Items.
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
- [ ] Define whether Enchantments can be hidden/unidentified.
- [ ] If hidden Enchantments are supported, store knowledge separately from Item truth.
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

- [ ] RANDOM MAGIC LOOT — intentionally deferred.
- [ ] Random Enchantment/Affix rolls on enemy drops — intentionally deferred.
- [ ] Random magical rarity generation — intentionally deferred.
- [ ] Random cursed Item generation — intentionally deferred.
- [ ] Artifact/random legendary property generation — intentionally deferred.
- [ ] Random magic-loot tables/pools — intentionally deferred.
- [ ] Zone/Event-driven random magical drop generation — intentionally deferred.
- [ ] Connect a future Magic Loot Provider only after the Enchanter core is stable.
