# Weapon Components + Composition — Canonical V1

This document is the authoritative handoff for the melee Weapon composition layer. It supersedes the old idea that melee Weapon durability is primarily derived from a chassis Base Durability multiplied by Material/Quality modifiers.

## Scope

Implemented:
- 23 visible/craftable melee Weapon Component definitions.
- 18 approved Weapon Component icon families/URLs embedded on component Items.
- 28 canonical melee chassis recipes expressed as integer component quantities.
- Freeform/custom melee assembly when physical component connections are valid.
- Primary Component → primary material identity.
- Composition-derived structural Durability.
- Component-derived Production Value.
- Craft-result Quality adjustment.
- One-handed / Versatile / Two-handed resolution from components.
- Skill-use Durability loss.
- Durability Quality cycling.
- >50% Durability requirement hook for future Upgrades.
- Improvised Damage helper at 60%.

Deferred:
- Weapon Upgrade catalog and component upgrade capacity.
- Full material elemental-wear matrix.
- Repair/Reconditioning/Reforge costs and recipes.
- Ranged weapon component pass.
- Firearm component/chassis pass.
- Arrow/ammo catalog beyond the non-repairable contract.

## Canonical rule: integer material and component quantities

Recipes do not use arbitrary decimal material quantities.

Examples:
- `Short Blade = 1 solid structural material`
- `Long Blade = 2 solid structural materials`
- `Great Blade = 3 solid structural materials`
- `Handle = 1 structural material`
- `Shaft = 2 structural materials`
- `Long Shaft = 3 structural materials`
- `Grip = 1 flexible material`

Intermediate Components preserve their material lineage. A finished Weapon counts incorporated material once; Components do not create extra Durability from nothing.

## Primary Component

The chassis declares a Primary Component, not a hard-coded material.

Examples:
- Dagger → Short Blade
- Longsword → Long Blade
- Greatsword → Great Blade
- Handaxe → Axe Head
- Spear → Spear Head
- Halberd → Polearm Head
- Whip → Lash
- Quarterstaff → Long Shaft / body structure

The material installed in the Primary Component becomes the nominal material of the finished Weapon. This allows constructions such as Wooden Longsword, Iron Bow/shaft-style structures in future compatible ranged recipes, Bone Dagger, Chitin Spear, etc., provided the material satisfies the component's compatibility tags.

## Material compatibility

Components request physical tags rather than enumerating every accepted material.

Current core tags:
- `solid`
- `structural`
- `flexible`
- `fiber`
- `linkable`
- `metal`

This intentionally permits unusual but physically coherent builds while rejecting nonsensical ones.

## Structural Durability

Quality does not multiply structural Durability.

`Max Durability = sum(incorporated material Durability)`

Current V1 material anchors include:
- Fiber/Textile 8
- Leather 10
- Structural Wood 15
- Bone/Horn 18
- Chitin 20
- Shell 25
- Industrial Stone 30
- Iron 25
- Carbon Steel 30
- Hardened Steel 42
- Titanium 45
- Titanium Alloy 53
- Advanced Titanium Alloy 60
- Superalloy 68
- Augment-Grade Alloy 75
- Corp Composite Alloy 88
- Exotic Alloy 100

The full V1 map lives in `js/item-catalog-weapon-components.js`.

## Production Value

Production Value is distinct from local Market Price.

A component derives Production Value from consumed material value × its process multiplier. The finished Weapon derives Production Value from consumed component Production Values × its assembly multiplier.

Reference material values used for the current Standard calibration:
- Structural Wood ₳8,000
- Leather ₳7,000
- Textile ₳6,000
- Iron ₳22,000

Reference process examples:
- forged weapon part ×1.30
- shaped structural part ×1.20
- reinforced handle ×1.25
- chain work ×1.35
- grip/lash work ×1.15
- simple Weapon assembly ×1.20
- martial Weapon assembly ×1.30

This is Production Value, not city/shop retail pricing. The Market system may later apply local supply, demand, scarcity, taxation, faction control, etc.

## Canonical melee component catalog

| Component | Reference material recipe | Reference DP | Reference Production Value |
| --- | --- | ---: | ---: |
| Short Blade | 1 Iron | 25 | ₳29,000 |
| Long Blade | 2 Iron | 50 | ₳57,000 |
| Great Blade | 3 Iron | 75 | ₳86,000 |
| Axe Head — Small | 1 Iron | 25 | ₳29,000 |
| Axe Head — Medium | 2 Iron | 50 | ₳57,000 |
| Axe Head — Large | 3 Iron | 75 | ₳86,000 |
| Hammer Head — Small | 1 Iron | 25 | ₳29,000 |
| Hammer Head — Medium | 2 Iron | 50 | ₳57,000 |
| Hammer Head — Large | 3 Iron | 75 | ₳86,000 |
| Mace Head | 2 Iron | 50 | ₳57,000 |
| Spear Head | 1 Iron | 25 | ₳29,000 |
| Polearm Head | 2 Iron | 50 | ₳57,000 |
| Pick Head | 1 Iron | 25 | ₳29,000 |
| Flail Head | 1 Iron | 25 | ₳29,000 |
| Chain Link Assembly | 1 Iron | 25 | ₳30,000 |
| Handle | 1 Structural Wood | 15 | ₳10,000 |
| Reinforced Handle | 1 Structural Wood + 1 Leather | 25 | ₳19,000 |
| Shaft | 2 Structural Wood | 30 | ₳19,000 |
| Long Shaft | 3 Structural Wood | 45 | ₳29,000 |
| Club Body — Medium | 2 Structural Wood | 30 | ₳19,000 |
| Club Body — Large | 3 Structural Wood | 45 | ₳29,000 |
| Grip | 1 Leather | 10 | ₳8,000 |
| Lash | 2 Leather | 20 | ₳16,000 |

## Approved component icons

- Short Blade — https://imgur.com/VqcSTYZ.png
- Long Blade — https://imgur.com/Dy9oMIw.png
- Great Blade — https://imgur.com/YZcd7xb.png
- Axe Head — https://imgur.com/n1ywyev.png
- Hammer Head — https://imgur.com/gaGJyHT.png
- Mace Head — https://imgur.com/tUEsPpJ.png
- Spear Head — https://imgur.com/6ievQXp.png
- Polearm Head — https://imgur.com/GPg1tgF.png
- Pick Head — https://imgur.com/nUJ7c4s.png
- Flail Head — https://imgur.com/zsb8ZB6.png
- Chain Link — https://imgur.com/gmYk0N8.png
- Handle — https://imgur.com/uP3M6zY.png
- Reinforced Handle — https://imgur.com/qfDfQAU.png
- Shaft — https://imgur.com/FXZYH92.png
- Long Shaft — https://imgur.com/NZMcC9c.png
- Club Body — https://imgur.com/ICgzPQ2.png
- Grip — https://imgur.com/5vSVRcm.png
- Lash — https://imgur.com/fpYkdIH.png

## Canonical melee chassis reference builds

Reference builds use Iron for forged primary parts, Structural Wood for supports and Leather for flexible parts.

| Chassis | Primary | Components | DP | Production Value | Hand mode |
| --- | --- | --- | ---: | ---: | --- |
| Club | Club Body — Medium | Body + Grip | 40 | ₳32,000 | 1H |
| Dagger | Short Blade | Blade + Handle | 40 | ₳47,000 | 1H |
| Greatclub | Club Body — Large | Body + Grip | 55 | ₳44,000 | 2H |
| Handaxe | Axe Head — Small | Head + Handle | 40 | ₳47,000 | 1H |
| Javelin | Spear Head | Head + Shaft | 55 | ₳58,000 | Versatile |
| Light Hammer | Hammer Head — Small | Head + Handle | 40 | ₳47,000 | 1H |
| Mace | Mace Head | Head + Handle | 65 | ₳80,000 | 1H |
| Quarterstaff | Long Shaft | Long Shaft + Grip | 55 | ₳44,000 | 2H |
| Sickle | Short Blade | Blade + Handle | 40 | ₳47,000 | 1H |
| Spear | Spear Head | Head + Shaft | 55 | ₳58,000 | Versatile |
| Battleaxe | Axe Head — Medium | Head + Reinforced Handle + Grip | 85 | ₳109,000 | Versatile |
| Flail | Flail Head | Head + Chain + Handle + Grip | 75 | ₳100,000 | 1H |
| Glaive | Polearm Head | Head + Long Shaft + Grip | 105 | ₳122,000 | 2H |
| Greataxe | Axe Head — Large | Head + Reinforced Handle + Grip | 110 | ₳147,000 | 2H |
| Greatsword | Great Blade | Blade + Reinforced Handle + Grip | 110 | ₳147,000 | 2H |
| Halberd | Polearm Head | Head + Long Shaft + Grip | 105 | ₳122,000 | 2H |
| Lance | Spear Head | Head + Long Shaft + Grip | 80 | ₳86,000 | 2H |
| Longsword | Long Blade | Blade + Reinforced Handle + Grip | 85 | ₳109,000 | Versatile |
| Maul | Hammer Head — Large | Head + Reinforced Handle + Grip | 110 | ₳147,000 | 2H |
| Morningstar | Mace Head | Head + Reinforced Handle + Grip | 85 | ₳109,000 | Versatile |
| Pike | Spear Head | Head + Long Shaft + Grip | 80 | ₳86,000 | 2H |
| Rapier | Long Blade | Blade + Handle + Grip | 75 | ₳98,000 | 1H |
| Scimitar | Long Blade | Blade + Handle + Grip | 75 | ₳98,000 | 1H |
| Shortsword | Long Blade | Blade + Handle | 65 | ₳87,000 | 1H |
| Trident | Polearm Head | Head + Shaft + Grip | 90 | ₳109,000 | 2H because Polearm Head requires 2 |
| War Pick | Pick Head | Head + Reinforced Handle + Grip | 60 | ₳73,000 | Versatile |
| Warhammer | Hammer Head — Medium | Head + Reinforced Handle + Grip | 85 | ₳109,000 | Versatile |
| Whip | Lash | Lash + Handle + Grip | 45 | ₳44,000 | 1H |

## Hand resolution

Hand use is resolved from components, not by asking the chassis after assembly.

- Handle allows only 1H.
- Reinforced Handle allows 1H or 2H.
- Shaft allows 1H or 2H.
- Long Shaft requires 2H.
- Great/Large offensive components require 2H.
- Polearm Head requires 2H.
- Other small/medium heads normally require at least 1H.

If any component's requirements conflict with the support, assembly is invalid.

Examples:
- Short Blade + Handle → 1H.
- Long Blade + Reinforced Handle → Versatile.
- Great Blade + Reinforced Handle → 2H.
- Axe Head + Long Shaft → 2H.
- Great Blade + Long Shaft → valid custom 2H polearm-like weapon.
- Great Blade + Handle → invalid.

## Custom assembly

Canonical chassis are recipes/presets, not cages.

A custom assembly is valid when:
- exactly one Primary Component exists;
- exactly one required structural support exists unless the primary is a Body;
- the Primary Component accepts that support;
- required connectors such as a Flail Chain are present;
- optional Grip is physically supported;
- hand requirements have at least one valid solution.

Custom assemblies retain the real Components, Composition, Primary Material, Durability, Production Value and future Upgrade attachment points.

## Quality

Component/Item Quality is:
`Ruined < Poor < Standard < Fine < Exceptional`.

The finished Weapon starts from the average Quality of its component Items. Craft margin then adjusts the resulting tier:
- margin +5 or more → +1 Quality
- margin 0..+4 → no change
- margin -1..-4 → -1 Quality
- margin -5 or worse → -2 Quality

One craft operation can therefore improve at most one tier or lose at most two tiers. Exceptional is the absolute maximum.

Quality does not create structural Durability and does not multiply Weapon Damage. Material + Components + physical Upgrades define the mundane performance envelope; Quality remains workmanship/condition and value.

Mundane Weapons have no `-3..+3` Weapon Grade or Enhancement axis. The universal equipment Enhancement namespace reserves only `+1/+2/+3` for future Enchantments; mundane Weapons are Enhancement 0.

## Durability lifecycle

Every completed Skill that uses the Weapon costs 1 Durability before additional elemental wear.

When a repairable Weapon reaches 0:
`Exceptional → Fine → Standard → Poor → Ruined → Destroyed`

After each non-terminal Quality drop, the same structural Durability bar refills. The material did not disappear; the Item's functional condition worsened.

Non-repairable ammo reaches 0 → Destroyed directly.

Normal Repair restores the current Durability bar and does not restore lost Quality.

## Improvised Damage

Improvised weapons are objects not made for combat. They are not the same thing as Ruined manufactured Weapons.

`Improvised Damage = round(normal Skill/Action damage × 0.60)`

Improvised Items use their Item Durability and break at 0 unless a later upgrade/conversion system formally turns them into a weapon.

## Upgrade gate

The composition engine already exposes the approved gate:

`Current Durability > 50% of Max Durability`

At exactly 50%, an Upgrade is not allowed.

The Upgrade system should attach modifications to Components rather than treating the Weapon as one abstract upgrade bucket.
