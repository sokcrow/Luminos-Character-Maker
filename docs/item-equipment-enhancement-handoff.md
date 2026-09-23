# Universal Equipment Enhancement contract

This contract owns the numeric enhancement namespace shared by Weapons, Armor, Shields, Accessories and enchantable Valuables.

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
item kind: weapon | armor | shield | accessory | valuable
enhancementLevel: 0 | 1 | 2 | 3
enhancementSource: mundane | enchantment
```

Rules:
- mundane equipment is always Enhancement 0;
- negative enhancement levels are invalid;
- +1/+2/+3 require `enhancementSource = enchantment`;
- +4 or higher is unsupported by the V1 contract;
- this contract reserves identity/display only and does not invent magical bonuses before the Enchantment pass defines them;
- this contract also does not define price multipliers: item-family economy code supplies a stable `enchantmentBaseValueAhn` and the future Enchantment rules supply the actual multiplier.

## Legacy cutover

- `armorGrade -3..+3` is removed from Armor composition and legacy input is ignored.
- Weapons do not have a `weaponGrade` axis.
- Weapon Quality no longer multiplies Damage or Max Durability.
- Shield V1 remains grade-free.
- Ammunition `Combat Grade -3..+3` is a separate offensive-ammunition system and is intentionally not changed by this equipment migration.


## Jewelry / Valuable value boundary

Gem-bearing Jewelry and Gems-tier Valuables may participate in this +1/+2/+3 namespace.

Their mundane economy is resolved before Enchantment. The Jewelry/Valuables catalog exposes:

```text
baseMundaneValueAhn
enchantmentBaseValueAhn
enchantmentReady
```

An Enchantment price multiplier must operate on `enchantmentBaseValueAhn`. This prevents metal, Quality or gemstone input value from being counted twice.

The final multiplier values for +1/+2/+3 remain intentionally undefined by this contract.
