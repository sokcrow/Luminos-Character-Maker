# Character Persistence Schema v1

Tracked by GitHub Issue #591. This document describes the v1 persistence boundary and migration core.

> Status: #587 (Derived Stats v1) is complete. The persistent-vs-derived contract below is now validated against the canonical `LuminousDerivedStats` resolver. Live creation/load integration remains a separate close gate for #591.

## Purpose

Character persistence must have one explicit boundary:

```text
raw save
  -> detectVersion()
  -> migrate(vN -> vN+1 ...)
  -> normalizeCanonicalCharacter()
  -> validateCanonicalCharacter()
  -> Character Core/runtime
```

The migration layer accepts legacy data. New systems should not add more local fallback logic when a legacy shape can be handled here.

## Schema version

Current version:

```js
schemaVersion: 1
```

A v1 character contains a canonical `characterBuild` alongside existing compatible user data. The v1 migration is intentionally non-destructive because the current `campaña/jugadores/*` record also contains data used by economy, UI, Theatre links and other live systems.

```js
{
  schemaVersion: 1,
  characterIdentity: {
    characterId: null,
    name: "Aster"
  },
  characterBuild: {
    raceId: "human",
    raceSubtypeId: null,
    backgroundId: "nest_heir",
    classes: [
      { classId: "bard", levels: 15 }
    ],
    archetypes: [
      {
        classId: "bard",
        archetypeId: "college_of_whispers",
        selectedAtClassLevel: 15
      }
    ],
    baseStats: {},
    racialStatChoices: [],
    milestoneSelections: [],
    traitSelections: [],
    skillSelections: [],
    spellSelections: []
  }
}
```

Typed fields use the canonical local IDs established by #590. The field supplies the type (`raceId`, `classId`, etc.), so `human` is the local form of `race:human` and `bard` is the local form of `class:bard`.

## Compatibility strategy

V1 does not rewrite the entire Firebase player record into a new nested object. Migration starts from a clone of the raw document, adds/replaces the canonical persistence fields, and preserves unrelated existing fields.

This matters because a player node currently mixes Character data with other persistent user data. Unknown fields are therefore preserved rather than silently deleted.

Legacy fields such as `originId`, `clase`, `backgroundId`, `humanPerks`, finance data and other existing values remain available to old consumers during the transition. Canonical consumers read from `characterBuild`.

## Legacy aliases

Identity migration consumes #590's `LuminousContentRegistry`. A small explicit alias table exists only for legacy creation IDs whose current equivalent is verified in repository catalogs:

```text
humano              -> human
centauro             -> centaur
goliat               -> goliath
hada                 -> fairy
semi_dragon          -> half_dragon
yuanti_pura_sangre   -> yuan_ti_pureblood
```

Class display names such as `Bárbaro`, `Bardo`, `Clérigo` and `Mago` resolve through the explicit display-name compatibility aliases registered by #590.

An old ID without a proven equivalent is not guessed. Example: an older Background ID that does not exist in the current canonical Background catalog remains in the raw-compatible field, canonical `characterBuild.backgroundId` becomes `null`, and migration emits `UNRESOLVED_LEGACY_CONTENT_ID`.

For a document already claiming `schemaVersion: 1`, an unknown canonical ID is an error (`UNKNOWN_CANONICAL_CONTENT_ID`) rather than a silent null conversion.

## Migrations

`js/character-persistence.js` contains the migration registry.

Rules:

- migrations are sequential;
- each migration must produce exactly the next schema version;
- running migration again on an already-current document is idempotent;
- no migration applies gameplay bonuses;
- the raw input is cloned as `rawBackup` before migration;
- a newer-than-client schema returns `UNSUPPORTED_FUTURE_SCHEMA` and no writable Character;
- migration failure never requires overwriting the original record.

The built-in migration is:

```text
v0 (no schemaVersion) -> v1
```

## Base vs derived state

#587 defines the canonical Derived Stats boundary. Persistence keeps user choices and Base Stats; `LuminousDerivedStats` reconstructs effective Scores, Ability Mods, HP, OFF/DEF, Speed and other deterministic derived values.

V1 strips the following unambiguously runtime/derived caches from the canonical save:

```text
abilityMods
abilityModifiers
derivedStats
statBreakdown
statBreakdowns
traitEngineCache
runtimeCache
actionEconomy
encounterState
combatRuntime
uiBreakdown
uiState
```

Inside `characterBuild`, the denylist is:

```text
effectiveStats
derivedStats
abilityMods
breakdowns
runtime
cache
```

The migration deliberately does **not** remove ambiguous compatibility fields such as inventory, equipment, statuses, finance, actor links or unknown extensions. Existing top-level effective/cache-shaped fields that old consumers still need may remain as compatibility data, but `characterBuild.baseStats` is the canonical source for Derived Stats and those compatibility fields must never be treated as Base Stats.

Persistence does not calculate racial bonuses, Ability Mods, OFF/DEF/Speed, HP, or any other derived value. It preserves `baseStats` and user choices. Regression coverage with #587 verifies that saving/reloading a Human Base 10 remains Effective 11 rather than becoming 12.

## Firebase adapter

`js/character-persistence-firebase.js` provides a mechanics-free adapter:

```js
readCharacter(ref)
saveCharacter(ref, character)
migrateCharacterRef(ref, { backupRef })
modifyAndSave(ref, modifier)
```

Writes always run `prepareForSave()` and validation first. A failed migration or future schema performs no write.

For an in-place legacy migration, callers may provide `backupRef`; the raw record is written there before the canonical replacement. If backup writing fails, replacement is not attempted.

Reading does not auto-write. This avoids a page load silently mutating a player's only save.

## Audit of current live surfaces

### Character creation

`creacion_personaje.html` currently builds a legacy `luminousState` and writes it directly with:

```text
campaña/jugadores/<uid>.set(luminousState)
```

That live path does not yet pass through this module. It must be integrated before #591 closes so all new saves contain `schemaVersion`.

### Player load

`hoja_personaje.js` currently reads the player node, assigns `snap.val()` directly to `window.datosJugador`, caches it, and renders it. That live path also does not yet pass through the migration boundary.

It must be integrated before #591 closes so legacy input is normalized and validated before Character runtime/rendering.

### Character Manager / Actor data

`js/character-manager-engine.js` merges legacy and modern Actor roots and contains Actor/Theatre identity compatibility. Actor/Theatre state is not automatically promoted into Character Core. #591 should centralize Character persistence without erasing the separate Actor model.

## Required close gate for #591

Before this issue can be marked complete:

1. #587 must be complete and Persistence must remain regression-tested against its resolver. **Complete for this foundation.**
2. New Character creation must save through `prepareForSave()`/Firebase adapter and write `schemaVersion: 1`.
3. Player load must run migration/validation before Character runtime/rendering.
4. A validated migrated save must round-trip through load -> modify -> save -> reload.
5. Existing compatibility fields needed by live consumers must remain available or receive explicit adapters.
6. The focused Persistence suite and full repository suite must be green.

## Focused regression suite

```bash
npx playwright test tests/character_persistence.spec.js tests/character_persistence_derived_stats.spec.js --workers=1
```

The focused suite covers the mandatory #591 migration cases, including idempotence, legacy aliases, unknown canonical IDs, transient-data stripping, multiclass/Archetypes, backup behavior, future-schema safety, and the #587 Base/Effective no-double-application contract.
