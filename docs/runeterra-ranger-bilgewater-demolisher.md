# Ranger — Bilgewater — Demolisher

Status: Design Closed

Player path: **Ranger → Bilgewater → Demolisher**

Internal family metadata: `marksman`.

## Level 15 — New Destiny

Shotgun Ranged Skills deal +20% Damage.

Shotgun Ranged Skills gain +1 ATK Weight. Secondary targets take only 60% of the Damage dealt to the main target.

Shotguns deal +10% Critical Damage.

## Level 35 — Smoke Screen

Unlock the **Smoke Screen** Skill.

- Type: Skill
- Action Cost: Action
- Resolution: Save
- Save: DEX
- Save DC: Ranger Spell Save DC
- ATK Weight: 3
- Targets: Up to 3 enemies
- Damage: None

Each targeted enemy makes its own DEX Save.

**Failed Save:** Gain 3 Bind and 3 Clash Power Down next Turn.

While an enemy is affected by Smoke Screen, **you deal +10% Damage to that enemy**.

**Successful Save:** Negates all effects.

## Level 50 — Quickdraw

At Turn Start, if you have Haste, reload 1 Shotgun Ammunition for free.

## Level 50 — True Grit

When a Shotgun Ranged Skill Hits, gain 1 Protection next Turn.

Max 1 activation per Skill. True Grit can grant up to 3 Protection at a time.

## Level 75 — Collateral Damage

When a Shotgun Ranged Skill Hits, its main target takes additional Fixed Damage equal to your Ranger Level ÷ 5.

Secondary targets take Fixed Damage equal to half that amount.

Triggers once per Skill.

## Level 90 — End of the Line

When a Shotgun Ranged Skill Hits its main target, mark that target until Attack End.

At Attack End, the marked target takes an additional Hit equal to 30% of the Damage dealt by that Skill.

Triggers once per Turn.

## Runtime notes

- Shotgun eligibility is derived from firearm chassis / weapon tags, not tile distance.
- New Destiny modifies existing Shotgun Ranged Skills; it does not create a mandatory bespoke attack Skill.
- Smoke Screen is a granted off-deck Save Skill and uses the existing multi-target Save resolver.
- Smoke Screen uses the Ranger Spell Save DC without consuming a Spell Slot.
- Quickdraw uses the equipped shotgun's real firearm ammo state and consumes compatible ammunition from Active Inventory.
- Protection, Bind, Clash Power Down and Fixed Damage use the existing shared runtimes.
- The implementation does not add a separate shell resource, range-band subsystem, or tile-distance dependency.
