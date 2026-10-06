# Canonical Luminous Speed Rules

This document is the source-of-truth contract for base Luminous combat Speed derivation.

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

Size modifies Max Speed after the movement conversion:

- Tiny: **+2 Max Speed**
- Small: **+2 Max Speed**
- Medium: **+0**
- Large: **-1 Max Speed**
- Huge: **-2 Max Speed**
- Gargantuan: **-3 Max Speed**

After Size is applied, Max Speed is clamped again to **at least 2**.

This order matters. Example: Tiny with 5 ft ground movement reaches the movement floor of Max 2, then Tiny adds +2, producing **1–4**, not 0–3.

## Runtime modifier order

Base movement + size produce the base range first.

Then existing gameplay systems may modify it through the canonical channels:

- `speed`
- `min_speed`
- `max_speed`

Examples include Class features, Traits, Statuses, Items, and Encounter effects.

After modifiers:

- Min Speed is clamped to **at least 1**.
- Normal Max Speed is clamped to **at least 2** and never below Min Speed.
- Explicit forced-Speed conditions may set Speed to 1.

## Dexterity

DEX is **not automatically added to Luminous Speed**.

Ability Scores remain available to mechanics that explicitly consume them, but base Speed derivation must not silently add DEX on top of Class / Trait / Status Speed rules.

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
