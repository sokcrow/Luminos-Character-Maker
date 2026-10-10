# Enchanter's Update — Primera entrega: Core V1

Status: **implemented in feature branch, awaiting integration review**. This pass defines the deterministic enchanted **Item Instance** contract and its passive combat bridge. It does **not** introduce enchantment crafting, DM editor UI, magic loot generation or an AHN pricing policy.

## Invariants inherited from existing Items

- Material, Quality, physical Upgrades and structural components remain mundane and **must not** use `+1/+2/+3`.
- **Only** enchantments use positive `enhancementLevel` values: `1`, `2`, `3`.
- `enhancementSource = "enchantment"` is required for enchanted Instances; mundane Items keep level `0`, source `"mundane"`.
- Enchantment is stored **on the Item Instance**, never applied to a shared canonical definition. A non-enchanted copy of the same Item remains unchanged.
- One active V1 enchantment **focus** per Item. Applying a second enchantment is rejected unless the caller explicitly requests `replace: true`. Enchantments from different equipped Instances resolve independently.
- V1 enchantment levels are **absolute numeric modifier values**, not a percentage, a weapon grade, or a bonus to every channel.
- All numeric enchanted focuses use the existing `LuminousUniversalModifiers` **additive** channels. No separate stat/roll system is introduced.
- Item Instances without a real `instanceId` cannot be enchanted.
- No negative magic tiers or `+4` and above.

## Enchantment focus by Item kind

The base enchantment for a kind is a **single focus** with magnitude equal to its enhancement level.

| Kind | Default channel | Exact activation rule |
| --- | --- | --- |
| Weapon | `offensive_level` | Only a Skill explicitly referring to that equipped **weapon Instance ID** |
| Armor | `defensive_level` | Armor must be equipped |
| Shield | `guard_power` | Shield must be equipped; modifies Guard power through the existing combat channel |
| Accessory | **Author must choose** | Accessory must be equipped and `enchantmentReady === true` |
| Valuable | **Author must choose** | Valuable must be equipped in an accessory slot and `enchantmentReady === true` |

A weapon's enchantment **never globally modifies all Skills**. If a Skill cannot identify its source weapon Item Instance, the weapon bonus does not apply (fail-closed). Inactive equipment yields no enchantment Traits.

Each family can opt into another **approved focus channel**, authored when enchantment is created:

- Weapon: `offensive_level`, `base_power`, `final_power`, `clash_power`.
- Armor: `defensive_level`, `guard_power`.
- Shield: `guard_power`, `defensive_level`.
- Accessory and Valuable: `offensive_level`, `defensive_level`, `guard_power`, `speed`, `min_speed`, `max_speed`.

Unsupported channels, such as arbitrary status application, invented resistances or undefined spell effects, must be rejected, not silently accepted. **+1**, **+2** and **+3** are respectively a `+1`, `+2` and `+3` additive modifier **only in the approved focus channel**. They do not imply generic D&D attack-roll, armor-class or damage-dice formulas. Existing Limbus channels remain authoritative.

If a magical Item requires Attunement, its passive enchantment is active only when that specific Item Instance is attuned. Attunement is not mandatory for all V1 enchantments; pre-existing Item magic configuration owns that decision.

## Canonical Instance format

Example (enchanted weapon):

```json
{
  "instanceId": "unique_weapon_instance",
  "definitionId": "canonical_weapon",
  "itemType": "weapon",
  "enhancementLevel": 2,
  "enhancementSource": "enchantment",
  "enchanted": true,
  "enchantment": {
    "schemaVersion": 1,
    "tier": 2,
    "kind": "weapon",
    "focus": { "channel": "offensive_level", "value": 2 }
  }
}
```

Optional enchantment metadata: `creatorId`; the runtime does not invent provenance. This metadata is not a player-facing debugging field.

Creation is atomic from the caller's perspective: validation runs **before** an Item is mutated. Invalid or duplicate enchantments leave the Item untouched. Removal resets the four enchantment fields to their mundane state without wiping unrelated Item data such as Quality, physical Upgrades, Spell charges or ownership.

The inventory `VARIANT_FIELDS` allow enchanted Instance properties to survive `compactInstance`, `serializeItemInstance`, `deserializeItemInstance`, `hydrateItemInstance`, `stackSignature` and the Firebase persistence bridge. The canonical instance remains the source of truth; no second enchantment store is introduced.

## Public runtime API

File: `js/item-enchantment-runtime.js`

- `validate(item, request, { replace })`
- `applyEnchantment(item, { level, channel? }, { replace?, creatorId? })`
- `activeEnchantment(item)`
- `removeEnchantment(item)`
- `collectEquippedTraits(unit, { skill?, equipment? })`

The equipment Trait bridge in `js/universal-modifier-engine.js` reads `collectEquippedTraits` and passes its canonical `rules` to the existing modifier resolver. Item Magic detection also recognizes enchanted Items. The Inventory bootstrap loads the new runtime without introducing visible UI or debug panels.

## Next deliveries (not implemented here)

1. **Enchanter Studio** in the DM Item authoring flow: guarded controls, preview, replacement and removal, accessible player-friendly labels and consistent iconography.
2. Recipes, enchantment material costs, creation checks and stations (only after design approval).
3. AHN multipliers for +1/+2/+3. Base `enchantmentBaseValueAhn` is already reserved in Item economy. **No magic price values are decided** in this delivery.
4. Gem-resonance effects, elemental/status magic, active enchantments, advanced stacking rules and compatibility with spell executors.
5. **Magic Loot Update**, independently: drop pools, rarity, random magical rolls, cursed loot drops and magical encounter modifiers.

## Verification

A smoke run exercised: levels +2/+3, rejecting +4 and negative tiers, incompatible channels, silent stacking, author-requested replacement, unchanged physical Quality, weapon Item Instance gating, armor passive activation, equipment disablement, accessory readiness, attunement, removal and re-enchantment.

No test files or persistent test dependencies are added in accordance with the repo's temporary-test policy. Full browser Firebase and live-combat acceptance testing is a separate integration gate.
