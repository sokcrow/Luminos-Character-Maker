# Trait Engine V1

Trait Engine V1 is the shared rule layer for role/theatre checks and combat passives/actions. It is declarative: the DM defines Traits as data instead of writing JavaScript per Trait.

## Domain model

- **Trait**: permanent feature granted by class, race, background, lineage, item, or special source.
- **Effect**: atomic rule inside a Trait.
- **Status**: temporary state produced by rules.
- **Resource**: numeric pool/counter used by rules.
- **Grant**: progression rule that gives a Trait definition to a character.

A Trait Effect follows the same shape in every context:

`WHEN trigger` → `IF conditions` → `DO operations` → using a safe `VALUE/formula`.

## Level semantics

- `Level`: total character level.
- `ClassLevel`: level in the class that granted the current Trait.

For a level 30 character with Barbarian 20 / Fighter 10, a Barbarian Trait sees `Level = 30` and `ClassLevel = 20`.

## Activation modes

- `passive`: no player button.
- `automatic`: engine executes on its trigger.
- `manual`: player activates from the Trait Tray.
- `prompt`: a caller can ask the player Use/Skip when its event becomes relevant.
- `choice`: caller resolves a choice/preparation before activation.

Manual actions can consume `action`, `quick_action`, `reaction`, `special`, or no action cost, and can have formula-based use limits/reset scopes.

## Formula language

Allowed arithmetic: `+ - * / %`, parentheses, numeric constants and approved variables. Allowed functions:

`floor`, `ceil`, `round`, `abs`, `min`, `max`, `clamp`.

The parser does not use `eval` or `Function` and rejects unsupported tokens/functions.

## V1 event vocabulary

Role/Theatre: `before_check`, `after_check`.

Combat/runtime: `encounter_start`, `encounter_end`, `turn_start`, `turn_end`, `before_skill`, `after_skill`, `before_clash`, `clash_win`, `clash_lose`, `before_attack`, `on_hit`, `on_crit`, `on_kill`, `on_evade`, `attack_end`.

Rest/world: `short_rest`, `long_rest`, `day_start`.

Activation: `on_use`.

## V1 operations

- `modify`: generic numeric path modification (`add`, `multiply`, `set/override`, `min`, `max`).
- `resource`: `gain`, `spend`, `set`, `consume_all`; can store consumed amount for later threshold Effects.
- `apply_status` / `remove_status`.
- `heal_hp` / `heal_sp` / `gain_shield`.
- `set_flag` / `clear_flag`.
- `log`.

Additional skill/coin/deck-specific operations can be added later without changing the Trait schema.

## Theatre adapter

`resolveTheatreCheck({ character, traits, check, state })` dispatches `before_check` in `theatre` context and returns the modified check plus an auditable list of outcomes.

Example: Danger Senses checks `check.abilityId === "dex"` and performs `modify check.difficulty add -4`.

## Combat adapter

`dispatchCombatEvent(trigger, runtime)` sends a combat event through all Traits. Automatic effects use the same condition/formula/operation pipeline as Theatre.

Example: Devil Body listens to `turn_start` and heals `floor(DefensiveLevel / 2)`.

## Player execution

`listAvailableTraitActions` filters out passive/automatic Traits and returns only player decisions, including availability, action cost, uses remaining, target/input metadata, and blocking reasons.

`trait-player-tray.js` renders that contract into buttons. It never renders passive Traits as actions. Manual activation validates conditions, action economy, and use limits before dispatching `on_use`.

## Progression grants

`resolveTraitGrants(character, grants, catalog)` keeps definitions separate from progression. Class grants compare `atLevel` to the matching class level, while race/background/lineage grants match their own source IDs.

This lets one Trait definition be granted by different sources without duplicating its mechanics.

## DM Trait Builder V1

`dm-trait-creator.html` is a standalone visual authoring surface backed by `trait-builder.js`. It exposes source, contexts, activation, use formula/reset, Effects, conditions, and operations as fields/options, validates the resulting definition with Trait Engine, and can copy validated JSON or keep a local draft. It never accepts arbitrary JavaScript. Campaign/Firebase persistence can be wired after the data contract is accepted.

## Next integration step

The existing Theatre coordinator should pass its roll spec/check object to `resolveTheatreCheck` before a roll is armed. Combat should emit its existing lifecycle events into `dispatchCombatEvent`. After that, the DM builder can persist validated Trait JSON/grants in the campaign data and the player HUD can mount `trait-player-tray.js` in the chosen combat action area.
