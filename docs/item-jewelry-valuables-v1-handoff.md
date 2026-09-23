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

## 18 Jewelry chassis

- Plain Band
- Ring
- Signet Ring
- Earrings
- Pendant
- Medallion
- Necklace
- Choker
- Bracelet
- Bangle
- Cuff Bracelet
- Anklet
- Brooch
- Cufflinks
- Ornamental Hairpin
- Circlet
- Tiara
- Crown

Jewelry uses the existing `accessory` icon family and is inventory equipment kind `accessory`.

## 8 Valuable-object chassis

- Ornamental Goblet
- Ornamental Chalice
- Decorative Box
- Decorative Statuette
- Ceremonial Mask
- Ornamental Plate
- Reliquary
- Ornamental Scepter

Valuables use the existing `valuable` icon family.

## Editable material variants

Any normal refined metal or alloy can be selected as the chassis metal.

Examples:

- Copper Ring
- Silver Bracelet
- Gold Necklace
- Platinum Tiara
- Bronze Brooch
- Titanium Circlet

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

Each chassis has a practical maximum gemstone count. Large chassis such as Necklace, Tiara and Crown support substantially more gemstones than Rings.

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

- 18 Jewelry chassis
- 8 Valuable chassis
- 26 total generative chassis
- unique/non-stackable jewelry
- refined metal/alloy validation
- Cut Gem validation
- per-chassis gem capacity
- mixed/repeated gem quantities
- resonance aggregation
- universal Quality value application
- AHN economy smoke coverage
