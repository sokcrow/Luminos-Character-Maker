# AHN Economy / Salary Standard V1

Status: canonical economy reference for PR #777.

This contract exists so Item, crafting, food and Retail prices are not authored in isolation. All AHN values should be sanity-checked against the same monthly salary scale.

The AHN-to-Won relationship is a **practical calculation reference only**:

```text
1 Ahn ≈ 1 Korean Won in calculation scale
```

It is not an official currency conversion.

## Canonical monthly salary table

| Economic band | Monthly AHN | Reference population |
| --- | ---: | --- |
| Backstreets - Miseria extrema | ₳100,000–₳300,000 | Rats, indigentes, people without stable work |
| Backstreets - Muy pobre | ₳300,000–₳600,000 | Informal workers and extremely low-paid work |
| Backstreets - Clase baja | ₳600,000–₳1,000,000 | Common workers and laborers |
| Backstreets - Clase baja estable | ₳1,000,000–₳1,500,000 | Skilled workers and small workshops |
| Backstreets - Clase media | ₳1,500,000–₳2,000,000 | Technicians, merchants and low-level Fixers |
| Backstreets - Clase alta | ₳2,000,000–₳2,800,000 | Small business owners and competent Fixers |
| Nest - Clase baja | ₳2,500,000–₳3,200,000 | Modest employees able to live inside a Nest |
| Nest - Clase media | ₳3,200,000–₳4,000,000 | Relatively stable professionals/employees |
| Nest - Clase media-alta | ₳4,000,000–₳6,000,000 | Successful professionals and well-paid Fixers |
| Nest - Clase alta | ₳6,000,000–₳10,000,000 | Specialists, directors and important Fixers |
| Nest - Muy ricos | ₳10,000,000–₳25,000,000 | Wing executives, entrepreneurs and important positions |
| Élite de la Ciudad | ₳25,000,000–₳100,000,000+ | High executives, major entrepreneurs and exceptionally powerful people |

Quick references:

```text
₳500,000   = poor Backstreets
₳1,000,000 = stable Backstreets worker
₳2,000,000 = comfortable Backstreets
₳3,000,000 = modest Nest citizen
₳4,000,000 = upper-middle
₳6,000,000 = successful professional
₳10,000,000 = high class
₳25,000,000+ = elite
```

The canonical calculation anchor is:

```text
REFERENCE_MONTHLY_WAGE_AHN = ₳1,000,000
```

This is not meant to imply every citizen earns ₳1,000,000. It is the neutral denominator used to express affordability ratios.

## Food affordability bands

Food pricing is compared against a share of the ₳1,000,000 reference monthly wage.

| Food band | Share of reference monthly wage | Reference AHN |
| --- | ---: | ---: |
| Survival food | 0.1%–0.5% | ₳1,000–₳5,000 |
| Cheap meal | 0.5%–1.2% | ₳5,000–₳12,000 |
| Normal meal | 1.2%–3.0% | ₳12,000–₳30,000 |
| Good restaurant | 3.0%–10.0% | ₳30,000–₳100,000 |
| Luxury meal | 10.0%–80.0% | ₳100,000–₳800,000 |

Backstreets survival food must remain possible below a normal restaurant economy. Examples include ration blocks, cheap noodle cups, dubious stew, stale bread and recycled-protein bowls.

A normal Pizza, Burger, Ramen, Curry or Pasta should not be priced like survival food merely because its old raw ingredients were cheap.

## General Item affordability bands

The salary standard also gives rough validation ranges for non-food Items.

| Item class | Reference AHN |
| --- | ---: |
| Common raw food | ₳800–₳4,000 |
| Common protein | ₳6,000–₳18,000 |
| Specialty ingredient | ₳5,000–₳30,000 |
| Rare culinary ingredient | ₳20,000–₳200,000 |
| Common biomaterial | ₳5,000–₳80,000 |
| Industrial material | ₳10,000–₳250,000 |
| Rare / advanced material | ₳150,000–₳2,000,000 |
| Professional tool set | ₳60,000–₳500,000 |
| Simple weapon | ₳50,000–₳600,000 |
| Martial weapon | ₳250,000–₳1,500,000 |
| Armor / defensive equipment | ₳300,000–₳3,000,000 |
| Medical consumable | ₳10,000–₳6,000,000 |
| Corporate / advanced technology | ₳100,000–₳25,000,000 |

These are validation bands, not hard clamps. Exotic provenance, quality, lineage, size and corporate technology may exceed them.

## Rebased Item families in PR #777

The current catalog pass recalibrates legacy values by family rather than applying one global multiplier.

Broad intent:

- Plant / Produce: common staples and vegetables now sit around the common raw-food range; rare herbs/exotics scale upward.
- Meat: ordinary protein moves into the several-thousand to tens-of-thousands range; rare and draconic meat is materially more expensive.
- Harvest biomaterials: Hide/Pelt, Hard Parts, Scale/Shell/Chitin, Blood/Ichor, Organs, Venoms, Oozes and Fibers are rebased into useful crafting-market ranges.
- Minerals / Ingots / Alloys / Gems: industrial and advanced materials are raised so equipment Production Value is economically meaningful against monthly salaries.
- Professional Tools: tool sets are capital purchases rather than trivial pocket expenses.
- Weapons: chassis reference values are raised; component/composition systems inherit higher material values.
- Armor, Shields, Ranged Weapons and Firearms: derived Production Values inherit the rebased material/reference inputs.
- HP/SP/Hybrid/Status/Medical consumables: low-end generic medicine is no longer cheaper than normal food, while high-tier Workshop/Corp/Specialist technology reaches professional, rich or elite spending levels.

Derived systems should continue to calculate from consumed input Production Values rather than manually duplicating prices.

## Final dish Production Value

Finished dishes use salary-aware labor in addition to ingredient Production Value.

```text
Created Dish PV =
  (sum consumed input PV × Recipe Creation Multiplier)
  + Recipe Labor Value
```

Recipe Labor Value is a share of the canonical ₳1,000,000 monthly wage:

| Labor class | Share | Labor value |
| --- | ---: | ---: |
| Snack | 0.10% | ₳1,000 |
| Simple | 0.20% | ₳2,000 |
| Standard | 0.40% | ₳4,000 |
| Complex | 0.70% | ₳7,000 |
| Elaborate | 1.00% | ₳10,000 |
| Fine | 1.50% | ₳15,000 |

This prevents culinary labor from disappearing economically when ingredients are cheap.

Recipe Creation Multipliers remain moderate, generally x1.05..x1.35.

## Star quality and realized dish value

A crafted dish has a Created PV, then its execution quality changes the realized economic value:

| Stars | Value multiplier |
| --- | ---: |
| ★ | x0.70 |
| ★★ | x0.85 |
| ★★★ | x1.00 |
| ★★★★ | x1.20 |
| ★★★★★ | x1.50 |

```text
Realized Dish PV =
Created Dish PV × Star Value Multiplier
```

This makes skilled cooking create real economic value without rewriting ingredient prices.

## Retail / Restaurant reference pricing

Retail price is not permanently stored on the Item. The venue derives a reference sale price from the realized Item value.

| Venue | Multiplier |
| --- | ---: |
| Grocery / prepared packaged food | x1.20 |
| Bakery | x1.25 |
| Street stall | x1.25 |
| Deli / Food shop | x1.30 |
| Takeaway / Fast food | x1.35 |
| Specialty food shop | x1.40 |
| Diner | x1.50 |
| Standard restaurant | x1.75 |
| Good restaurant | x2.00 |
| Upscale restaurant | x2.50 |
| Fine dining | x3.00 |
| Luxury / prestige venue | x4.00 |

```text
Retail Reference Price =
Realized Dish PV × Venue Multiplier
```

Future local economy modifiers apply **after** this reference price:

```text
Local Price =
Retail Reference Price
× Availability
× Demand
× District
× Regional Supply
```

World/shop modifiers must not rewrite the canonical salary table or intrinsic Item Production Value.

## Canonical implementation

- `js/item-economy-standard.js`
- `tests/item-economy-standard-smoke.cjs`
- `js/item-cooking-recipe-catalog.js`
- `tests/item-cooking-recipe-catalog-smoke.cjs`
- `docs/item-economy-handoff.md`

## Design rule

When adding a new priced Item:

1. identify its economic family;
2. compare it to the salary-relative validation band;
3. derive crafted Items from consumed Production Values whenever possible;
4. avoid adding arbitrary Retail markup into Production Value;
5. add venue/local markup only at the sales layer.

A price is not considered balanced merely because it is internally consistent with another old price. It must also be plausible against the canonical salary/affordability standard.
