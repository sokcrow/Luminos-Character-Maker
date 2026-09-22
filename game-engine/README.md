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
