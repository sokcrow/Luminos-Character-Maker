# Ranger — Bilgewater — Buccaneer

Status: Design Closed

Player path: **Ranger → Bilgewater → Buccaneer**

Internal family metadata: `marksman`.

## Level 15 — Target Shift

While using a Pistol, the first Hit of a Ranged Skill deals +15% Damage and inflicts **Target Mark** on the target.

A unit with your Target Mark cannot receive the Damage bonus from Target Shift.

When you Hit a different target with a Pistol Ranged Skill, remove Target Mark from the previous target and inflict it on the new target.

Only one unit can have your Target Mark at a time.

Target Mark is source-aware so multiple Buccaneers track their own marks independently.

## Level 35 — Ricochet

Unlock the **Ricochet** Skill.

- Type: Skill
- Action Cost: Quick Action
- Resolution: Automatic
- Damage: None

Activate Ricochet to empower your next Pistol Ranged Skill this Turn.

When the first Hit of that Skill Hits its Main Target, the shot ricochets to one additional enemy.

The ricochet deals 50% of that Hit's Damage.

If the Main Target is defeated by that Hit, the ricochet deals 100% Damage instead.

Ricochet is consumed after the empowered Pistol Ranged Skill is used.

## Level 50 — Sea Legs

At Turn Start, if you did not take Damage during the previous Turn, gain 2 Haste this Turn.

When Target Shift activates, gain 1 Haste next Turn.

Haste gained from Sea Legs cannot exceed 3.

## Level 75 — Powder Rain

Unlock the **Powder Rain** Skill.

- Type: Skill
- Action Cost: Quick Action
- Resolution: Save
- Save: DEX
- Save DC: Ranger Spell Save DC
- ATK Weight: 4
- Base Power: 3
- Coin Power: 3
- Coin Amount: 1
- Targets: Up to 4 enemies

Each targeted enemy makes its own DEX Save.

**Failed Save:** Take full Damage and gain 2 Bind and 2 Fragile next Turn.

**Successful Save:** Take half Damage and negate Bind and Fragile.

## Level 90 — Broadside

Unlock the **Broadside** Skill and **Covering Fire** Passive.

### Broadside

- Type: Ranged Skill
- Weapon Requirement: Pistol
- Base Power: 5
- Coin Power: 4
- Coin Amount: 5
- ATK Weight: 8

Each Coin selects and attacks a target independently.

### Covering Fire

**While in Backup:**

During the Combat Phase, Broadside activates automatically.

Each Hit deals 25% of its normal Damage.

**While Deployed:**

Broadside activates automatically at Turn End at full Damage.

## Runtime notes

- Buccaneer is a direct Ranger Archetype option with `regionId: bilgewater`.
- `marksman` is internal family metadata only; the player does not select a separate Marksman layer.
- Pistol eligibility is derived from firearm chassis / weapon tags, not tile distance.
- Ricochet and Powder Rain are granted off-deck Quick Actions.
- Powder Rain uses Ranger Spell Save DC and the canonical Save resolver, then applies its own Coin-based Damage outcome.
- Bind, Fragile and Haste use the shared Status runtime.
- Broadside reads real FIELD/BACKUP deployment state. Backup fire only targets deployed enemies.
- Broadside does not use indiscriminate/friendly-fire targeting.
