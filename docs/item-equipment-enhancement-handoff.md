# Universal Equipment Enhancement contract

This contract owns the numeric enhancement namespace shared by Weapons, Armor and Shields.

## Canonical separation

Mundane equipment performance is resolved by:
- Material
- Component geometry / structure
- Item Quality
- Physical Upgrades
- Equipment-specific proficiency and runtime rules

Mundane equipment does **not** use a numeric `-3..+3` Grade or enhancement axis.

## Reserved Enchantment namespace

Only Enchantments may use:
- `+1`
- `+2`
- `+3`

The universal runtime shape is:

```text
equipment kind: weapon | armor | shield
enhancementLevel: 0 | 1 | 2 | 3
enhancementSource: mundane | enchantment
```

Rules:
- mundane equipment is always Enhancement 0;
- negative enhancement levels are invalid;
- +1/+2/+3 require `enhancementSource = enchantment`;
- +4 or higher is unsupported by the V1 contract;
- this contract reserves identity/display only and does not invent magical bonuses before the Enchantment pass defines them.

## Legacy cutover

- `armorGrade -3..+3` is removed from Armor composition and legacy input is ignored.
- Weapons do not have a `weaponGrade` axis.
- Weapon Quality no longer multiplies Damage or Max Durability.
- Shield V1 remains grade-free.
- Ammunition `Combat Grade -3..+3` is a separate offensive-ammunition system and is intentionally not changed by this equipment migration.
