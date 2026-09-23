# Refined Metals V2 — Icons and Ahn Pricing Handoff

## Scope

This pass closes the **refined metal / processed mineral** layer before Gems.

It does **not** rebalance alloys yet.

## Pricing model

Currency remains **AHN** and quantity remains **Material Unit (MU)**.

Refined values are no longer standalone hand-authored prices. They derive from the corresponding Raw Minerals V2 value:

```text
refined Standard value = source raw Standard value × refinement multiplier
```

Pricing model:

```text
source_raw_value_x_refinement_multiplier_v2
```

Profiles:

| Profile | Multiplier | Tier |
| --- | ---: | --- |
| Basic | 1.50× | generic |
| Specialized | 1.60× | workshop |
| Advanced | 1.70× | workshop |
| Corp | 1.85× | corp_wing |
| Exotic | 2.00× | corp_wing |

## Refined metals

| Refined material | Source | Profile | Standard value |
| --- | --- | --- | ---: |
| Lead | Lead Ore | Basic | 37,500 Ahn/MU |
| Iron | Iron Ore | Basic | 45,000 |
| Aluminum | Bauxite / Aluminum Ore | Basic | 52,500 |
| Zinc | Zinc Ore | Basic | 56,250 |
| Tin | Tin Ore | Basic | 60,000 |
| Copper | Copper Ore | Basic | 67,500 |
| Manganese | Manganese Ore | Basic | 75,000 |
| Nickel | Nickel Ore | Basic | 97,500 |
| Chromium | Chromium Ore | Specialized | 124,000 |
| Lithium | Lithium Ore | Specialized | 144,000 |
| Molybdenum | Molybdenum Ore | Specialized | 160,000 |
| Vanadium | Vanadium Ore | Specialized | 172,000 |
| Cobalt | Cobalt Ore | Specialized | 184,000 |
| Silver | Silver Ore | Specialized | 240,000 |
| Tungsten | Tungsten Ore | Specialized | 264,000 |
| Titanium | Titanium Ore | Specialized | 304,000 |
| Niobium | Niobium Ore | Specialized | 344,000 |
| Gold | Gold Ore | Specialized | 360,000 |
| Tantalum | Tantalum Ore | Specialized | 376,000 |
| Platinum | Platinum Ore | Specialized | 480,000 |

Silver and Platinum intentionally share the supplied icon URL.

## Advanced processed materials

| Material | Source | Profile | Standard value |
| --- | --- | --- | ---: |
| Rare-Earth Refined Material | Rare-Earth Concentrate | Advanced | 467,500 Ahn/MU |
| Refined Uranium Material | Uranium-bearing Ore | Advanced | 595,000 |
| Superconductive Material | Superconductive Mineral | Corp | 925,000 |
| Refined Metamaterial | Metamaterial Ore | Corp | 1,156,250 |
| Null / Dampening Material | Null / Dampening Mineral | Exotic | 1,600,000 |
| Exotic Refined Material | Exotic Industrial Mineral | Exotic | 2,000,000 |

## Jewelry preparation

Silver, Gold and Platinum refined metals expose:

- `jewelry_material`
- `precious_metal`

Platinum additionally exposes `precision`.

## Validation

- 26 refined outputs
- 26 supplied icon families
- no missing refined icons
- every refined value is derived from its source raw value
- every refined value is above its source raw value
- Platinum is now canonical as both raw ore and refined metal
- combined Ore/Ingot/Gem catalog: 98 entries

## Deferred

The 16 alloy values are still the legacy table and should be rebalanced in an **Alloys V2** pass if/when that family is reopened.

## Next pass

Gems:
- rough gemstone icons / pricing
- cut gemstone icons / pricing
- jewelry-ready semantics
