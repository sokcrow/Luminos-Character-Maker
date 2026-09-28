# Shield V1 handoff

Shield V1 is hand equipment and can be used defensively or offensively. It is assembled through the same material/component pipeline as Weapons and Armor:

`Material Units -> Shield Component -> Shield Chassis -> Finished Shield`

## Chassis

| Chassis | Components | Guard range | Crashable Guard Clash | Shield Cracked | Parry |
| --- | --- | ---: | ---: | ---: | --- |
| Buckler | 1 Body + 1 Grip | 8-15% | +2 | +0 | intrinsic Tier 1 |
| Round Shield | 2 Body + 1 Rim + 1 Grip | 15-25% | +1 | +1 | upgrade/source required |
| Heater Shield | 3 Body + 1 Rim + 1 Grip | 22-35% | +0 | +2 | upgrade/source required |
| Tower Shield | 5 Body + 2 Rim + 1 Grip | 30-50% | -2 | +3 | upgrade/source required |

Body = 2 MU structural. Rim = 1 MU solid + structural. Grip = 1 MU solid + structural core + 1 MU flexible wrap. All authored recipes use whole Material Units.

The Body primary material/lineage names the finished Shield. Rim and Grip do not override the name.

## Guard, material Structure and Quality

Guard is placed inside the chassis range by Body material Structure:

`Guard = floor(Min + (Max-Min) * min(1, MaterialStructure * QualityStructure)) + UpgradeGuardDelta`

Known Structure values are encoded in `item-shield-composition-engine.js`; examples are Wood .55, Chitin .70, Iron .76, Hardened Steel .90, Titanium Alloy .94, Advanced Titanium Alloy .98 and Tungsten Alloy 1.00.

Quality is workmanship, not material. Final Quality is the quantity-weighted component Quality adjusted by the final craft margin using the Armor composition contract (+5 => +1, TH..TH+4 => 0, TH-1..TH-4 => -1, worse => -2).

| Quality | Structure | Durability | Weight | Value |
| --- | ---: | ---: | ---: | ---: |
| Ruined | x0.70 | x0.60 | x1.00 | x0.20 |
| Poor | x0.85 | x0.80 | x1.00 | x0.55 |
| Standard | x1.00 | x1.00 | x1.00 | x1.00 |
| Fine | x1.10 | x1.20 | x1.00 | x1.65 |
| Exceptional | x1.20 | x1.40 | x1.00 | x2.50 |

Quality never changes Weight, Damage Type, Proficiency, Parry Tier, chassis Clash modifier, Shield Cracked, or component upgrade capacity.

## Weight

Shield Weight uses the universal equipment ratio tiers: <=.70 Very Light, <=.85 Light, .86-1.14 Standard, 1.15-1.34 Heavy, >=1.35 Very Heavy. Chassis base burden and material Weight combine. Armor and Shield penalties stack. Exceeding the Shield STR Requirement by 3 halves negative Weight penalties using floor magnitude.

## Proficiency

Shield Proficiency adds +2 Guard percentage points per point. Physical-resistance support is -0.02 at P0, then an additional -0.02 per point, capped at -0.08. This support is not material-scaled.

## Durability and equipment protection

Shield components have higher impact-Durability than ordinary Armor layers because Shields are built to receive repeated direct impacts. Body uses x2.00 structural impact-Durability, Rim x1.50, Grip x1.00 before final Quality.

Physical Shield Wear is event based: a Shield contacted by one Skill loses 1 Durability when that Skill resolves, regardless of Coin count or physical damage amount. Guard with no contact causes no Wear. Clashable Guard contact also causes Wear whether it wins or loses.

Elemental Shield Wear uses the exact same defensive equipment formula as Armor:

`BaseWear = max(1, floor(ElementalDamage / 10))`

`ElementalWear = max(1, floor(BaseWear * 1.25 * MaterialElementFactor) - flatReduction)`

When a physical Shield is the Guard source, it is the Wear sink for that defensive event: Armor, Weapons and other carried equipment do not also receive Wear from the same intercepted event. Damage to HP remains a separate combat channel.

## Dual Shield

Shields are one-hand equipment. Weapon+Shield, Weapon+Weapon, Shield+Shield and single-hand configurations are legal if the anatomy/hand rules allow them. Guard does not add two Shield Guard values together. Each defensive action selects one Shield Source. With two Shields equipped, the source must be explicit; only that Shield contributes Guard, Proficiency support, Crashable Guard properties, upgrades and Durability Wear for the action.

## Offensive identity

Every Shield has `bash`: Blunt + `shield`, `impact`, `tremor_capable`. Physical modifications add attack modes rather than replacing Bash. Equipment grants physical capability; Skills own Power, Coins and exact Status application.

Spikes grant Pierce/Rupture capability. Blade/knife modifications grant Slash/Pierce and Bleed capability. Impact bosses support Blunt/Tremor. Status upgrades only amplify matching axes a compatible Skill already uses; they do not create a Status proc on every hit.

## Upgrades

Upgrade slots are determined by the component primary material Durability: 1-19 => 1, 20-34 => 2, 35+ => 3, hard cap 3. Buckler intrinsic Parry consumes zero slots.

The V1 catalog includes 19 upgrades across Body, Rim and Grip: Reinforced/Lightened Body, Impact/Shock Boss, Spiked Face, Breaker Spikes, Parrying/Reinforced/Bladed/Serrated/Hooked/Staggering Rim, Mounted Knife, Crushing Deflector, Reinforced/Shock-Absorbing/Counterweighted/Power/Secure Grip.

Upgrade recipes use real materials. Material-adding upgrades consume whole MU and derive Production Value from input value x process multiplier. Geometry-only rework (Lightened Body, Serrated Rim) charges a ratio of the existing component Production Value. Mounted Knife consumes a real Short Blade component and installs it at x1.20.

## Production Value

Component PV = consumed input PV x component process multiplier. Finished Standard physical PV = (component PV + installed upgrade PV) x chassis assembly multiplier, rounded to nearest 1,000 AHN. Final physical PV then applies the Shield Quality value multiplier. Enchantments are a later layer and add value after the mundane physical item; mundane +1/+2/+3 is not used.

Wood/Leather reference Standard outputs are Buckler 45k, Round 83k, Heater 111k and Tower 181k AHN. A Standard Hardened Steel Tower with Leather grip wrap resolves to 1.924M AHN.

## Crashable Guard

Only Shield Crashable Guard uses chassis Clash/Cracked rules. Normal Guard, Clashable Counter and generic Coin Cracked semantics are unaffected.

On WIN, the chassis Clash modifier is part of the Guard Final Power, so existing Stagger-threshold behavior naturally uses the modified result. On LOSE, the engine keeps the existing fixed Guard Final Power mitigation and adds Shield Cracked as another fixed Final Power reduction. No percentage mitigation is introduced.

Generic Unbreakable/Red Coin cracked behavior remains the existing fixed Power 1 doctrine and is not rewritten by Shield code.
