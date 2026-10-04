# Shop System v1

The Shop layer controls **availability, market markup and shared stock**. It does not rewrite an Item's intrinsic Production Value.

## Purchase price

Every bought Item starts at a fixed convenience markup:

```text
Purchase Price =
Intrinsic / Production Value
× 1.40
× Shop Type Multiplier
× Shop Tier Multiplier
× Local DM Modifier
```

The fixed `x1.40` means an Item bought from a Shop costs 40% more than the equivalent crafted value before local market modifiers.

Shop Tier multiplier is:

```text
1 + (Shop Tier - 1) × 0.04
```

The old player HUD calculation that added `+25% per Item Tier` is intentionally removed. Item Tier gates availability; it does not silently rewrite the same Item's intrinsic value.

## Sellback price

Players can sell owned Items back through a Shop.

```text
Sell Price =
Intrinsic / Production Value
× 0.80
```

The Shop therefore pays **20% below the Item's intrinsic value**. Sellback is intentionally independent from Shop Type, Shop Tier and the local purchase modifier. The legacy per-tag resale percentages and the old `+25% per Item Tier` resale calculation are deprecated.

Only the owned quantity and the Player's balance change when selling. A sale does not automatically add the Item to the Shop catalog or alter shared Shop stock.

## Shop types

| Type | Price | Stock | Role |
| --- | ---: | ---: | --- |
| General Store | x1.00 | x1.25 | Broad mixed inventory |
| Provisions | x1.00 | x1.50 | Food, supplies and common consumables |
| Clinic / Pharmacy | x1.05 | x1.00 | Medicine and recovery |
| Workshop | x1.08 | x0.85 | Tools, components and manufactured gear |
| Arms Dealer | x1.12 | x0.75 | Weapons, armor and ammunition |
| Specialist | x1.18 | x0.55 | Rare or technical goods |
| Black Market | x1.25 | x0.35 | Scarce or restricted goods |

Shop Type now controls the automatic catalog as well as market behavior. On creation, the Shop pulls compatible Items from the global Item directory up to its Shop Tier. Changing Shop Type or Shop Tier rebuilds that catalog; Items that no longer belong are removed, newly eligible Items are added, and sold units are preserved for Items that remain compatible.

The DM can still open the Shop inventory editor and remove individual compatible Items as a local exception.

## Automatic catalog by Shop Type

| Shop Type | Primary catalog | Secondary / scarce catalog |
| --- | --- | --- |
| General Store | Food, culinary staples, produce, tools, basic medical supplies | Craft components, raw chemicals/medicine, common HP/SP/status consumables |
| Provisions | Food, staples, produce, meat | Basic medical supplies, common healing, tools, medicinal raw materials |
| Clinic / Pharmacy | HP/SP/hybrid healing, status cures, medical supplies | Medicinal ingredients/processes, blood and organ materials |
| Workshop | Tools, craft components, ores/ingots/gems, raw/processed chemicals | Weapon/armor/shield/throwable components, upgrades and structural materials |
| Arms Dealer | Weapons, ammunition, weapon/firearm/ranged/armor/shield components | Throwables and combat upgrades |
| Specialist | Valuables, Essence/Core, Ooze/Gel, venom, organs and blood | Advanced processed materials, upgrades, rare ores and specialist tools |
| Black Market | Weapons/ammo, throwables, venom, blood/organs, Essence/Core, valuables | Advanced chemicals/medicine, combat components/upgrades; Tier IV+ unmatched goods may appear as rare fallback |

Primary Items receive the strongest stock relevance multiplier. Secondary Items receive less stock. Black Market fallback goods receive the lowest stock weight.

An Item must pass **both** checks to appear:

1. its family/category/tags must match the Shop Type;
2. its Item Tier must be at or below the Shop Tier.

## Shop tiers

Shops use Tier I-X.

- A Shop cannot offer an Item above its own Tier.
- Higher-tier Shops charge more because they represent more specialized markets.
- Higher-tier Shops also carry more copies of lower-tier goods because the Tier gap increases availability.

## Automatic shared stock

The DM assigns the Shop to X Players. Stock is generated from that group size and is shared by all assigned Players.

Per-player base stock:

| Shop Tier minus Item Tier | Units / Player |
| --- | ---: |
| 0 | 1 |
| 1 | 2 |
| 2-3 | 3 |
| 4+ | 4 |

Then the Shop Type stock multiplier **and the Item's catalog relevance multiplier** are applied. Primary goods are stocked more heavily than secondary goods; rare Black Market fallback goods are stocked least.

When Shop settings change, already sold units are preserved while the new maximum is recalculated. Saving the Shop inventory is an explicit restock.

## Player access

If a Shop has an assigned-player list, only those Players can see/use it from the Character Sheet / Theater surface. Legacy Shops without an assignment map remain accessible for compatibility.

## Runtime

Canonical implementation:

- `js/shop-runtime.js`
- `js/shop-item-purchase-runtime.js`
- `hoja_personaje.js`
- `pantalla_dm.html`
- `tests/shop-runtime-smoke.cjs`
