# Shared Weapon / Skill Compatibility Contract

The canonical resolver is `LuminousEnchantmentCombatLink` in
`js/item-enchantment-combat-link.js`, **not** a second rule engine in
Combat Master or Theatre.

## Rules

- A learned Skill is **never removed** when equipment changes.
- Explicitly weapon-bound Skills (`requiresWeapon`, `isItemSkill`,
  `sourceType: "weapon"`, `weaponDefinitionId` or `weaponSlot`) need an
  equipped, matching weapon.
- Other physical Attack Skills that have an equipped weapon use weapon
  compatibility. In the absence of equipped weapons, the generic/unarmed
  path is preserved for backward compatibility.
- The physical Skill damage type must match at least one of the equipped
  weapon's physical types: **Slash**, **Blunt**, or **Pierce**.
  Spanish aliases Cortante, Contundente and Perforante and D&D synonyms
  Slashing, Bludgeoning and Piercing normalize to the same three IDs.
- A weapon may declare `damageType` or `damageTypes` (including its
  canonical equipment/runtime subrecord). A multi-type weapon can support
  more than one physical type.
- A technique deliberately authored as a pommel strike can specify
  `compatibleWeaponDamageTypes: ["slash"]` even if the Skill's own
  `damageType` is `"blunt"`. **No automatic damage conversion** occurs.
- An attack explicitly independent from weapons uses
  `weaponUsage: "unarmed"` / `"independent"` or `isUnarmed: true`.
  Spells, defense and innate skills are also exempt.
- Weapon slot and weapon definition requirements are checked *in addition*
  to the damage-type restriction, not instead of it.

## One consumer, three places

1. **Combat Master player Skill planner**: retained-but-incompatible skills
   remain visible, with "Requiere arma compatible", disabled for scheduling.
   The weapon picker offers compatible equipped items only.
2. **Combat Master trusted action compiler**: revalidates the canonical
   Skill and the actual equipped weapon on execution, including when
   a client forges a planned Skill payload. If the validator is unavailable,
   player actions fail closed.
3. **Theatre / character-sheet Skill HUD**: displays "ARMA INCOMPATIBLE"
   next to a learned Skill using the exact same `skillAvailability` API.
   It is a **read-only** preview; it does not simulate combat in Theatre.

The authoritative Skill library stays distinct from the equipped-weapon
instance. Damage/coin/effect definitions are not rewritten when switching
weapons.

## Example combinations

| Equipped weapon | Skill | Outcome |
|---|---|---|
| Slash sword | Slash Attack | Allowed |
| Slash sword | Blunt Attack | Blocked |
| Blunt mace | Blunt Attack | Allowed |
| Pierce dagger | Pierce Attack | Allowed |
| Slash sword + Blunt mace | Blunt Attack | Mace allowed, sword blocked |
| Slash sword | Blunt pommel attack, explicitly permitting Slash weapon | Allowed |
| Any sword | Spell or authored unarmed technique | Independent of sword type |

## Validation

Run `node tests/weapon-skill-compatibility-smoke.cjs` to check aliases,
weapon IDs/slots, forged requests, dual wield, physical damage and explicit
exceptions. Existing planner and action-adapter smoke tests are also wired
into `.github/workflows/unified-weapon-skill-compatibility.yml`.

**Separate concern:** trusted catalog provenance and permissions of
user-authored item instances remain a general inventory security problem;
do not interpret a client-provided weapon instance as an authenticated
catalog definition. In-combat loadout switching remains separate as well.
