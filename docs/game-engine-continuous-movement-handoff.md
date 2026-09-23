# Game Engine · Continuous Movement Handoff

## Canonical decision

Luminous uses a continuous world-space movement model.

The visible D&D-style combat grid is not part of player movement. The existing tile/grid data remains an internal world tool for biome and ecology sampling, navigation acceleration, terrain semantics and encounter analysis.

## Scale

- 1 map tile = 5 ft.
- 1 map tile = 1.5 world units in the current Forest Lab.
- Movement systems must convert world distance to feet; they must not count crossed cells.

## Exploration

Exploration is continuous and unbudgeted. A unit may walk, turn back, interact and roam without a turn movement allowance.

Exploration still obeys physical collision, locomotion and terrain speed. Difficult terrain changes real-time travel speed but does not create a turn budget outside combat.

## Combat

Combat movement is continuous and budgeted.

At turn start the movement runtime stores the unit's continuous origin and movement allowance in feet. Each committed path adds its traveled distance and terrain cost to the same turn budget. Endpoints are never snapped to tile centers.

A straight 5 ft path over normal ground costs 5 ft. The same path over canonical difficult terrain uses a 0.5 movement multiplier and costs 10 ft of movement allowance.

The tracker rejects paths that are blocked or exceed the remaining allowance without mutating the committed position.

## Hidden grid responsibilities

The hidden grid may:

- classify biome/ecology conditions;
- cache walkability and terrain semantics;
- accelerate pathfinding and encounter analysis;
- distribute procedural vegetation/rocks with seeded sampling;
- expose terrain tags such as difficult, water or hazard.

The hidden grid must not:

- force creatures onto tile centers;
- define combat adjacency by square neighbors;
- define flanking from opposite squares;
- render as a normal player-facing combat overlay.

Debug visualization may exist only as a developer surface and must default off.

## Terrain and geology integration

Future ecology/geology passes should publish movement semantics instead of writing combat rules directly.

Examples:

- dense shrub cluster -> tags include difficult -> 0.5 movement multiplier;
- impassable rock face -> walkable false;
- loose rock/scree -> terrain tag + movement multiplier;
- steep natural slope -> map elevation/slope system supplies its own penalty or traversal block;
- water/mud -> locomotion/hydrology supplies movement semantics.

This lets the same terrain affect exploration speed, combat movement budgets and later AI route planning without duplicating values.

## Continuous combat geometry

Creature positions are continuous XZ coordinates with footprint radii.

Range should be measured between continuous footprints. Flanking uses angular opposition around the target. `CombatGeometry.js` intentionally exposes geometry only; no final flanking threshold is frozen in this pass.

## Integration surface

- `WorldSpaceContract.js`: canonical scale and hidden-grid policy.
- `TerrainMobility.js`: terrain multiplier normalization; difficult terrain = 0.5.
- `ContinuousMovement.js`: path measurement and per-turn combat budget.
- `CombatGeometry.js`: footprint distance and angular opposition.
- `LuminousWorldMovementBridge`: Forest Lab adapter to authoritative terrain/collision data.
- `engine.session.combatMovement`: movement tracker available to later combat/AI systems.

## Deferred

This pass does not add encounter AI, cover/concealment, line of sight, final flanking thresholds, tactical anchors or new aggressive geology meshes. Those systems should consume this contract after biome/geology terrain semantics are expanded.
