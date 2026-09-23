# Jewelry / Valuables V1 — Generative Mundane Treasure

## Scope

This pass introduces **mundane** jewelry and valuables as generative Items.

It intentionally does not price or resolve enchantments yet.

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

Enchantments contribute **0 Ahn in V1** and remain deferred.

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

The Gems version is an abstract higher-value visual tier. It does not ask which gemstones are embedded and does not generate gemstone resonance or enchantment metadata.

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

Every generated V1 piece has:

```text
enchanted: false
enchantment: null
enchantmentValueAhn: 0
enchantmentPricingStatus: deferred
```

The later Enchantment pass can therefore increase value without rewriting mundane treasure composition.

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
