# Jewelry / Valuables V1 — Generative Mundane Treasure

## Scope

This pass introduces **mundane** jewelry and valuables as generative Items.

It does not define final Enchantment tier multipliers, but gem-bearing variants now expose a stable mundane base value that an Enchantment multiplier can consume.

The goal is to avoid fixed catalog spam such as one Item ID for every metal/gem combination.

A chassis becomes a concrete Item from:

```text
Chassis
+ refined metal / alloy
+ zero or more CUT gemstones
+ Quality
= unique mundane jewelry / valuable
```

## Pricing

Currency remains **AHN**.

```text
Consumed Input Value
= metal input value + cut gemstone input values

Standard Production Value
= Consumed Input Value × chassis craft multiplier

Realized Production Value
= Standard Production Value × Universal Quality value multiplier
```

Pricing model:

```text
consumed_material_value_x_chassis_multiplier_x_quality_v1
```

Retail markup is not embedded.

Before an Enchantment is applied, `enchantmentValueAhn` remains **0 Ahn**. Gem-bearing variants expose `baseMundaneValueAhn` and `enchantmentBaseValueAhn`; a later or explicit Enchantment multiplier is applied to that already-composed mundane value rather than recalculating metal or gemstones.

## 8 Jewelry chassis

Only the eight forms with dedicated icon sets remain in the commercial Jewelry catalog:

- Ring
- Earrings
- Pendant
- Necklace
- Bracelet
- Anklet
- Brooch
- Ornamental Hairpin

Removed from the catalog rather than hidden behind shared art:

- Plain Band
- Signet Ring
- Medallion
- Choker
- Bangle
- Cuff Bracelet
- Cufflinks
- Circlet
- Tiara
- Crown

Each Jewelry form has four visual material variants:

- Gold -> Gold
- Silver -> Silver / Platinum
- Copper -> Copper / Bronze / Brass
- Metal -> darker/non-precious metals such as Iron

The actual material still determines Production Value. The visual bucket only selects the icon.


## 8 Valuable loot forms

The concrete Valuable forms supplied with art are restored as loot-only objects:

- Goblet
- Chalice
- Decorative Box
- Statuette
- Mask
- Ornamental Plate
- Reliquary
- Scepter

Each has exactly two loot/value variants:

- Gold
- Gems

The Gems version remains a higher-value loot tier. Visually it reuses the Gold base icon and composes a Cut Gem icon as a lower-corner overlay. A concrete `gemId` may be supplied when the loot generator knows which gem is visible; otherwise the generic `gem_cut` overlay is used. The Valuable's fixed Gems-tier price remains authoritative regardless of which overlay gem is shown.

Standard loot values:

| Valuable | Gold | Gems |
| --- | ---: | ---: |
| Goblet | 420,000 Ahn | 780,000 Ahn |
| Chalice | 500,000 | 900,000 |
| Decorative Box | 650,000 | 1,150,000 |
| Statuette | 800,000 | 1,450,000 |
| Mask | 700,000 | 1,250,000 |
| Ornamental Plate | 850,000 | 1,500,000 |
| Reliquary | 1,100,000 | 1,950,000 |
| Scepter | 1,250,000 | 2,200,000 |

All remain:

- `craftable: false`
- `retailAvailable: false`
- `lootOnly: true`


## Editable Jewelry material variants

Jewelry may still use refined metals/alloys; the four icon buckets collapse similar appearances without creating another Item type.

Examples:

- Copper Ring
- Silver Bracelet
- Gold Necklace
- Bronze Brooch

Raw ores and nonmetal processed materials are rejected as jewelry metal inputs.

## Editable gemstone variants

Only **Cut Gems** can be mounted into a finished mundane piece.

The gemstone list supports repeated quantities and mixed identities.

Example:

```text
Gold Necklace
- Diamond ×1
- Ruby ×6
```

This is one generated Item rather than seven separate socket records or a unique hard-coded catalog ID.

Each chassis has a practical maximum gemstone count. Larger commercial chassis such as Necklaces support more gemstones than Rings.

## Gem overlay composition

Gem-bearing Jewelry and Gems-tier Valuables do not require a separate fully-rendered incrustation icon.

The inventory card composes:

```text
base item icon
+ Cut Gem overlay in the lower-right corner
```

Jewelry chooses one display gem from its actual composition:

1. highest quantity;
2. if tied, highest total gemstone input value;
3. stable ID tie-break.

Example:

```text
Gold Necklace
Diamond ×1
Ruby ×6

base icon  -> jewelry_necklace_gold
overlay    -> gem_ruby_cut
```

The complete gemstone list remains on the Item; the overlay is only a compact visual cue.

## Stable base value for Enchantment

Every gem-bearing generated variant records its mundane value before Enchantment:

```text
baseMundaneValueAhn
enchantmentBaseValueAhn
enchantmentReady: true
enchantmentMultiplier: 1
enchantmentValueAhn: 0
```

Jewelry also receives a deterministic `variantSignature` from chassis + real metal + Quality + gemstone composition.

When a multiplier is supplied:

```text
Enchanted Total
= enchantmentBaseValueAhn × Enchantment Multiplier

enchantmentValueAhn
= Enchanted Total - enchantmentBaseValueAhn
```

The catalog intentionally does **not** invent the final +1/+2/+3 price multipliers. `applyEnchantmentMultiplier(...)` accepts the multiplier supplied by the later Enchantment rules.

Non-gemmed Jewelry and Gold-only Valuables are not marked `enchantmentReady` by this Jewelry/Valuables contract.
## Gem resonance

The generated Item preserves every mounted gem and exposes a compositional resonance summary.

Example:

```text
Diamond ×1 -> light 1 / force 1
Ruby ×6    -> fire 6 / heat 6

dominant resonance -> fire / heat
```

This is **composition metadata**, not an enchantment effect.

It is intended to become input for the later Enchantment system.

## Example value

Standard Gold Necklace:

- Gold: 0.45 MU = 162,000 Ahn
- Diamond ×1 = 660,000 Ahn
- Ruby ×6 = 1,350,000 Ahn
- consumed inputs = 2,172,000 Ahn
- Necklace craft multiplier = 1.50×

Final Standard Production Value:

```text
3,258,000 Ahn
```

Fine Quality applies the universal Quality value multiplier after composition.

## Mundane/enchantment boundary

Every mundane piece starts with:

```text
enchanted: false
enchantment: null
enchantmentMultiplier: 1
enchantmentValueAhn: 0
enchantmentPricingStatus: multiplier_ready
```

Gem-bearing pieces additionally expose `enchantmentReady: true` and their mundane base value. This lets the later Enchantment pass increase the price without rewriting or double-counting the underlying material/gem composition.

## Validation

- 8 Jewelry chassis
- 8 Valuable loot forms with Gold/Gems variants
- 16 total chassis (8 Jewelry + 8 Valuable)
- unique/non-stackable jewelry
- refined metal/alloy validation
- Cut Gem validation
- per-chassis gem capacity
- mixed/repeated gem quantities
- resonance aggregation
- universal Quality value application
- AHN economy smoke coverage
- all Valuable forms are loot-only and reject normal market/craft generation
- Circlet / Tiara / Crown removed from the modern commercial baseline
- Jewelry forms without supplied icons are removed rather than sharing another form's icon
- lower-right Cut Gem overlay for gem-bearing Jewelry / Valuable variants
- deterministic mundane base values for later Enchantment multipliers
- Gold Valuable base art reused for Gems variants; no dedicated incrustation base icon required
