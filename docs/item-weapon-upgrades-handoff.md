# Physical Melee Weapon Upgrades — V1 Handoff

This document records the approved physical melee Weapon Upgrade rules layered on top of the canonical component-composition engine.

## Scope

V1 is physical only. Elemental, magical, enchantment, motorized and other future source categories are intentionally deferred.

Upgrades attach to Weapon Components rather than to one abstract Weapon-wide bucket.

## Upgrade capacity from material durability

Capacity is derived from the unit Durability of the component's structural material, not from the component's total accumulated Durability:

- material Durability 1–19 → 1 Upgrade Slot
- material Durability 20–34 → 2 Upgrade Slots
- material Durability 35+ → 3 Upgrade Slots
- hard cap → 3 Slots per component

Reinforcing or weakening a component later does not recalculate its slot capacity. This prevents reinforce/unlock/remove exploits.

For multi-material components, the structural body/head/link/wrap material supplies capacity; secondary flexible/reinforcement materials do not add their own slots.

## Upgrade installation gate

A component can only be upgraded while:

`currentDurability > maxDurability × 0.50`

Exactly 50% is not enough.

The installation economy (Tool, TH, consumed materials, Production Value delta and removal/refit economy) remains a later Craft pass.

## Durability tradeoffs

Upgrade Durability modifiers are additive against the component's pre-upgrade structural Durability.

Typical scale:

- 0%: conservative modification
- -10%: moderate specialization
- -20%: aggressive specialization
- -30%: extreme ceiling for a single V1 modification
- +10%: localized reinforcement
- +20%: standard structural reinforcement
- +30%: heavy reinforcement, normally 2 slots

After all modifiers, Upgrade effects cannot reduce a component below 40% of its original structural Durability.

Example:

`50 DP base + Razor Edge (-20%) + Reinforced Blade (+20%) = 50 DP final`

## Skill-driven Status rule

Weapons do **not** create Status as an On Hit proc.

A physical Status Upgrade only amplifies a Status axis that the compatible Skill already applies through the upgraded component/surface.

Examples:

- Skill applies Bleed Potency 3 + Serrated Edge (+1 Bleed Potency) → Bleed Potency 4
- Skill applies Bleed Count 2 + Retaining Teeth (+1 Bleed Count) → Bleed Count 3
- Skill applies no Bleed → Serrated Edge creates no Bleed
- Skill applies Bleed Count but no Bleed Potency → a Potency Upgrade does not inject Potency

Every Status Upgrade affects exactly one axis:

- Potency **or**
- Count

Never both on the same Upgrade.

The V1 physical Status families are Bleed, Rupture and Tremor.

## Physical offensive scale

- normal single-type Damage Upgrade → +10% compatible physical Damage
- specialized single-type Damage Upgrade → +15%, normally with structural/handling cost
- dual Slash/Pierce geometry → +5% / +5%

Damage bonuses are percentage based, never flat damage additions.

## Defensive and handling scale

The support side of a weapon is intentionally distinct from the offensive Head/Blade side.

Head / Blade primarily governs:
- Slash / Pierce / Blunt Damage
- Bleed / Rupture / Tremor Potency or Count
- physical geometry / attack surfaces

Handle / Hilt / Grip / Shaft primarily governs:
- Clash
- Guard
- Clashable Guard
- Counter
- Clashable Counter
- Power transfer
- balance
- handling
- stability

Typical V1 values:
- Clash / Guard / Counter normal → +10%
- specialized / conditional Clash / Guard / Counter → +15%
- general compatible Skill Power → +5%
- conditional leverage / 2H Power → +10%

A Counter's defensive resolution can use support Upgrades; if the Counter then performs an attack, the attack still uses the Head/Blade's compatible Damage/Status Upgrades.

## Upgrade groups and stacking

An individual component cannot equip two Upgrades from the same Upgrade `group`.

Examples:
- Sharpened Edge + Razor Edge → invalid (`edge_damage` conflict)
- Razor Edge + Serrated Edge → valid if slots allow it (`edge_damage` + `bleed_potency`)

Specialized +2 Status Upgrades normally consume 2 slots. This prevents a 2-slot material from combining a +2 Status specialty with an additional third effect.

## Physical attack surfaces

V1 resolves component attack surfaces independently from Skill damage type:

- `edge` → normally Slash
- `point` → normally Pierce
- `impact` → normally Blunt

A Skill must declare/use the compatible component and surface for an offensive Upgrade to modify it.

Geometry Upgrades can add a surface/property without forcing every Skill to use it:

- Back Spike → Axe gains `point`
- Spike Conversion → Hammer/Mace gains `point` while retaining `impact`
- Hooked Head → adds `hook`
- Extended Edge → adds extended-edge geometry

## Heavy-head support wear

Overweighted Head does not weaken the Head directly. Instead, Skills using that configuration transfer +1 additional Durability wear to the support component. Flexible Haft can mitigate one point of that extra support wear, never reducing normal wear below its normal minimum.

## Catalog and runtime files

- `js/item-catalog-weapon-upgrades.js`
  - 65 physical V1 Upgrade definitions
  - compatibility, groups, slot cost, percentages, Status axis/delta and Durability effects
- `js/item-weapon-upgrade-engine.js`
  - material-derived 1/2/3 slot capacity
  - loadout validation and group conflicts
  - Durability modification + 40% floor
  - >50% installation gate
  - surface resolution
  - Skill payload modifier contract
  - Status amplification without On Hit injection
  - support-wear handling
- `tests/item-weapon-upgrade-smoke.cjs`
  - validates the canonical rules above

## Deferred after this melee V1 pass

- exact Tool / Craft TH / consumed materials / Production Value for installing or removing an Upgrade
- direct binding to the final Combat Skill runtime schema; the Upgrade engine currently exposes the pure Skill-context contract for that bridge
- elemental/material susceptibility matrix
- magical/enchantment/mechanical Upgrade source categories
- ranged composition and ranged-specific Upgrades
