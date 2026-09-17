# Firearms + Firearm Ammunition V1 Handoff

## Scope

This closes the first canonical firearm design pass for Items. It intentionally keeps firearm construction and ammunition abstract/game-facing and does not encode real-world weapon or chemical manufacturing instructions.

## Core doctrine

`Firearm = delivery platform`

`Skill = Coin / combat effect grammar`

`Ammunition = offensive material and payload`

Firearm components never grant direct damage percentages, Ammo Power, or automatic Status application. Ordinary firearm ammunition cannot use Decay or Radiance. Sound suppression/silencers are outside the setting contract and are explicitly unsupported.

## Firearm component families

The ten approved icon families are Frame, Barrel, Action, Trigger, Grip, Stock, Magazine, Cylinder, Tubular Feed and Sights. The catalog exposes 16 concrete V1 components by reusing those icon families across size/role variants.

Approved icons:

- Frame: `https://imgur.com/PTvX2iC.png`
- Barrel: `https://imgur.com/CevBgU5.png`
- Action: `https://imgur.com/4X3iLIX.png`
- Trigger: `https://imgur.com/EJm7eVM.png`
- Grip: `https://imgur.com/Z8uo0ce.png`
- Stock: `https://imgur.com/zlqG6UR.png`
- Magazine: `https://imgur.com/NfR1h3w.png`
- Cylinder: `https://imgur.com/6jARKtW.png`
- Tubular Feed: `https://imgur.com/LN7kuCw.png`
- Sights: `https://imgur.com/1UbIJyN`

## Crafting difficulty

Firearms sit above conventional/rudimentary weapon construction. Structural firearm parts use TH 20; technical/precision parts use TH 24. Canonical final assembly uses:

- Pistol: TH 24
- Revolver: TH 24
- SMG: TH 26
- Rifle: TH 26
- Shotgun: TH 26

Production Value follows the existing Items rule:

`Production Value = sum(consumed input Production Values) × process multiplier`

Finished firearms then apply their assembly multiplier. Reference Standard builds currently resolve to:

- Pistol: ₳1,349,000
- Revolver: ₳1,527,000
- SMG: ₳1,721,000
- Rifle: ₳1,791,000
- Shotgun: ₳1,833,000

These are Production Values, not universal shop prices.

## Quality

Universal Item Quality remains Ruined / Poor / Standard / Fine / Exceptional. Numeric functional fields such as Control, Reliability, Stability and Range Efficiency may scale with Quality. Discrete properties such as Capacity, supported Cadence modes, Caliber compatibility and Reload economy do not multiply just because Quality changes.

Finished firearm Quality follows the existing composition rule: average component Quality, then craft-margin adjustment.

## Presets are not cages

Pistol, Revolver, SMG, Rifle and Shotgun are canonical recipes/presets. Custom assembly remains valid when structural roles and feed compatibility are valid. A Stock may therefore be installed on a compatible Pistol frame; the Stock contributes its own properties and is removed when the part is removed.

## Cadence

Cadence consumes ammunition per Coin without creating additional Coins. Each Coin still resolves its Coin effects, `[On Hit]` effects and Status effects once.

V1 balance constants:

- Single: 1 ammo/Coin, ×1.00 Damage Pool, 0 Power
- Rapid: 2 ammo/Coin, ×1.10 Damage Pool, -1 Power
- Burst: 3 ammo/Coin, ×1.20 Damage Pool, -2 Power
- Full: 4 ammo/Coin, ×1.30 Damage Pool, -3 Power

The Coin Damage Pool is divided deterministically between fired ammunition units. Each unit then applies its own ammunition damage modifier to its slice. Control never cancels the voluntary Power penalty from Cadence.

## Control

Control prevents Clash Power loss caused by being hit. It is consumed against incoming Clash Power loss for the current CombatAction and is not a generic permanent Power bonus. Derived firearm Control is capped at 3 in V1.

## Range profiles

Player-facing profiles:

- Fastest: efficient against targets tied for highest enemy Speed
- Slowest: efficient against targets tied for lowest enemy Speed
- Faster: efficient when Target Speed > User Speed
- Slower: efficient when Target Speed < User Speed

Equal Speed is neutral for Faster/Slower. Range Efficiency applies a positive modifier when optimal, no modifier when neutral, and the mirrored negative modifier when inefficient.

Canonical starting profiles are Pistol Faster, Revolver Faster, SMG Slower, Rifle Fastest and Shotgun Slowest.

## Reload and active inventory

Capacity and Reload are separate from Cadence. Reload checks compatible ammunition in active inventory. Base feed contracts are Action-based in V1; component upgrades may later reduce Action to Quick Action or use a Turn End contract, but one upgrade cannot collapse Reload directly to free/no-action use.

Magazine reload is full; Cylinder and Tubular Feed use incremental base contracts. Exact container equipment such as bandoliers remains a separate Inventory/Accessory concern: firearms only ask whether compatible ammo is available through the active-inventory contract.

## Reliability

Reliability is deterministic. Higher Cadence modes may require enough Reliability; V1 does not introduce random jam percentages.

## Firearm ammunition parts

Firearm ammunition uses four abstract craft parts:

- Projectile: offensive material / Combat Grade / Damage Type profile
- Casing / Hull: compatibility / reliability / structure
- Propellant Charge: abstract caliber support / reliability
- Primer / Ignition: abstract reliability

Dedicated art for these four ammo parts has not been supplied yet, so V1 uses the existing generic Ammo icon and explicitly marks dedicated part art as pending.

## Caliber tiers and batches

Caliber is an abstract Tier 1-4 compatibility field. The setting-specific caliber/barrel relationship is not replaced by real-world assumptions.

Reference batch yields:

- Tier 1: 20
- Tier 2: 15
- Tier 3: 10
- Tier 4: 5

Ammo batch Production Value is `sum(part batch values) × assembly multiplier`, then divided by batch yield for unit Production Value. Exact material choices remain authoritative rather than a flat universal cartridge price.

## Ammo Combat Grade

Firearm ammunition inherits the canonical physical Ammo Combat Grade contract rather than restoring the legacy Standard/Precision/Enhanced/Masterwork labels. Offensive Projectile material supplies Combat Grade -3...+3 and the existing damage modifier table from `item-ammo-runtime.js`.

Universal Item Quality and Ammo Combat Grade are separate axes.

## Status and elemental rules

Firearm ammo may later carry physical/elemental profiles and amplify a Status axis already present on a compatible Skill. It never creates an absent Status as a generic automatic proc. Decay and Radiance are rejected for ordinary firearm ammo.

## Files

- `js/item-catalog-firearm-components.js`
- `js/item-firearm-composition-engine.js`
- `js/item-catalog-firearm-ammo.js`
- `js/item-firearm-runtime.js`
- `tests/item-firearm-components-smoke.cjs`
- `tests/item-firearm-ammo-smoke.cjs`
- `tests/item-firearm-runtime-smoke.cjs`

## Deferred balance/integration

The V1 contracts are closed, while exact playtest tuning remains open for Cadence multipliers, maximum useful Control, Range Efficiency bands and final market pricing. Direct binding into the live Combat Skill/Inventory surfaces remains a later bridge; these modules expose pure authoritative Item/runtime contracts now.
