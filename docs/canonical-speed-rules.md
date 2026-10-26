# Canonical Luminous Speed Rules

This document is the source-of-truth contract for Luminous combat Speed derivation for Players, NPCs, enemies, summons and beasts.

## Hard invariants

- **Speed can never be lower than 1.**
- A normal Min/Max Speed range can never have **Max Speed lower than 2**.
- An explicit runtime condition may force a Unit to **Speed = 1**.
- No Player, NPC, Summon, Beast, or other Unit may resolve or roll Speed 0 or a negative Speed.

These floors are runtime rules, not UI-only validation.

## D&D movement vs Luminous Speed

D&D movement in feet and Luminous combat Speed are separate values.

A Unit may store movement data such as:

```js
movementFeet: {
  ground: 30,
  climb: 20,
  swim: 40,
  fly: 60,
  burrow: 5
}
```

Those values are canonical movement information. Combat consumes a derived Luminous Min/Max Speed range.

## Baseline

The current neutral baseline is:

- Medium
- 30 ft movement
- Min Speed 1
- Max Speed 6

## Movement conversion

For the active movement mode:

- Every complete 5 ft above 30 ft adds **+1 Max Speed**.
- Below 30 ft, Min Speed receives the below-baseline penalty but is clamped to **1**.
- Below 30 ft, Max Speed loses **1 per 5 ft below 30 ft**.
- After the movement penalty, Max Speed is clamped to **at least 2**.

## Size conversion

Size modifies only Max Speed after the movement conversion and Dexterity adjustment:

- Tiny: **+1 Max Speed**
- Small: **+1 Max Speed**
- Medium: **+0**
- Large: **-1 Max Speed**
- Huge: **-2 Max Speed**
- Gargantuan: **-3 Max Speed**

After Size is applied, Max Speed is clamped again to **at least 2**.

This order matters. Tiny with 5 ft movement and DEX 10 reaches the movement floor of Max 2, then Tiny adds +1, producing **1–3**. Size never directly reduces the minimum or the Dexterity score.

## Runtime modifier order

Movement, Dexterity and size produce the base range first. Dexterity is not added again to the rolled result.

Then existing gameplay systems may modify it through the canonical channels:

- `speed`
- `min_speed`
- `max_speed`

Examples include Class features, Traits, Statuses, Items, and Encounter effects.

After modifiers:

- Min Speed is clamped to **at least 1**.
- Normal Max Speed is clamped to **at least 2** and never below Min Speed.
- Explicit forced-Speed conditions may set Speed to 1.

## Dexterity and the shared formula

Use the effective Dexterity score from the Player sheet or the NPC's canonical scores.
Missing ability data defaults to DEX 10. Never infer a Dexterity penalty from size.

```text
DexModifier = floor((DexScore - 10) / 2)
D = clamp(trunc(DexModifier / 2), -2, +2)
Min = max(1, MovementMin + D)
Max = max(2, Min, MovementMax + D + SizeMaxModifier)
```

`trunc` rounds toward zero: Mod DEX -1 gives adjustment 0, -3 gives -1,
and +5 gives +2. MovementMin/Max are the movement-only values after their
floors, before size or DEX. DEX affects both bounds; size affects only Max.

Examples (before rank, traits, equipment or statuses):

| Profile | Speed range |
| --- | --- |
| Medium, 30 ft, DEX 10 | 1–6 |
| Medium, 30 ft, DEX 14 | 2–7 |
| Medium, 30 ft, DEX 18 | 3–8 |
| Small, 30 ft, DEX 15 | 2–8 |
| Large, 30 ft, DEX 10 | 1–5 |
| Huge, 30 ft, DEX 10 | 1–4 |
| Gargantuan, 30 ft, DEX 10 | 1–3 |
| Gargantuan, 40 ft, DEX 10 | 1–5 |
| Gargantuan, 30 ft, DEX 18 | 3–5 |

`combatRangeForEntity` is the shared resolver. Movement-backed profiles are
recomputed from source data, including rank bonuses and the existing
`mechanics.speedBonus` bounds. Cached ranges never receive DEX a second time.
Players without movement data use the 30 ft baseline with their own size and DEX.
Explicit NPC/DM ranges without movement remain authored overrides. A Player
range is an override only when explicitly marked `speedRangeSource: "authored-range"`.
Automatically derived ranges carry `speedRangeSource: "movement-dex-size"`.

## Round rolls and status order

- Only the combat authority rolls and persists one shared result per round.
- Deployment clears the previous encounter's Speed roll and round stamp.
- Exhaustion level 2+ lowers the roll ceiling by 2 before rolling, using the
  existing status rule (which can reduce that ceiling to 1).
- Haste adds to the result; Bind and floor(Chill / 2) subtract from it.
- The final Speed cannot be below 1. Forced-Speed conditions override all bonuses.
- Existing valid current-round rolls are preserved. A legacy Speed 1 with no
  usable saved range is repaired once, even if movement data exists. Legitimate
  Speed 1 outcomes with a valid range are preserved.
- A balance update affects the next normal roll; it does not reroll an already
  valid current-round result.

## Movement modes

Ground, Climb, Swim, Fly, and Burrow can have separate movement values and therefore separate derived Speed profiles.

The currently active movement mode determines the base Speed range used by combat.

Examples:

- A Flying Unit uses Fly movement while `Flying = true`.
- If that Unit is knocked down, `Flying = false` and its ground profile applies.
- An aquatic Unit uses Swim movement in an Underwater Encounter.
- A water-only creature outside water uses its ground movement profile and separately receives the established Air Counter behavior.

## Enforcement

The rule is enforced in:

- `js/movement-speed-runtime.js`
- `js/derived-stats-engine.js`
- `js/universal-speed-runtime.js`
- `js/unit-combat-instantiator.js`
- `js/combat-v073-speed-authority.js`

Regression coverage must fail if any reviewed Unit produces Min Speed < 1 or normal Max Speed < 2.

