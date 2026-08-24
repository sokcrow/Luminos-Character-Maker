# Fixed Damage

## Canonical contract

Luminous has two damage modes. The mode is independent from kinetic damage type (`tipo_dano`) and Sin affinity.

- `damageMode: "normal"` is the default and keeps the existing damage calculation unchanged.
- `damageMode: "fixed"` is still ordinary damage, but defensive mechanics cannot reduce its amount.

Fixed Damage is **not** direct HP loss, soul damage, or a Shield bypass. After its amount is calculated it continues through the same `applyDamage` path as Normal Damage.

## Defensive reductions

For Fixed Damage, defender-originated reductions are neutralized instead of being allowed to lower the hit:

- Physical Resistance below neutral cannot reduce it.
- Sin Resistance below neutral cannot reduce it.
- A higher Defensive Level cannot reduce it below the attacker-side result.
- positive `damage_taken_multiplier` reduction cannot reduce it.

Vulnerabilities and other effects that increase damage are still allowed to increase Fixed Damage. Offensive bonuses, Crit, Clash and other attacker-side damage logic continue to work normally.

## Shield, HP and combat events

Fixed Damage keeps the normal damage application path:

1. Shield absorbs as much of the damage as it can.
2. Remaining damage is applied to HP.
3. Direct-damage/Stagger handling remains active.
4. Existing Hit/Damage lifecycle and combat bookkeeping remain applicable.

Example: 50 Fixed Damage against 30 Shield and 100 HP leaves 0 Shield and 80 HP. Resistances cannot turn the 50 into a lower value before the Shield receives it.

## Skill schema

```js
{
  tipo_dano: "cortante",
  pecado: "wrath",
  damageMode: "fixed"
}
```

`tipo_dano` continues to describe Cortante/Perforante/Contundente. `damageMode` describes whether defender-side reductions may mitigate the damage.

Skills without `damageMode` are treated as `normal` for backward compatibility.

## Path of the Devil Lineage

`Power of the Nine Hells` uses the same Fixed Damage contract for its existing mechanic:

`On Hit, STR Skills deal (STR Mod × 2)% Fixed Damage.`

The additional component is Fixed Damage, but it is still absorbed by Shield before it reaches HP.
