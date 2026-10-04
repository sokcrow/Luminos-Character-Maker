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

The DM still chooses which Items a Shop carries. The type changes the market behavior, not the canonical Item catalog.

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

Then the Shop Type stock multiplier is applied.

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
