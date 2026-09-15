# Weapon Item System Handoff

This document records the approved Weapon-as-Item contract integrated in `js/item-catalog-weapons.js` and the work intentionally left for later item passes.

## Scope

Weapons are currently integrated strictly as **Items / Equipment**. Combat Arts, weapon-learning systems and other combat-progression concepts are outside this item pass.

The initial canonical catalog contains **37 base weapon chassis**. Prices in this catalog are **chassis reference prices only**. Material premiums, future Upgrades and other modifications are separate value layers and must not be silently baked into the chassis table.

## Weapon Quality profile

Weapons intentionally use a weapon-specific Quality profile rather than applying the universal Item effect multiplier directly to weapon damage.

| Quality | Weapon Damage | Durability cycle | Chassis value | State rule |
| --- | ---: | ---: | ---: | --- |
| Ruined | ×0.60 | ×0.50 | ×0.20 | Counts as Improvised; destroyed when Durability reaches 0 |
| Poor | ×0.80 | ×0.75 | ×0.55 | Drops to Ruined at 0 Durability |
| Standard | ×1.00 | ×1.00 | ×1.00 | Drops to Poor at 0 Durability |
| Fine | ×1.20 | ×1.25 | ×1.65 | Drops to Standard at 0 Durability |
| Exceptional | ×1.40 | ×1.50 | ×2.50 | Drops to Fine at 0 Durability |

The Quality progression is therefore:

`Exceptional → Fine → Standard → Poor → Ruined → Destroyed`

A normal repair restores the current Durability bar **without restoring lost Quality**.

## Durability contract

Each weapon chassis has its own `baseDurability`. This establishes that a Dagger, Longsword, Maul, Bow and Crossbow do not share one universal durability bar.

The approved model is:

`Max Durability = Weapon Base Durability × Material Durability Modifier × Quality Durability Multiplier`

The **Material Durability Modifier table is intentionally pending**. Wood, iron, steel and other materials must not receive invented durability modifiers until that material pass is approved.

When current Durability reaches 0:

1. Exceptional becomes Fine.
2. Fine becomes Standard.
3. Standard becomes Poor.
4. Poor becomes Ruined.
5. Ruined is treated as Improvised and is destroyed the next time its Durability reaches 0.

After a Quality drop, the item receives the Durability bar appropriate to its new Quality.

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
- approved Quality damage/value multipliers;
- chassis prices;
- base durability and Quality-cycle calculations;
- repair behavior;
- Ruined/improvised destruction behavior;
- semantic recipe profiles;
- hand costs;
- weapon icon-family assignments.

`tests/item-icon-registry-smoke.cjs` validates the 20 specific Weapon icon families and registry aliases.

`Inventory Runtime Validation` includes syntax and smoke validation for the Weapon catalog.

## Intentionally pending Weapon-item work

1. Approve the **Material Durability Modifier table** and bind material lineage to `maxDurability()`.
2. Design **Weapon Upgrades** as a separate approved item layer: compatibility, effects, value, Recipe, Tool/TH and upgrade-capacity rules.
3. Define the **Firearm chassis catalog** separately. Firearm icon families are ready, but prices/Recipes/chassis are not yet approved. Luminous does not use a Heavy Firearm family/high-caliber category for this pass.
4. Define **Ammo** catalogs and economic rules for ranged weapons/firearms where required.
5. Define the **repair / reconditioning economy**, including the distinction between restoring Durability and restoring lost Quality.
6. Bind exact material quantities only when the material-conservation/economy pass is ready.
7. Add material and Upgrade value layers on top of chassis price without overwriting the chassis reference table.

## Standing workflow rule

New item families or material-system changes are proposed in full first, approved by the user, and then added to canonical Items PR #777.
