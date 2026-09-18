# Weapon Item System Handoff

This document records the approved Weapon-as-Item contract integrated in `js/item-catalog-weapons.js` and the work intentionally left for later item passes.

## Scope

Weapons are currently integrated strictly as **Items / Equipment**. Combat Arts, weapon-learning systems and other combat-progression concepts are outside this item pass.

The initial canonical catalog contains **37 base weapon chassis**. Prices in this catalog are **chassis reference prices only**. Material premiums, future Upgrades and other modifications are separate value layers and must not be silently baked into the chassis table.

## Weapon Quality profile

Weapon Quality is workmanship / functional condition:

`Ruined < Poor < Standard < Fine < Exceptional`

Quality may change value and follows the normal degradation lifecycle, but it does **not** multiply Weapon Damage and it does **not** multiply structural Max Durability. Those two legacy performance multipliers were removed after the component-composition pass made Material + Components + physical Upgrades authoritative.

The Quality progression remains:

`Exceptional → Fine → Standard → Poor → Ruined → Destroyed`

A normal repair restores the current structural Durability bar **without restoring lost Quality**.

## Durability contract

The compatibility chassis catalog retains `baseDurability` as a reference field, while canonical composed Weapons derive structural Durability from incorporated material Components.

For the compatibility helper:

`Max Durability = Weapon Base Durability × Material Durability Modifier`

Quality is not part of this equation.

For canonical composed Weapons:

`Max Durability = sum(incorporated material/component Durability)`

When current Durability reaches 0:

1. Exceptional becomes Fine.
2. Fine becomes Standard.
3. Standard becomes Poor.
4. Poor becomes Ruined.
5. Ruined is destroyed the next time its Durability reaches 0.

After a non-terminal Quality drop, the same structural Durability bar refills; Quality does not create or remove material structure.

## Universal Enhancement namespace

Mundane Weapons have no `-3..+3` Weapon Grade and no numeric mundane enhancement bonus. They are Enhancement 0.

The shared equipment contract in `js/item-equipment-enhancement-contract.js` reserves only `+1/+2/+3` for future Enchantments across Weapons, Armor and Shields. Negative enhancement levels are invalid.

## Equipment compatibility

Weapon definitions expose `category: "weapon"`, `handCost` and `equipment.handCost` so they remain compatible with `js/item-equipment-bridge.js`.

- one-handed chassis use `handCost: 1`;
- two-handed chassis use `handCost: 2`;
- the existing Equipment Bridge occupies both hand slots for a two-handed weapon.

## Chassis prices

These are Standard-Quality **chassis reference prices** in Ahn.

| Weapon | Standard chassis |
| --- | ---: |
| Club | ₳12,000 |
| Dagger | ₳35,000 |
| Greatclub | ₳22,000 |
| Handaxe | ₳50,000 |
| Javelin | ₳32,000 |
| Light Hammer | ₳40,000 |
| Mace | ₳55,000 |
| Quarterstaff | ₳18,000 |
| Sickle | ₳32,000 |
| Spear | ₳45,000 |
| Light Crossbow | ₳140,000 |
| Dart | ₳12,000 |
| Shortbow | ₳85,000 |
| Sling | ₳15,000 |
| Battleaxe | ₳95,000 |
| Flail | ₳110,000 |
| Glaive | ₳135,000 |
| Greataxe | ₳145,000 |
| Greatsword | ₳160,000 |
| Halberd | ₳145,000 |
| Lance | ₳130,000 |
| Longsword | ₳100,000 |
| Maul | ₳125,000 |
| Morningstar | ₳90,000 |
| Pike | ₳110,000 |
| Rapier | ₳120,000 |
| Scimitar | ₳90,000 |
| Shortsword | ₳80,000 |
| Trident | ₳100,000 |
| War Pick | ₳85,000 |
| Warhammer | ₳95,000 |
| Whip | ₳60,000 |
| Blowgun | ₳45,000 |
| Hand Crossbow | ₳180,000 |
| Heavy Crossbow | ₳240,000 |
| Longbow | ₳130,000 |
| Net | ₳35,000 |

`LuminousWeaponCatalog.chassisValueForQuality()` applies the approved Weapon Quality value multiplier to these chassis references.

## Craft Recipe contract

Weapon Recipes are currently stored as **semantic game Recipes** rather than real-world construction instructions.

Each Recipe declares:

- a Recipe profile;
- semantic input/component tags;
- required Tool type;
- semantic Craft Check;
- TH18 or TH22 for the current base catalog;
- assembly multiplier;
- Tool is reusable and not consumed;
- plausible improvisation uses TH +3;
- output Quality comes from the Craft Check.

The recipes preserve the approved item-production direction:

`Raw → Refined → Processed → Component → Weapon`

Exact material quantities are explicitly marked `deferred_material_binding` and remain a later game-economy/conservation pass.

## Weapon icon families

`js/item-icon-registry.js` VERSION 15 contains 20 specific Weapon icon families in addition to the existing `weapon_melee` / `weapon_ranged` fallbacks.

| Icon family | Asset |
| --- | --- |
| `weapon_sword` | https://imgur.com/3AEGrWu.png |
| `weapon_dagger` | https://imgur.com/K3d5UEA.png |
| `weapon_polearm` | https://imgur.com/WWODflC.png |
| `weapon_hammer` | https://imgur.com/WwAq8r.png |
| `weapon_firearm_shotgun` | https://imgur.com/46tMIlQ.png |
| `weapon_sling` | https://imgur.com/hmPPD07.png |
| `weapon_firearm_pistol` | https://imgur.com/gJJgmqX.png |
| `weapon_net` | https://imgur.com/T3u9Z3N.png |
| `weapon_firearm_revolver` | https://imgur.com/GCEeR8H.png |
| `weapon_firearm_smg` | https://imgur.com/L5FQuTA.png |
| `weapon_spear` | https://imgur.com/DUGcpP5.png |
| `weapon_crossbow` | https://imgur.com/83PWc1r.png |
| `weapon_pick` | https://imgur.com/dTwA4cO.png |
| `weapon_whip` | https://imgur.com/Nw8Mdnp.png |
| `weapon_blunt` | https://imgur.com/XElPYSo.png |
| `weapon_blowgun` | https://imgur.com/qkKi2DL.png |
| `weapon_firearm_rifle` | https://imgur.com/aXXrcFQ.png |
| `weapon_staff` | https://imgur.com/AChSLCZ.png |
| `weapon_axe` | https://imgur.com/Fp9MJRw.png |
| `weapon_bow` | https://imgur.com/PWnWMq1.png |

The firearm icon families are visual infrastructure only in this pass. A firearm chassis catalog has **not** been silently created.

There is no Heavy Firearm visual family. Energy-based weapons do not receive redundant energy-specific visual families; their physical form can reuse the appropriate weapon family while technology is represented by item data/components.

## Validation

`tests/item-catalog-weapons-smoke.cjs` validates:

- exactly 37 unique base chassis;
- Quality value/lifecycle semantics with no Damage or Durability multiplier;
- chassis prices;
- structural/reference durability and Quality-cycle calculations;
- repair behavior;
- Ruined/improvised destruction behavior;
- semantic recipe profiles;
- hand costs;
- weapon icon-family assignments.

`tests/item-icon-registry-smoke.cjs` validates the 20 specific Weapon icon families and registry aliases.

`Inventory Runtime Validation` includes syntax and smoke validation for the Weapon catalog.

## Intentionally pending Weapon-item work

1. Complete the remaining legacy compatibility cutover from chassis reference durability to the canonical component/material composition where old callers still use the chassis catalog directly.
2. Define the **repair / reconditioning economy**, including the distinction between restoring Durability and restoring lost Quality.
3. Define Enchantment effects on top of the already-reserved universal +1/+2/+3 Enhancement namespace.
4. Continue using the dedicated Ranged, Ammo and Firearm modules for those families rather than extending legacy chassis-only rules.

## Standing workflow rule

New item families or material-system changes are proposed in full first, approved by the user, and then added to canonical Items PR #777.
