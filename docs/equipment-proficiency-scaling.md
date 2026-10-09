# Equipment Proficiency — proposed combat integration

These formulas replace the former flat Armor Proficiency adjustment and define Weapon Proficiency benefits. "Proficiency" in these equations refers to the character's Proficiency Bonus (normally +2 to +6), **not** a Skill Proficiency state or Ability Modifier.

## Weapons

When an Attack Skill actually uses a weapon with which the unit is proficient:

- Damage bonus: `+(2 * Proficiency Bonus)% Damage`.
- Offensive Level bonus: `+floor(Proficiency Bonus / 2) Offensive Level`.

These benefits are per weapon Attack Skill, not global character bonuses and not Spell bonuses. The off-hand does not create a second copy of these bonuses.

The pure calculation is `LuminousWeaponPropertyRuntime.resolveWeaponProficiency({proficient,proficiencyBonus,level})`, and `resolvePowerModifiers` exposes `damageBonusPercent` and `offensiveLevelBonus`. The consuming attack-resolution bridge must apply each return field exactly once.

## Armor

While wearing an Armor chassis with which the unit is proficient:

- Slash/Pierce/Blunt resistance multiplier adjustment: `-(0.02 * Proficiency Bonus)`.
- Defensive Level bonus: `+floor(Proficiency Bonus / 2) Defensive Level`.

The resistance bonus **replaces**, rather than stacks with, the previous fixed `-0.02`. It does not modify Sin Resistance. The existing Armor resistance bounds continue to apply.

The calculation lives in `LuminousArmorRuntime.resolveProficiencyBenefits({proficient,proficiencyBonus,level})`. The existing `resolvePhysicalResistance` now applies this scaled resistance reduction and exposes `defensiveLevelBonus`; the consuming live combat bridge must add this bonus exactly once to the wearer's Defensive Level.

## Values

| Proficiency Bonus | Weapon Damage | Offensive Level | Physical Resistance | Defensive Level |
| ---: | ---: | ---: | ---: | ---: |
| +2 | +4% | +1 | -0.04 | +1 |
| +3 | +6% | +1 | -0.06 | +1 |
| +4 | +8% | +2 | -0.08 | +2 |
| +5 | +10% | +2 | -0.10 | +2 |
| +6 | +12% | +3 | -0.12 | +3 |

## Integration status

These runtime calculations and direct smoke assertions exist. There is **not yet an authoritative equipment-proficiency resolver connecting class/trait-granted Weapon and Armor Proficiencies to the worn/equipped Item**, nor a proven live Combat bridge consuming the Offensive/Defensive Level and Damage fields. Do not treat these as live combat bonuses until that integration is implemented and tested end-to-end. In the interim callers must explicitly pass verified `proficient: true` and should supply the unit's Proficiency Bonus (or level). Missing `proficient` never grants a bonus.
