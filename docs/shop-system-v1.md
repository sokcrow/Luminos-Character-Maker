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
× Active Market Event
```

The fixed `x1.40` means an Item bought from a Shop costs 40% more than the equivalent crafted value before local market modifiers.

### Canonical intrinsic-value resolution

Shops never interpret a missing price as a free Item. The runtime resolves the first **positive** canonical economic value from the Item definition, prioritizing Production Value and derived family values before legacy fields such as `valorBase`, `costo` or `price`.

This is important because several catalog families expose their value through fields such as `standardUnitValueAhn`, `standardValueAhn`, `standardChassisValueAhn`, `mediumStandardValueAhn`, `priceAhn` or `productionValueAhn`. A placeholder `price: 0` / `costo: 0` must not shadow those authored values.

If no positive canonical value can be resolved, the Item is marked **unpriced**, receives no automatic Shop stock, is excluded from generated Shop catalogs, and purchase/sell transactions are blocked. `0 AHN` is therefore not a valid implicit Shop price.

### Generative Items and DM grants

Definitions that are templates rather than finished objects are materialized before they enter a Shop catalog. The Shop uses the Item family's existing reference resolver, stores the resulting composition/variant, and prices that same materialized Item from its resulting Production Value. The Player therefore receives the same composed object that was valued; Shops do not price a reference object and then deliver a generic zero-value template.

The DM Item directory follows the same invariant. A zero-value definition is shown as **CONFIGURAR** instead of `₳0` when the system has enough information to materialize it:

- weapon, ranged-weapon, firearm, armor and shield components use their canonical reference composition;
- Jewelry is configured from metal, quality and optional cut gems;
- processed/crafted definitions with `craftBaseMultiplier` accept the consumed-input value and derive Production Value through the existing process multiplier and quality engine;
- definitions with no value, reference resolver or economic recipe remain blocked as **SIN CONTRATO ECONÓMICO** rather than being granted as free Items.

### Loot Valuables

`Goblet`, `Chalice`, `Decorative Box`, `Statuette`, `Mask`, `Ornamental Plate`, `Reliquary` and `Scepter` are loot chassis with authored fixed-value variants. They do not wait for material composition.

The DM must choose the canonical `gold` (normal) or `gems` (Gem-Inlaid) variant before granting one. Each created instance carries that variant's `productionValueAhn`, `unitValueAhn`, `totalValueAhn` and `variantSignature`. When a Shop needs a reference for one of these chassis, the normal/gold variant is the deterministic default unless a different valuable variant is explicitly requested.

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

### Market Events

The DM can publish one global Market Event under `campaña/economia/market_event`. The event carries a title, optional player-facing message, a revision/id, and signed percentage modifiers keyed by Shop Type.

- negative percentages are discounts, e.g. `clinic: -25` → ×0.75;
- positive percentages are surcharges, e.g. `arms_dealer: 15` → ×1.15;
- `0` means that Shop Type is unaffected;
- Market Events affect **purchase prices only**;
- canonical sellback remains `Intrinsic / Production Value × 0.80`.

The Player client listens to the same event record used by Shop Runtime. When a new active revision arrives, it displays the **MERCADO** world-change HUD once for that revision. Player-facing copy is deliberately **diegetic**: it describes an in-world cause or bulletin and never attributes the change to a DM or rules system. Discounts render their signed percentage in green and surcharges in red. The HUD is informational; the amount actually charged is calculated by the same Runtime event multiplier.

Only the owned quantity and the Player's balance change when selling. A sale does not automatically add the Item to the Shop catalog or alter shared Shop stock.

## Shop types

Shop Type represents the **kind of commerce / provider**, not merely a generic inventory bucket. Legacy IDs remain valid, while modern urban commerce adds retail, wholesale, technical, resale and automated channels.

| Type | Price | Stock | Role |
| --- | ---: | ---: | --- |
| General Store | x1.00 | x1.25 | Broad mixed inventory |
| Convenience Store | x1.08 | x0.95 | Immediate-use food, medicine and small supplies |
| Supermarket | x0.96 | x1.80 | High-volume food and household basics |
| Distributor / Wholesaler | x0.90 | x2.20 | Bulk supply for stores, workshops and organizations |
| Provisions | x1.00 | x1.50 | Food, supplies and common consumables |
| Restaurant / Canteen | x1.18 | x0.80 | Prepared food and culinary goods |
| Butcher | x1.03 | x1.20 | Meat and biological food by-products |
| Clinic | x1.05 | x1.00 | Treatment and immediate medical supplies |
| Pharmacy | x1.08 | x1.15 | Medicine, cures and pharmaceutical stock |
| Workshop | x1.08 | x0.85 | Fabrication, components and manufactured gear |
| Hardware / Supplies | x1.02 | x1.25 | Tools, structural parts and industrial consumables |
| Electronics / Technology | x1.15 | x0.70 | Circuits, sensors, optics and precision parts |
| Arms Dealer | x1.12 | x0.75 | Weapons, armor and ammunition |
| Jeweler | x1.18 | x0.60 | Jewelry, gems, refined metals and valuables |
| Pawnshop | x0.95 | x0.70 | Used tools, equipment, weapons and valuables |
| Salvage / Recovery | x0.88 | x1.10 | Recovered materials and second-hand components |
| Corporate Outlet | x1.10 | x0.90 | Branded technical and high-precision goods |
| Automated Vendor | x1.12 | x0.65 | Immediate consumables through automated retail |
| Specialist | x1.18 | x0.55 | Rare or technical niche goods |
| Black Market | x1.25 | x0.35 | Scarce or restricted goods |

The DM Shop form and Market Event form are generated from `SHOP_TYPES`, so adding a Runtime type automatically exposes it in both controls instead of requiring a second hard-coded UI list.

Shop Type controls the automatic catalog as well as market behavior. Changing Shop Type or Shop Tier rebuilds the catalog; incompatible Items are removed, newly eligible Items are added, and sold units are preserved for compatible Items that remain.

The DM can still open the Shop inventory editor and remove individual compatible Items as a local exception.

## Automatic catalog by Shop Type

| Shop Type | Primary catalog | Secondary / scarce catalog |
| --- | --- | --- |
| General Store | Food, staples, produce, tools, basic medical | Craft components, raw chemistry/medicine, common recovery |
| Convenience | Retail food, basic food, immediate medicine | Small tools, staples, ammo |
| Supermarket | Retail food, staples, produce, meat | Basic medical, tools, containers/household supply |
| Distributor / Wholesaler | Food, materials, medical and chemical raw stock | Tools, processed materials, ores |
| Provisions | Food, staples, produce, meat | Medical basics, healing, tools |
| Restaurant / Canteen | Prepared food and culinary stock | Containers / serving supply |
| Butcher | Meat, raw meat, hides | Organs, blood, staples |
| Clinic | Recovery, cures, medical supplies | Medicinal materials, blood/organs |
| Pharmacy | Recovery, cures, processed medicine | Medicinal raw stock and pharmaceutical inputs |
| Workshop | Tools, craft components, ores, chemicals | Combat components, upgrades, structural materials |
| Hardware / Supplies | Tools, fasteners, structural and mechanical parts | Ores, components, industrial chemicals |
| Electronics / Technology | Electronics, circuitry, sensors, optics, precision | Craft components, technical chemicals, corporate precision |
| Arms Dealer | Weapons, ammunition, combat components | Throwables and combat upgrades |
| Jeweler | Jewelry, valuables, cut gems | Refined metals, alloys, mineral stock |
| Pawnshop | Valuables, tools, used weapons/equipment | Minerals and miscellaneous medical stock |
| Salvage / Recovery | Recovered materials, ores, biological materials | Combat components and raw chemistry |
| Corporate Outlet | Corporate/precision technical goods | Advanced components, upgrades and processed materials |
| Automated Vendor | Retail food, immediate recovery, medical, ammo | Cures and compact tools |
| Specialist | Valuables, Essence/Core, Ooze/Gel, venom, organs, blood | Advanced processed materials, upgrades, rare ores |
| Black Market | Weapons/ammo, throwables, biological/exotic valuables | Advanced medicine/chemicals and combat upgrades; Tier IV+ fallback |

Primary Items receive the strongest stock relevance multiplier. Secondary Items receive less stock. Black Market fallback goods receive the lowest stock weight.

An Item must pass **both** checks to appear:

1. its family/category/tags/form must match the Shop Type;
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

## Services

Shops can expose services independently from their product catalog. Service availability has Shop Type defaults but the DM may enable or disable a service on an individual Shop.

### Repair

Repair restores missing Durability / Condition and is priced from the material actually used by the Item rather than from the finished Item's resale value.

```text
Material Value per PD =
Material Unit Value / Material Durability

Repair List Price =
PD restored
× Material Value per PD
× 1.40
```

The `x1.40` is the service labor/convenience margin. It is not multiplied by the normal Shop purchase markup a second time.

For composed weapons, armor and shields, Shop Runtime walks the canonical composition and prefers the primary material. Material rows already authored by the equipment catalogs expose their unit value and durability, so a finished Item can be quoted without inventing a separate arbitrary repair tariff. Explicit `repairMaterialValuePerPointAhn` data remains supported for content that needs a fixed per-PD contract.

Repair uses the same commerce benefits as product purchases. Eligible promotions, merchant benefits and service-scoped loyalty can reduce the list price, including a free loyalty redemption. The Player transaction revalidates the current Item, balance and quote before restoring its canonical Condition/Durability.

## Merchant NPCs

A Shop may be managed by an NPC. The commerce record can carry:

- display name;
- sprite / portrait;
- optional in-world greeting;
- frequent-customer purchase threshold and discount;
- relationship-tier discounts;
- merchant-specific promotions.

The Player surfaces present the merchant as part of the Shop rather than exposing internal IDs or rule payloads.

Frequent-customer progress is native to the Shop commerce history and advances through completed purchases. Relationship discounts consume an existing relationship tier if another game system provides one; Shop Runtime does not invent or advance friendship state on its own.

## Chains and loyalty

A Shop may identify a chain / franchise. Chain metadata can provide shared promotion and loyalty definitions to that Shop.

Player commerce state is keyed by stable loyalty-program IDs, so branches configured with the same chain/program ID can use the same Player progress. The current implementation does **not** maintain a separate global chain registry that automatically propagates an edit to every branch; each Shop persists the chain configuration it was authored with.

A loyalty program defines how many paid eligible transactions fill the card and whether it applies to products, services or both. The default reward is the next eligible transaction for free.

Example:

```text
9 paid eligible transactions
→ card reaches 9 / 9
→ next eligible transaction is free
→ progress resets to 0
```

A legitimate loyalty reward may therefore resolve to `0 AHN` while still having a valid canonical economic value. This is distinct from an unpriced Item, which remains blocked.

## Promotions

The DM Shop editor supports product-facing promotion authoring:

- percentage discount on the whole Shop or a selected product;
- **Buy X, get Y**;
- gift Item after buying a selected product.

Promotion labels are shown to Players in readable world-facing copy. Internal Item IDs remain implementation data.

Free reward Items use the same canonical purchase payload as paid Items. Their Shop stock is reserved before the purchase completes. If the required reward stock is unavailable, the promotion transaction is blocked instead of silently charging the Player and omitting the advertised reward.

Delivery follows the purchase surface:

- physical Shop / Theater → Player Stash;
- App / remote Shop → pending delivery using that Shop's delivery delay.

Discount promotions modify the live checkout price. Gift promotions do not rewrite the intrinsic value of either Item.

## Restaurants

`restaurant` remains a normal Shop Type using the common Shop Runtime; it is not a parallel economy.

Its generated catalog comes from prepared food / culinary families, while NPC identity, greetings, loyalty and promotions provide the authored personality. Player-facing physical and Theater surfaces present restaurant inventory as a **MENU** so food establishments read as places rather than generic item terminals.

## Runtime

Canonical implementation:

- `js/shop-runtime.js`
- `js/shop-item-purchase-runtime.js`
- `hoja_personaje.js`
- `pantalla_dm.html`
- `tests/shop-runtime-smoke.cjs`
