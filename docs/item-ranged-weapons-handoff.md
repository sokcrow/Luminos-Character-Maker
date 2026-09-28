# Ranged Weapons V1 Handoff

## Scope

Ranged V1 closes the physical composition/economy layer for the nine classic ranged chassis already present in the compatibility catalog:

- Shortbow
- Longbow
- Hand Crossbow
- Light Crossbow
- Heavy Crossbow
- Sling
- Blowgun
- Dart
- Net

The architecture deliberately separates **launcher** from **ammunition/projectile**.

> Launcher Upgrades do not grant direct physical damage bonuses. Direct physical damage specialization comes from Ammunition / Projectile Upgrades.

This keeps bows, crossbows, slings and blowguns focused on delivery, control, stability, recovery and structural durability while the projectile owns contact geometry, physical damage specialization and compatible Status amplification.

## Component icons

Ranged component icons are embedded directly in `js/item-catalog-ranged-weapon-components.js`, matching the melee component-catalog pattern. The approved assets cover Bow Stave, Bowstring, Crossbow Stock, Crossbow Prod, Trigger/Lock, Sling Pouch, Sling Cord, Blowgun Tube, Blowgun Mouthpiece, Projectile Shaft, Projectile Head, Fletching, Net Mesh, Net Weighted Cord and Sling Bullet.

Arrow uses `Assets/Icons/items/equipment/ammo_arrow.png`. Crossbow Bolt, Blowgun Dart and the temporary Thrown Dart fallback use `Assets/Icons/items/equipment/ammo_bolt.png`. Sling Stone reuses the existing raw-stone / ore family.

## Reference launcher components

All player-facing material quantities remain positive integers.

| Component | Reference materials | DP | Process | Production Value |
| --- | --- | ---: | ---: | ---: |
| Bow Stave — Short | 2 Structural Wood | 30 | x1.20 | ₳19,000 |
| Bow Stave — Long | 3 Structural Wood | 45 | x1.20 | ₳29,000 |
| Bowstring | 1 Textile | 8 | x1.15 | ₳7,000 |
| Crossbow Stock — Small | 1 Structural Wood | 15 | x1.25 | ₳10,000 |
| Crossbow Stock — Medium | 2 Structural Wood | 30 | x1.25 | ₳20,000 |
| Crossbow Stock — Large | 3 Structural Wood | 45 | x1.25 | ₳30,000 |
| Crossbow Prod — Small | 1 structural material | 15 ref. | x1.25 | ₳10,000 ref. |
| Crossbow Prod — Medium | 2 structural material | 30 ref. | x1.25 | ₳20,000 ref. |
| Crossbow Prod — Large | 3 structural material | 45 ref. | x1.25 | ₳30,000 ref. |
| Trigger / Lock | 1 Iron | 25 | x1.50 | ₳33,000 |
| Sling Pouch | 1 Leather | 10 | x1.15 | ₳8,000 |
| Sling Cord | 1 Textile | 8 | x1.15 | ₳7,000 |
| Blowgun Tube | 2 Structural Wood | 30 | x1.20 | ₳19,000 |
| Blowgun Mouthpiece | 1 Structural Wood | 15 | x1.15 | ₳9,000 |
| Net Mesh | 2 Textile | 16 | x1.20 | ₳14,000 |
| Net Weighted Cord | 1 Textile + 1 Industrial Stone | 38 | x1.25 | ₳13,000 |

The existing melee `Grip` component is reused by bows and crossbows rather than duplicated.

Projectile Shaft / Projectile Head / Fletching and Sling Bullet exist as component/upgrade surfaces, but final ammunition Production Value is resolved at the **batch recipe** level. This preserves whole material units without pretending that one Arrow consumes an entire Material Unit.

## Reference chassis

| Chassis | Classification | Hand mode | Reference DP | Production Value |
| --- | --- | --- | ---: | ---: |
| Shortbow | Simple Ranged | 2H | 48 | ₳41,000 |
| Longbow | Martial Ranged | 2H | 63 | ₳57,000 |
| Hand Crossbow | Martial Ranged | 1H | 73 | ₳88,000 |
| Light Crossbow | Simple Ranged | 2H | 103 | ₳106,000 |
| Heavy Crossbow | Martial Ranged | 2H | 133 | ₳140,000 |
| Sling | Simple Ranged | 1H | 18 | ₳18,000 |
| Blowgun | Martial Ranged | 1H | 45 | ₳36,000 |
| Dart | Simple Ranged | 1H | 40 | ₳3,600 / unit |
| Net | Martial Ranged | 1H | 54 | ₳35,000 |

Launcher assembly multipliers follow the melee pattern: Simple x1.20, Martial x1.30. Dart uses the projectile batch recipe instead of launcher assembly economics.

## Ammunition batches

| Ammo | Whole-material batch input | Yield | Batch PV | Unit PV | Structural DP | Grade eligible |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Arrow | 1 Wood + 1 Iron + 1 Textile | 10 | ₳45,000 | ₳4,500 | 48 | Yes |
| Crossbow Bolt | 1 Wood + 1 Iron + 1 Textile | 8 | ₳45,000 | ₳5,625 | 48 | Yes |
| Blowgun Dart | 1 Wood + 1 Iron + 1 Textile | 20 | ₳43,200 | ₳2,160 | 48 | Yes |
| Thrown Dart | 1 Wood + 1 Iron | 10 | ₳36,000 | ₳3,600 | 40 | No; it is a recoverable weapon |
| Sling Bullet / Balín | 1 Iron | 10 | ₳26,400 | ₳2,640 | 25 | Yes |
| Sling Stone | found stone | 1 | — | ₳0 base | 30 ref. | No |

Arrow, Bolt, Blowgun Dart, Sling Stone and Sling Bullet are consumed on use in V1. Thrown Dart is recoverable and repairable. Net is recoverable and repairable.

## Ammo Grade

Ammo Grade is a finishing layer separate from universal Item Quality and separate from Upgrade Slots.

- Standard: +0% Ammo Power
- Precision: +5% Ammo Power
- Enhanced: +10% Ammo Power
- Masterwork: +15% Ammo Power

Ammo Grade consumes **no Upgrade Slot**. Thrown Dart uses normal Weapon Quality instead of Ammo Grade. Natural Sling Stone has no Ammo Grade.

## Upgrade capacity

Ranged upgrades reuse the canonical melee slot rule **per component**:

- material unit DP 1–19 -> 1 slot
- 20–34 -> 2 slots
- 35+ -> 3 slots
- hard cap 3

Post-construction reinforcement/weakening does not change capacity.

Reference Arrow therefore has:

- Iron Projectile Head: 2 slots
- Wood Projectile Shaft: 1 slot
- Textile Fletching: 1 slot

Natural Sling Stone is not upgradeable.

## Upgrade durability

Ranged upgrades reuse the melee bands and floor:

- ordinary: 0%
- light penalty: -10%
- strong penalty: -20%
- extreme penalty: -30% when later used
- reinforcement: +10 / +20 / +30% bands
- final component DP cannot fall below 40% of its original structural DP

The installation gate remains `Current Durability > 50% Max Durability`; exactly 50% is blocked.

## Damage and Status

Direct physical damage Upgrades are ammunition/projectile-side only in V1.

Typical projectile damage Upgrades:

- Honed Point: +10% Pierce
- Needle Point: +15% Pierce, -20% Head DP
- Broadhead: +10% Slash, -10% Head DP
- Razor Broadhead: +15% Slash, -20% Head DP
- Impact Head: +10% Blunt
- Heavy Impact Head: +15% Blunt, -20% DP, Heavy Projectile

Status rules remain identical to melee:

- no On Hit proc
- an Upgrade only modifies a matching Status already applied by the Skill
- it only modifies an axis the Skill already has
- Potency and Count are separate
- one Upgrade modifies Potency **or** Count, never both

Implemented projectile Status families cover Bleed, Rupture and Tremor.

## Launcher Upgrades

Launcher Upgrades are limited to handling / control / Clash / stability / recovery / structural reinforcement / heavy-ammo tolerance. The catalog constructor rejects direct `damagePercent` or `ammoPowerPercent` on any `scope: launcher` Upgrade.

Examples:

- Bow: Reinforced Limbs, Tuned Limbs, Heavy-Tension Tuning, Reinforced String, Precision String, Quick-Release String
- Crossbow: Reinforced/Tuned Prod, Heavy-Tension Tuning, Reinforced/Balanced/Braced Stock, Precision Trigger, Reinforced Lock, Quick-Reset Lock
- Sling: Reinforced/Balanced/Long Cord, Reinforced/Deep/Quick-Release Pouch
- Blowgun: Reinforced/Long/Precision/Tight Tube/Bore, Reinforced/Ergonomic Mouthpiece
- Net: Reinforced/Tight/Flexible Mesh, Reinforced Weighted Cord, Balanced/Quick-Release Weights

## Heavy projectile compatibility

An ammo Upgrade may add `heavy_projectile`. Without mitigation, Heavy Projectile applies a -10% Control and -10% Clash penalty through the pure Skill-context resolver.

Compatible launcher tuning mitigates `heavy_ammo_penalty` up to 10%. The launcher never receives direct damage for doing so.

## Files

- `js/item-catalog-ranged-weapon-components.js`
- `js/item-ranged-weapon-composition-engine.js`
- `js/item-catalog-ranged-weapon-upgrades.js`
- `js/item-ranged-weapon-upgrade-engine.js`
- `tests/item-ranged-weapon-composition-smoke.cjs`
- `tests/item-ranged-weapon-upgrade-smoke.cjs`
- `.github/workflows/ranged-weapon-validation.yml`

## Deferred

- direct final binding to Combat Skill runtime field names
- exact installation/removal recipes and Ahn economy for Upgrades
- detailed range-band engine
- ammunition recovery rolls for consumed ammo
- elemental/magical ammunition
- firearms
