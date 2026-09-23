# Luminous Game Engine Lab

This directory is the isolated runtime lane for the new Game Engine.

## Boundary

The Game Engine must be able to run without the full Character Maker UI.

- `game-engine/src/` owns engine contracts and adapters.
- Existing Luminous modules remain the canonical source for systems that already exist.
- Luminous may call the Game Engine through bridges/adapters.
- The Game Engine must not import Character Maker screens or DOM-specific player/DM UI.
- New features should be testable in the local Lab before being wired into the production UI.

## First integration slice

The first slice intentionally stays small:

1. one local Player;
2. Game Engine lifecycle;
3. DM Director command surface;
4. adapter to the existing Item Runtime / Inventory Runtime;
5. browser asset cache contract for remote sprites;
6. local desktop Lab.

Belle / Party, full Combat, networking, urban authoring and the final Inventory UI are deliberately outside this first slice.

## Existing systems reused

PR #777 already contains canonical item infrastructure, including:

- `js/item-runtime-engine.js`
- `js/item-inventory-runtime.js`
- item catalogs and composition engines
- `js/item-economy-standard.js`

The Lab does not replace these. `LuminousItemsBridge` wraps them so the Game Engine does not need to know their global names everywhere.

The repository also already contains a substantial VTT runtime under `js/vtt/`. The new Game Engine folder must not duplicate that code blindly; world/render/movement pieces will be migrated or bridged incrementally after their contracts are identified.

## Continuous world movement contract

Combat and exploration now share one continuous world-space contract (`luminous-continuous-world-v1`):

- the player-facing grid is hidden and never snaps movement endpoints;
- the existing grid remains internal for biome/ecology sampling, navigation caches, terrain semantics and later encounter analysis;
- exploration remains free continuous movement, constrained by collisions and terrain speed rather than a turn budget;
- combat movement is measured in feet along the traveled path from the turn origin;
- the current world scale is 5 ft per tile and 1.5 world units per tile;
- difficult terrain uses a 0.5 movement multiplier, so crossing 5 ft consumes 10 ft of combat movement;
- creature placement uses continuous XZ coordinates plus a footprint radius;
- flanking foundations use continuous angles around a target rather than opposite grid squares.

The reusable contracts live under `game-engine/src/world/`. The Forest Lab exposes `LuminousWorldMovementBridge` so the engine can sample the authoritative map terrain without replacing `BiomeComposer`, the compiled grid, colliders or elevation.

See `docs/game-engine-continuous-movement-handoff.md` for the integration boundary and the intentionally deferred combat rules.

## Geography + Geology V1

The procedural biome lane now composes physical terrain in this order:

`BiomeComposer -> LandformSystem -> GeographyField -> GeologySystem -> Ecology -> Terrain Semantics`

- `GeographyField` adds signed secondary relief: shoulders rise, gullies/depressions lower terrain and saddles cut natural passes through broad ridges.
- Procedural non-coast sectors render one continuous ground mesh from the same height function used by physics. The player no longer walks on a flat hidden plate beneath visual hills.
- `GeologySystem` generates deterministic outcrop and scree candidates from biome relief/rockiness, then accepts blocking outcrops only while land anchors remain connected.
- Accepted outcrop chains use physical colliders and force local detours. Scree is traversable but canonical difficult terrain (0.5 movement multiplier).
- Ecology consumes geography: gullies retain more moisture, exposed shoulders increase rockiness, and coherent shrub thickets can become difficult terrain rather than decorative scatter.
- The global hex map is unchanged. The current validation target is the existing Temperate Hills region so biome depth is proven before expanding world size.

The route audit is a build-time safety contract, not player-visible pathfinding. It protects sector spawn/land transition connectivity while still allowing local rock walls, steep slopes and formations that must be walked around.

See `docs/game-engine-geography-geology-handoff.md`.

## Biome Validation V2

The seven current global regions now share an explicit runtime validation contract:

- `gNW` Costa Boscosa
- `gN` Paso Frío
- `gNE` Crestas Nevadas
- `gC` Colinas Templadas
- `gSW` Bosque Bajo
- `gS` Pradera de Robles
- `gSE` Costa Árida

`window.BiomeValidationV2` checks the current biome in its local `owC` sector for physical relief, required signed geography, generated geology, readable geology placement, route connectivity, hidden-grid policy, coast land/water coexistence and forest corridor generation.

The validation is profile-aware. Dune/mesa desert regions are not required to generate shoulder/gully/saddle features merely to satisfy a generic counter; their macroforms remain the geography source. Forest and coast regions receive additional ecosystem/hydrology checks.

QA can boot a specific current region directly:

`?qa=procedural&region=gNW`

See `docs/game-engine-biome-validation-v2.md` for the matrix and acceptance rules.

## Run locally on Windows

From this folder, double-click:

`START_LAB.bat`

or run:

```
node lab-server.mjs
```

Then open:

`http://localhost:7777/game-engine/lab/`

The static server serves the repository root so the Lab can exercise the real PR #777 item modules.

## Development rule

A change intended for the Game Engine should have a local-Lab path first, then a Luminous adapter path. This keeps local and online integration from becoming two different engines.
