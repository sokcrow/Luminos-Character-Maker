# Summon Rules

Summons are targetable combat units created by spells or effects.

## Max HP

Unless a spell explicitly overrides it:

```
Summon Max HP = max(10, 10 × Summoner's Spell Mod)
```

The Summoner's Spell Mod is captured from the spell that created the Summon.

## Spell ownership

A Summon keeps references to:

- its Summoner,
- the spell that created it,
- the Summoner's Level,
- the Summoner's Spell Mod.

Spell-specific Skills may scale from those captured values.

## Background Units

Background Units are a separate entity type. They do not inherit Summon HP or targetability unless their spell explicitly declares them as Summons.

Current examples:

- **Infestation** — Summon.
- **Bonfire** — Summon.
- **Produce Flame** — Background Unit.
