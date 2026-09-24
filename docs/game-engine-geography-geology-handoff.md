# Game Engine · Geography + Geology V1 Handoff

## Scope

This pass extends the existing biome/elevation engine. It does not create a second world generator and does not expand the global hex map.

The canonical pipeline is:

`BiomeComposer -> LandformSystem -> GeographyField -> GeologySystem -> Ecology -> Terrain Semantics`

Temperate Hills is the primary validation biome, but the contracts are generic across the current biome profiles.

## Geography

The existing LandformSystem remains responsible for macroforms such as rolling ground, hills, ridges, mountains, dunes, mesas and cliffs.

GeographyField adds signed secondary relief on top of those macroforms:

- Shoulder: positive secondary rise around upland terrain.
- Gully: negative relief/depression that can collect moisture and change traversal.
- Saddle: a negative cut through broad ridge relief that creates a natural pass.

Signed relief is deliberately bounded. It adds legible terrain without replacing biome base elevation, zone transitions or hydrology.

All procedural non-coast ground now uses one continuous mesh sampled from `elevationHeightTilesAtWorld`. Physics uses that same function. Coast already had a continuous ground mesh and continues to use the same authoritative height sampler.

## Natural slope rules

The existing slope contract remains canonical:

- normal threshold: 24 degrees;
- difficult threshold: 34 degrees;
- maximum climb: 43 degrees.

Geography does not invent invisible walls. A naturally generated slope above the maximum climb is rejected by movement because of its actual geometry.

## Geology

Each local sector receives deterministic geology candidates derived from:

- biome/sector rockiness;
- hills/ridges/mountain/cliff landform weight;
- actual terrain slope;
- local ridge/rock ecology;
- hydrology and protected transition/spawn areas.

V1 physical feature types:

### Outcrop chain

A chain of large rock masses with physical colliders. It can block the direct route and require the player to go around the formation.

Outcrops are rejected when they overlap protected spawns, land transition corridors, forest walk corridors or water.

### Scree

A loose-rock field. It is traversable but registers an elliptical difficult-terrain zone at 0.5 movement multiplier. Small rocks are visual; the terrain penalty is semantic and shared by exploration/combat movement.

## Connectivity safety

Before a blocking outcrop is accepted, `geologyTraversalAudit` samples the sector on a coarse hidden navigation field.

The audit uses the same:

- continuous elevation;
- maximum natural climb angle;
- hydrology;
- candidate rock footprint.

Land anchors are the sector spawn and every currently valid land transition. An outcrop is kept only when all land anchors remain mutually reachable.

This does not guarantee a straight route. It guarantees an alternative route exists. The intended result is a local detour, not an accidental sealed map.

## Ecology integration

Geography now feeds ecology instead of remaining visual-only:

- gullies increase local moisture;
- shoulders increase exposed rockiness;
- saddles modestly expose rock;
- dense shrub thickets are generated as coherent clusters;
- those thickets use canonical difficult terrain instead of making every decorative bush slow movement.

Geology also reserves its physical outcrop footprint from ordinary tree/prop decoration so rocks do not become buried inside unrelated procedural clutter.

## Movement and combat

The hidden grid remains an internal sampling/navigation tool. Player and combat movement remain continuous.

Terrain semantics now have additional geology tags such as:

- `geology`
- `rock`
- `outcrop`
- `blocking`
- `scree`
- `difficult`

The continuous movement bridge can expose these tags to later combat AI and encounter systems.

## Deferred

This pass intentionally does not define:

- cover/concealment values;
- line of sight;
- tactical vantage/choke scoring;
- ambush rules;
- encounter anchors;
- climbing actions for otherwise non-climbable rock faces;
- caves generated procedurally from geology.

Those systems should consume Geography/Geology V1 rather than modifying terrain generation directly.
