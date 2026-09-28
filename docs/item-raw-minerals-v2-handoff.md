# Raw Minerals V2 — Icons and Ahn Pricing Handoff

## Scope

This pass closes the **raw mineral** layer before refined metals / ingots are retouched.

It does not change refined-metal or alloy icons yet.

## Currency and pricing

Currency remains **Ahn (AHN)**.

The mineral catalog keeps its existing economy conversion:

```js
AHN_ECONOMY_SCALE = 2.5
```

Raw Minerals V2 uses:

```text
ahn_material_unit_tiered_v2
```

Values below are the final Standard-quality value per Material Unit (MU), after the catalog's Ahn scale.

| Raw mineral | Icon family | Standard value |
| --- | --- | ---: |
| Industrial Stone | mineral_industrial_stone | 10,000 Ahn/MU |
| Clay | mineral_clay | 12,500 |
| Coal | mineral_coal | 17,500 |
| Lead Ore | ore_lead | 25,000 |
| Iron Ore | ore_iron | 30,000 |
| Bauxite / Aluminum Ore | ore_bauxite | 35,000 |
| Zinc Ore | ore_zinc | 37,500 |
| Tin Ore | ore_tin | 40,000 |
| Copper Ore | ore_copper | 45,000 |
| Graphite / Carbon Mineral | mineral_graphite | 47,500 |
| Manganese Ore | ore_manganese | 50,000 |
| Obsidian | mineral_obsidian | 55,000 |
| Quartz | mineral_quartz | 60,000 |
| Nickel Ore | ore_nickel | 65,000 |
| Chromium Ore | ore_chromium | 77,500 |
| Lithium Ore | ore_lithium | 90,000 |
| Molybdenum Ore | ore_molybdenum | 100,000 |
| Vanadium Ore | ore_vanadium | 107,500 |
| Cobalt Ore | ore_cobalt | 115,000 |
| Silver Ore | ore_silver | 150,000 |
| Tungsten Ore | ore_tungsten | 165,000 |
| Titanium Ore | ore_titanium | 190,000 |
| Niobium Ore | ore_niobium | 215,000 |
| Gold Ore | ore_gold | 225,000 |
| Tantalum Ore | ore_tantalum | 235,000 |
| Rare-Earth Concentrate | mineral_rare_earth | 275,000 |
| Platinum Ore | ore_platinum | 300,000 |
| Uranium-bearing Ore | ore_uranium | 350,000 |
| Superconductive Mineral | mineral_superconductive | 500,000 |
| Metamaterial Ore | ore_metamaterial | 625,000 |
| Null / Dampening Mineral | mineral_null_dampening | 800,000 |
| Exotic Industrial Mineral | mineral_exotic_industrial | 1,000,000 |

Quality remains universal; the Item Quality engine modifies these Standard values normally.

## Platinum

`platinum_ore` is now a canonical raw mineral.

It exposes:

- `jewelry_material`
- `precious_metal`
- `precision`
- `electronics`

Its refined `platinum` form is intentionally deferred to the next **Refined Metals / Ingots** pass.

## Jewelry preparation

Silver and Gold raw materials now explicitly expose `jewelry_material`; Gold also exposes `precious_metal`.

Platinum starts with both tags.

## Validation

- 32 raw minerals
- 32 dedicated raw-mineral icon families
- no missing icon families
- every existing metal-bearing raw mineral remains cheaper than its current refined counterpart
- 97 total entries in the combined Ore/Ingot/Gem catalog before refined Platinum is added

## Next pass

Refined Metals / Ingots V2:

- dedicated ingot/refined icons
- add refined Platinum
- retune refined-metal Ahn values against Raw Minerals V2
- then proceed to Alloys and Gems
