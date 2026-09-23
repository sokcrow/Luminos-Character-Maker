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
