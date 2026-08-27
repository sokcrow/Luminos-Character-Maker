# Canonical Content Registry v1

Tracked by GitHub Issue #590.

## Purpose

Luminous content identity must be stable across localization, display-name changes, imports, legacy saves, and module load order.

The Registry identifies and validates content. It does **not** execute mechanics and it does not replace specialized catalogs.

## Canonical identity

The v1 full canonical key is:

```text
<type>:<local-id>
```

Examples:

```text
class:bard
race:human
background:nest_heir
archetype:college_of_whispers
trait:rage
skill:athletics
spell:test_spell
status:bleed
language:common
subrace:dragonborn:red
```

The Issue examples using dotted names are conceptual. V1 deliberately uses `:` because Firebase Realtime Database forbids `.`, `#`, `$`, `[`, `]` and `/` in keys, while `:` is permitted.

Existing catalog-local IDs such as `bard`, `human`, `rage` and `college_of_whispers` remain valid local IDs. The Registry qualifies them with a content type instead of performing a destructive repository-wide rename.

## Rules

1. **Display name is never identity.** A localized or renamed `name` cannot change a canonical ID.
2. **Every new Core definition must declare an explicit ID.** The Registry never creates canonical identity from `name`, `nombre`, translated text, capitalization, accents, or script order.
3. **Type is part of identity.** `race:goblin` and `language:goblin` are different entities.
4. **Duplicate canonical IDs fail visibly.** A second source cannot silently replace an existing definition.
5. **Aliases are compatibility only.** An alias resolves to one canonical ID; it is not a second persistent identity.
6. **Persistent references should move toward canonical IDs or explicit local ID + known type.** Never persist localized display text as the authoritative identity for new data.
7. **Mechanics remain in their owner modules.** Registry lookup does not execute Traits, Skills, Spells, Statuses, Classes, Races, or Items.

## Local ID policy

A local ID:

- is explicit;
- is lowercase ASCII;
- starts with an alphanumeric character;
- may contain `a-z`, `0-9`, `_`, and `-`;
- may contain `:` only as a hierarchy separator inside the local ID;
- must not contain Firebase-forbidden key characters.

Examples:

```text
human
half_elf
college_of_whispers
dragonborn:red
bard:college_of_whispers
```

A contributor must not run a display name through a slug function and treat the result as a new canonical identity.

## Registry API

`js/content-registry.js` exposes `LuminousContentRegistry` in the browser and CommonJS in tests.

Primary operations:

```js
registry.register({ type, id, name, sourceKey, definition, aliases })
registry.registerCatalog(type, catalog, options)
registry.registerAlias(type, legacyId, canonicalTarget)
registry.resolve(type, idOrAlias)
registry.get(type, idOrAlias)
registry.get("race:human")
registry.list({ type, source })
registry.validateReference(reference, expectedType)
```

`canonicalId(type, id)` constructs the qualified key only from an explicit type and explicit local ID.

## Existing catalogs

`js/content-registry-bootstrap.js` is the compatibility boundary for existing catalogs. It can register current definitions without changing their mechanics or storage schemas.

Initial adapters cover:

- Classes, Races, Subraces and Backgrounds from `character-build-rules.js`;
- Core Traits from `trait-catalog-core.js`;
- Archetypes and Archetype Traits from `archetype-trait-catalog.js`;
- D&D in-world Languages when `language-catalog-engine.js` is available;
- the existing Status registry when available;
- Skill, Spell, Item and Equipment catalogs when those modules expose definitions through a catalog object.

Specialized catalogs remain authoritative for their mechanical definitions. The Registry is authoritative for cross-module identity and collision/reference validation.

## Legacy aliases

Legacy values may be mapped explicitly:

```js
registry.registerAlias("class", "Bard", "class:bard");
registry.registerAlias("race", "Humano", "race:human");
```

The bootstrap may opt into display-name aliases for an existing catalog only as a migration bridge. These aliases are not permission for new code to persist translated names.

Alias normalization is intentionally more permissive than canonical ID creation so old values with spaces/accents can be found. This behavior must remain confined to legacy resolution.

## Localization boundary

Localization consumes identity; it never creates it.

```text
race:human
   ├─ es-419 -> Humano
   ├─ en     -> Human
   ├─ ko     -> future label
   └─ ja     -> future label
```

All four labels refer to the same canonical record. `labelKey`/localization keys are presentation metadata and do not participate in Registry identity.

This is the required boundary for #596.

## Persistence boundary

For new schemas, prefer storing canonical IDs or fields whose type is explicit and whose value is a canonical local ID. Migration code may accept aliases, but canonical save/re-save should not regenerate an ID from visible text.

This is the required identity foundation for #591.

## Existing local normalizers

The repository contains historical `normalizeId()`/slug helpers in several runtimes. They remain as compatibility behavior until their owning domains are consolidated safely.

From this contract forward:

- they may normalize already-identified runtime values for legacy compatibility;
- they must not be used to invent the identity of a new Core definition from a display name;
- new cross-module identity/ref validation should use `LuminousContentRegistry`;
- removal/consolidation of redundant normalizers belongs to the preserve-behavior work in #599, after regressions exist.

## Collision policy

Registering two distinct definitions under the same full canonical ID is an error, even when they come from different sources.

Two entries may share a visible name if their IDs differ:

```text
trait:source_a_echo -> "Echo"
trait:source_b_echo -> "Echo"
```

This prevents display names from becoming accidental global identifiers.

## Definition checklist for new Core content

Before adding a new definition:

- choose an explicit stable local `id`;
- identify its `type`;
- keep `name`/localized label separate;
- register it directly or through the owning catalog adapter;
- add aliases only for known legacy identifiers;
- validate cross-references by canonical ID/type;
- do not silently overwrite a collision;
- do not regenerate the ID when saving.

## Regression gate

Focused contract:

```bash
npx playwright test tests/content_registry.spec.js --workers=1
```

The dedicated CI workflow also runs the complete repository regression suite because this contract is a P0 dependency for Persistence and Localization.
