# Derived Stats v1

Tracked by GitHub Issue #587.

## Authority

`js/derived-stats-engine.js` is the pure Character Core resolver for effective and derived values.

```text
persistent Character
  -> normalize base Scores
  -> persistent Score sources
  -> runtime Score sources
  -> Ability Mod
  -> Character build calculation
  -> runtime modifier channels
  -> HP / SP / OFF / DEF / Speed snapshot
```

The public entry point is:

```js
LuminousDerivedStats.resolveCharacterStats(character, context)
```

It does not write Firebase, mutate the Character or persist runtime state.

`js/derived-stats-runtime.js` is the compatibility boundary that lets existing Player, DM, NPC and Combat surfaces consume the resolver while their older APIs remain available. It is intentionally an adapter, not another calculator.

## Base, effective and runtime

For every D&D Ability:

```text
Base Score
+ Racial Score bonus
+ Background Score bonus
+ persistent Trait Score bonus
= Persistent Effective Score
+ runtime Trait/temporary Score bonus
= Effective Score
-> Ability Mod = floor((Effective Score - 10) / 2)
```

`baseStats` is never mutated by the resolver.

Modern data prefers `characterBuild.baseStats` / `baseStats`. A legacy record that only contains `stats` and has `characterBuild.breakdown.racialStatBonuses` is normalized by subtracting that already-applied racial layer before recalculation. This prevents the supported reload case from turning Human 10 + 1 into 12.

A legacy record without a base layer or a stored racial breakdown keeps the historical assumption that `stats` is the base input. Persistence migration #591 is the correct place to quarantine/upgrade ambiguous old records; Derived Stats does not guess historical intent.

## Ability Mod and Proficiency

Ability Mod has one formula:

```js
Math.floor((score - 10) / 2)
```

Character Proficiency keeps the established Luminous progression:

```js
Math.ceil(CharacterLevel / 20)
```

NPCs may provide an explicit proficiency override because their existing D&D profile already stores one. Ability/Skill proficiency state and Check resolution remain owned by #597; Derived Stats only supplies the Character's canonical Ability Mod and base Proficiency bonus.

## Character Level / multiclass boundary

Derived Stats needs Character Level for Proficiency and build math. It uses an explicit Character Level when present, otherwise the sum of canonical `characterBuild.classes[].levels`.

It does **not** resolve Class-specific Trait progression. That remains the responsibility of #586. Multiclass only affects Derived Stats where an existing rule explicitly consumes the class mix, such as `character-build-rules.js` weighted HP/OFF/DEF values.

## HP

When a complete canonical Character build is available, HP comes from the existing `character-build-rules.js` calculation using the final effective Constitution Score. The resolver does not introduce a second HP formula.

Snapshot fields:

```js
hp: {
  current,
  max,
  base,
  coefficient,
  runtimeCoefficient,
  breakdown
}
```

Runtime HP coefficient is contextual and never written back to base Character data by this engine.

## SP

The audited repository currently stores current SP (`sp_actual`) but does not define one canonical Max SP formula. Derived Stats v1 therefore does not invent one.

```js
sp: {
  current: -12,
  max: null,
  source: "current-only"
}
```

If a supported record already contains a max-SP field, it is exposed with `source: "stored"`. A future rule may define Max SP through a separate confirmed contract.

## Offensive / Defensive Level

The canonical Character-level breakdown is:

```text
Character Level
+ Class modifier
+ Race modifier (DEF where applicable)
+ DM modifier
+ Item modifier
+ runtime Trait/Status channel
= Character OFF / DEF
```

Class/Race values come from `character-build-rules.js`; runtime channels come from `universal-modifier-engine.js`.

Combat may still add **Skill-specific** scaling and resonance after this base. Those are properties of the Skill resolution, not a second Character OFF/DEF source.

## Speed

There is no new Speed progression formula in #587. Stored base/min/max Speed is the baseline. `speed`, `min_speed` and `max_speed` Universal Modifier channels are layered exactly once to produce the canonical runtime range.

Conditions that force a fixed Speed remain a Combat/Condition runtime concern; they must not rewrite the persistent Character baseline.

## Breakdown rule

Breakdowns are generated from the same values used by the result. They are explanatory output, not additive caches that a consumer should re-sum into the Character.

For Ability modifiers the resolver records incremental modifier deltas after each Score source, avoiding the common error of converting every +Score source to a modifier independently and then adding them twice.

## Compatibility surfaces

`derived-stats-runtime.js` provides adapters for:

- `LuminousPlayerStats`
- `LuminousDmPlayerDndStudio`
- `LuminousNpcStats`
- `CombatEngine`

Existing UI-specific code can remain while migration is incremental, but externally exposed Score/Modifier/OFF/DEF values must match the canonical snapshot. #599 may later consolidate redundant fallback implementations after this behavior is frozen by tests.

## Persistence boundary

Derived Stats is read-only. Persistent save ownership belongs to #591.

Do persist:

- Base Scores.
- Race/Class/Background/Archetype identity and choices.
- user selections that cannot be reconstructed.
- explicitly persistent Character state.

Do not persist as source-of-truth from this resolver:

- Ability Mods.
- effective OFF/DEF/Speed calculations.
- UI breakdowns.
- Trait Engine caches.
- Action Economy / Encounter state.
- temporary Trait/Status modifiers.

## Regression gate

Focused gate:

```bash
npx playwright test tests/derived_stats.spec.js tests/racial_stat_integration.spec.js tests/player_stat_modifier_tooltip.spec.js tests/universal_modifier_engine.spec.js --workers=1
```

The matrix covers:

1. Human 10 + racial 1 remains 11 after reload.
2. DM base editing remains separated from effective Score.
3. Player/DM/NPC/Combat share Ability Modifier semantics.
4. Runtime Traits do not rewrite base Scores.
5. Multiclass does not implicitly change Ability math.
6. Tooltip breakdown equals the actual modifier.
7. Legacy stored racial breakdown normalizes before calculation.
8. NPC and PC share Score -> Modifier semantics.
9. OFF/DEF/Speed use one base plus Universal Modifier channels.
10. SP does not gain an invented Max formula.
