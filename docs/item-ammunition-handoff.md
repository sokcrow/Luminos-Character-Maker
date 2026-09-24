# Physical Ammunition Handoff

This document supersedes the earlier Ranged V1 `consumedOnUse` interpretation for reusable physical ammunition.

## Scope

Canonical physical ammunition covered here:

- Arrow
- Crossbow Bolt / Virote
- Blowgun Dart
- Sling Bullet / Balin
- Sling Stone

Base damage always comes from the ranged Skill `Power`. Ammunition modifies that Skill; it does not provide a separate base-damage value.

## Combat Grade from offensive material

Ammo Combat Grade is material-driven, not a manual finishing label and not universal Item Quality.

The offensive surface supplies the grade:

- Arrow / Bolt / Blowgun Dart -> Projectile Head material
- Sling Bullet -> projectile body material
- Sling Stone -> the stone material itself

Shaft and Fletching affect structure, handling and Upgrades, but do not average down the offensive material grade.

Damage modifiers:

| Combat Grade | Skill Power modifier |
| ---: | ---: |
| -3 | -30% |
| -2 | -20% |
| -1 | -10% |
| 0 | +0% |
| +1 | +5% |
| +2 | +10% |
| +3 | +15% |

`js/item-ammo-runtime.js` contains the canonical material mapping and permits an explicit grade override for authored exceptions.

## Per-piece Durability from the Craft

Ammo durability is derived from the materials consumed by the batch recipe.

`Base Durability per piece = round(Craft Durability / Batch Yield)`

Minimum Durability is always 1.

With current reference recipes this resolves to:

- Arrow: 48 / 10 -> 5
- Bolt: 48 / 8 -> 6
- Blowgun Dart: 48 / 20 -> 2
- Sling Bullet: 25 / 10 -> 3
- Sling Stone: locked to 1

The formula is material-sensitive: changing incorporated material Durability changes the per-piece result without hardcoding new Uses by ammo name.

## Reinforced

Reinforced is a construction profile, separate from Combat Grade.

- Durability: +100% Base Durability (`x2`)
- Direct ranged Skill damage profile: -30% Ammo Power, i.e. 70% before other ammo modifiers
- Sling Stone cannot gain extra Uses; it remains locked to 1

Reinforcement is applied before Upgrade wear.

## Upgrade wear

A non-reinforcement Ammo Upgrade reduces per-piece Durability by a deterministic value from 30% to 90%.

The current calculation is:

- base Ammo Upgrade wear: 30%
- specialized / 2-slot Upgrade: +30%
- high-intensity Upgrade (`+15%` damage, `+10%` Ammo Power, `Status +2`, or Heavy Projectile): +30%
- per-Upgrade wear is clamped to 30-90%
- combined Ammo Upgrade wear is capped at 90%

Final formula:

`Final Durability = max(1, round(Base Durability x Reinforced Multiplier x (1 - Upgrade Wear)))`

Examples for a 5-Durability Arrow:

- ordinary Upgrade, -30% -> 4
- two ordinary Upgrades, -60% total -> 2
- specialized high-intensity Upgrade, -90% -> 1
- Reinforced + ordinary Upgrade -> `round(5 x 2 x 0.70) = 7`

## Status-specialized direct-damage tradeoff

Status projectile Upgrades remain Skill-driven: they do not create an absent Status and only amplify the matching Potency or Count axis already present on the Skill.

Status specialization also trades direct ranged damage for the stronger Status profile:

- 30% wear tier -> 80% direct Skill damage (-20%)
- 60% wear tier -> 70% direct Skill damage (-30%)
- 90% wear tier -> 60% direct Skill damage (-40%)

Physical damage Upgrades such as Honed Point, Needle Point, Broadhead, Razor Broadhead, Impact Head and Heavy Impact Head continue to use their explicit physical damage bonuses from the Ranged Upgrade catalog; they are not treated as Status specialization.

## Recovery lifecycle

Reusable projectile ammunition follows:

`Available -> Fired/Spent -> -1 Durability -> End-of-Combat Recovery`

Rules:

- a fired projectile enters the encounter Spent pool and cannot be fired again during that encounter
- if remaining Durability is greater than 0, it returns at end of combat
- if remaining Durability is 0, it is destroyed and does not return
- Sling Stone is always one use and therefore never returns

The runtime stores identical ammo in Durability buckets instead of instancing every projectile separately.

Example:

```js
{
  available: { 5: 7, 3: 2, 1: 1 },
  spent: {}
}
```

After firing one 5-Durability projectile:

```js
{
  available: { 5: 6, 3: 2, 1: 1 },
  spent: { 4: 1 }
}
```

At end of combat the `spent` bucket is merged back into `available`.

## NPC inventory / loot contract

Ammo quantity is real inventory state.

An NPC carrying 10 Arrows can make at most 10 Arrow shots in the encounter even when those Arrows have multiple Durability Uses, because fired projectiles remain Spent until combat cleanup.

Remaining carried ammo plus recovered surviving projectiles are the source of truth for loot. Ammo is not regenerated from a separate post-combat loot roll.

## Legacy compatibility

`item-ranged-weapon-composition-engine.js` still exposes the original Ranged V1 recipe fields such as `consumedOnUse` for compatibility. New physical-ammunition behavior is resolved through `LuminousAmmoRuntime`; callers migrating to the canonical Ammo lifecycle should use the runtime profile and recovery functions instead of interpreting legacy `consumedOnUse` as authoritative.

The former manual Ammo Grade labels (`Standard / Precision / Enhanced / Masterwork`) are legacy V1 behavior. Canonical physical Ammo Combat Grade is derived from the offensive material using the `-3...+3` scale above.
