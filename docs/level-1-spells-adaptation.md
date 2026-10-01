# Level 1 Spells Adaptation

This branch is the dedicated integration line for adapting D&D Level 1 spells into Luminous/Limbus combat and theater systems.

## Scope

- Add Level 1 spell definitions to the canonical spell catalog.
- Reuse the cantrip systems already merged into `main` where applicable.
- Add new reusable runtimes only when Level 1 spells require mechanics that do not already exist.
- Keep player-facing spell text compact; put complex behavior in statuses, runtime contracts, and tooltips.
- Prefer official 2024 spell behavior when an official revised version exists; otherwise use the latest official legacy version already established for the project.
- Preserve Luminous combat balance and existing Save, Clash, Unopposed, Concentration, Summon, Background Unit, Temporary Item, terrain, and status conventions.

## Integration rules

- New offensive spells should explicitly declare whether they resolve through Clash, Save, or Unopposed flow.
- Persistent effects should use existing Status Effects or reusable runtime state rather than one-off hidden flags.
- Concentration effects must clean up their dependent entities/statuses when Concentration ends.
- New summons use the shared Summon HP rule unless a spell explicitly defines another contract.
- Spell choices should use the generic `mechanics.requiresChoice` planner path where possible.
- Add smoke coverage alongside each implemented batch.

## Status

Cantrips are complete at 46/46 and merged to `main`.

Level 1 spell adaptation starts in this PR.
