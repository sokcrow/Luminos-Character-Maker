# VTT World Objects v1

World Objects are persistent environmental instances placed on a map. They are separate from reusable Object Definitions in the same way Actor Definitions are separate from Tokens.

## Canonical persistence

- Definitions: `campaña/estado_mundo/vttObjectDefinitions/<definitionId>`
- Instances: `campaña/estado_mundo/vttObjects/<mapId>/<instanceId>`

Both roots inherit the existing DM-only write rule on `campaña/estado_mundo`; authenticated clients can read them with the campaign.

## Definition vs instance

An Object Definition owns reusable visual, physical and affordance metadata: footprint, height, weight, HP, movement blocking, occlusion intent, cover/hide metadata and available interactions. A World Object Instance owns map position, Z layer, elevation, rotation and mutable state such as open, locked, destroyed and HP.

## Affordances

Behavior is capability-driven, not object-type-driven. Initial affordances are `movable`, `pushable`, `breakable`, `climbable`, `sittable`, `hideInside`, `cover`, `openable`, `searchable` and `lockable`.

Initial authoritative actions in DM Edit Mode are OPEN/CLOSE, LOCK/UNLOCK, PUSH, BREAK, ROTATE and DELETE. SIT, CLIMB, HIDE INSIDE, TAKE COVER and SEARCH are exposed by the capability model for later character/NPC action execution.

## Seed library

The first reusable library contains Chair, Utility Table, Wooden Crate, Industrial Locker, Storage Cabinet, Single Bed, Wood Barricade, Office Desk, Industrial Shelf, Large Dumpster, Cargo Container and Concrete Barrier.

## Movement and A*

A non-destroyed instance whose definition blocks movement participates in token occupancy. The integration wraps the canonical token collision resolver, so direct token drag and A* pathfinding use the same blocker query. Moving, pushing or destroying an object changes the live obstacle set without introducing a second navigation representation.

The initial editor rotates placed objects in 90-degree steps. Rectangular collision footprints rotate with those quarter turns, so a 2×1 table or barricade blocks 1×2 cells after a 90-degree rotation instead of retaining stale axis dimensions.

## Rendering and visibility

Objects render inside the existing VTT perception clip because the renderer integration inserts them before tokens in the canonical `drawTokens` stage. Custom image paths are supported with a glyph/box fallback. Height, occlusion, cover and hide metadata are stored now; height-aware LoS, partial cover and stealth resolution remain follow-up systems rather than being approximated in this PR.

## DM Object Library

`OBJECTS` becomes available in DM Edit Mode. The DM can search the seeded/custom definition catalog, click a definition then place it on the current floor, select and drag an instance, rotate/delete it, change supported state through affordance actions, or create a custom definition with stable ID, image/glyph, footprint, height, weight, HP, movement blocking and affordance toggles.
