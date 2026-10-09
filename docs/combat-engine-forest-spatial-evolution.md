# Combat Engine × Forest Spatial Evolution

## Objective

Evolve the current lightweight 2D Combat Engine into a spatial combat presentation that uses the Forest/Game Engine as the authoritative battlefield geometry **without replacing the combat rules runtime that already works**.

The migration must remain incremental:

- `CombatEngine` keeps responsibility for combat rules: Actions, Action Slots, Clash, Saves, Damage, Status, HP/SP, Skills, Spells, resources and round resolution.
- Forest/Game Engine owns world-space concerns: continuous position, terrain, collision, height, movement, camera, spatial queries and persistent areas.
- Existing player/DM HUDs and menus remain DOM/product UI unless a specific flow genuinely benefits from being spatial.
- 2D character/enemy art remains valid. Sprites are rendered as camera-readable billboards in the 3D world rather than requiring 3D character models.
- Forest must **not** remain as a hidden full 3D renderer permanently loaded behind the existing Battle Viewer.
- Debug/test controls must stay isolated from the normal Player/DM UI.

This PR is the workboard for the migration. Checklists below are the source of truth for what is preserved, adapted, replaced, deferred and tested.

---

## Current baseline

The current combat runtime is intentionally light because the battlefield presentation is primarily 2D DOM imagery.

Forest already provides useful foundations:

- continuous world-space coordinates;
- canonical scale of 5 ft per internal tile / 1.5 world units;
- terrain sampling and collision;
- difficult-terrain movement semantics;
- creature footprints/radii;
- Universal Unit Runtime for player, NPC, enemy, summon and creature roles;
- camera and occlusion behavior;
- mobile-aware Forest profiles;
- raycasting support in the rendered scene;
- continuous movement and distance helpers in the Game Engine lane.

The current Battle Viewer still has legacy assumptions that cannot simply be pointed at Forest:

- visual combatants are expected as DOM `.sprite-img` elements;
- Player Skill/Spell planners target through the current targeting matrix;
- AoE resolution still relies on `grid_pos`;
- nearest-target logic still relies on `grid_pos`;
- the Combat Engine may move an attacker toward a target during attack resolution;
- encounter placement stores 2D Battle Viewer coordinates;
- DM visual-readiness checks currently expect DOM sprites.

Those are migration points, not reasons to replace the combat rules engine.

---

## System disposition

| System | Status | Decision |
| --- | --- | --- |
| Clash / Damage / Saves | KEEP | Keep current combat resolution. Spatial runtime supplies geometry only when a rule needs it. |
| Status / HP / SP | KEEP | Preserve current runtimes. Spatial effects may query area/height/terrain but do not own Status logic. |
| Action Slots / round lifecycle | KEEP | Preserve current IDs, planning and execution order. |
| Firebase combatants / ownership | KEEP | Preserve canonical Unit/combatant identity and authorization. |
| Skills | ADAPT | Keep Skill rules; replace legacy range/AoE geometry with Forest spatial queries. |
| Spellcasting | ADAPT | Keep slots/classes/resources; add Unit, Ground Point, Direction and Area targeting contracts. |
| Menus / HUD / Inventory UI | KEEP | Keep as screen-space DOM product UI over the combat viewport. |
| 2D character/enemy sprites | ADAPT | Render as Forest billboards using existing sprite assets/states. No mandatory 3D models. |
| Player targeting matrix | ADAPT | Preserve Unit targeting compatibility; add spatial targeting modes rather than forcing everything through Unit -> Unit. |
| AoE via `grid_pos` | REPLACE | Replace with continuous world-space spatial queries. |
| `moveAttackerToTarget()` spatial authority | REPLACE | Combat resolution must not teleport/authoritatively reposition Units. |
| 2D encounter placement coordinates | REPLACE | Encounter spawn/placement becomes world-space position + footprint. |
| DM visual readiness = DOM sprite count | ADAPT | Accept Forest combat renderer readiness without fake hidden DOM sprites. |
| Full 3D models / skeletal animation | DEFER | Not required for spatial combat migration. |
| Full tactical AI/pathfinding rewrite | DEFER | AI can consume the spatial bridge later; not required for the first playable slice. |
| Shops/events as spatial scenes | DEFER | Useful future payoff, but not part of the first combat migration milestone. |

---

## Non-negotiable product rules

- [x] Existing Player/DM HUD concepts remain product-facing, not debug-facing.
- [x] Debug/test controls must be isolated behind a dedicated dev harness, route or explicit debug flag.
- [x] Internal IDs, vectors, JSON, collision state and raw spatial telemetry do not belong in the normal HUD.
- [x] Health/Status HUD remains camera-readable and does **not** rotate with a climbing/flying sprite.
- [x] 2D sprites remain a supported first-class visual format inside the 3D battlefield.
- [x] Forest is not silently kept as an always-running hidden renderer behind the legacy Battle Viewer.
- [x] Mobile is a first-class acceptance target; desktop-only success is not sufficient.

---

## Target battlefield contract

### Default exterior encounter

Initial standard for spatial tests:

- Standard active encounter footprint: **120 × 120 ft**.
- Encounter center to standard boundary: **60 ft**.
- Internal equivalent at current world scale: **36 × 36 world units**.
- No player-facing grid.
- Interior encounters are bounded by their actual physical environment instead of forcing a 120 × 120 ft arena.
- The boundary represents encounter participation/escape rules, not an arbitrary invisible wall.

The size remains provisional until real play/performance tests validate it.

---

## P0 — Lifecycle and performance

The first requirement is proving that spatial combat does not turn the lightweight combat runtime into a permanently running 3D workload.

- [ ] Define a `CombatSpatialBridge` lifecycle contract.
- [ ] Lazy-mount spatial combat only when an Encounter needs the Forest renderer.
- [ ] When an Encounter starts inside an already-active Forest scene, reuse that scene instead of creating a duplicate renderer/world.
- [ ] When spatial combat is launched from a non-Forest surface, load only the encounter viewport/runtime required for combat.
- [ ] Pause/dispose combat-only scene systems cleanly when the Encounter ends.
- [ ] Confirm no hidden second render loop survives Encounter cleanup.
- [ ] Confirm no duplicate Unit runtimes survive cleanup.
- [ ] Add explicit memory/resource cleanup for temporary combat areas/VFX.
- [ ] Establish desktop performance baseline.
- [ ] Establish mobile portrait performance baseline.
- [ ] Establish mobile landscape performance baseline.
- [ ] Stress test expected Unit counts before increasing visual complexity.

### Acceptance

- [ ] Entering and leaving combat repeatedly does not accumulate renderers, event listeners or Units.
- [ ] Non-combat pages do not pay the full Forest render cost merely because combat support exists.
- [ ] Spatial combat can be disabled/fallbacked without breaking the underlying combat resolver.

---

## P0 — Canonical Unit identity bridge

A combatant must remain the same logical Unit across rules, networking and spatial rendering.

- [ ] Map each canonical combatant to one Forest spatial Unit using the same stable Unit ID.
- [ ] Never create a second gameplay HP/Status authority inside Forest.
- [ ] Synchronize spawn/despawn with Encounter active/reserve state.
- [ ] Preserve ally/enemy/neutral faction metadata.
- [ ] Preserve summon/background Unit identity.
- [ ] Preserve creature footprint/radius.
- [ ] Define safe behavior for Abnormality Parts and other multi-part combatants.
- [ ] Verify reconnect/hydration restores spatial Units without duplicating them.

---

## P0 — CombatSpatialBridge API

The Combat Engine must not know about Three.js meshes, cameras or raycasters.

Initial bridge surface:

- [ ] `getUnitPosition(unitId)`
- [ ] `getUnitFootprint(unitId)`
- [ ] `distanceBetweenUnits(unitA, unitB)`
- [ ] `distancePointToUnit(point, unitId)`
- [ ] `unitsWithinRadius(point, radiusFt, options)`
- [ ] `unitsWithinCone(origin, direction, rangeFt, angleDeg, options)`
- [ ] `unitsWithinLine(origin, direction, lengthFt, widthFt, options)`
- [ ] `pickGroundPoint(screenX, screenY)`
- [ ] `canOccupy(unitId, point)`
- [ ] `createPersistentArea(definition)`
- [ ] `removePersistentArea(areaId)`
- [ ] `isUnitInsideArea(unitId, areaId)`
- [ ] area enter/exit event or deterministic transition query
- [ ] expose terrain semantics required by combat movement without exposing renderer internals

All measurements must use the canonical continuous-world contract rather than visible grid cells.

---

## P0 — Sprite migration

The first spatial combat version remains a **2D sprite game in a 3D environment**.

- [ ] Render existing combat sprite assets as Forest billboards.
- [ ] Preserve idle/current/guard/evade/other existing sprite states where available.
- [ ] Preserve facing behavior without requiring skeletal animation.
- [ ] Preserve visual scale independently from collision/footprint.
- [ ] Keep sprite readability across the supported camera range.
- [ ] Keep world sprite and screen-space HUD as separate transforms.
- [ ] Do not rotate HP/Status/Action HUD with world-surface orientation.
- [ ] Support occlusion behavior without making combatants unreadable.

### Surface orientation

- [ ] Grounded Units use normal upright billboard behavior.
- [ ] Flying Units carry an authoritative elevation/height state.
- [ ] Climbing Units can bind to a wall/tree/surface position and surface normal.
- [ ] Spider-like wall traversal may rotate/align the **world sprite or its surface rig** to communicate climbing.
- [ ] Screen-space HUD remains upright/camera-readable while the world sprite climbs.
- [ ] Transition between ground/fly/climb does not change the Unit's combat identity or HUD ownership.

---

## P0 — Camera

The camera must remain readable for 2D sprites while exposing enough depth to make spatial rules understandable.

- [ ] Reuse Forest camera foundations instead of creating a second independent combat camera stack.
- [ ] Define Combat camera profile separately from Exploration profile where needed.
- [ ] Preserve the largely fixed/readable presentation that works with 2D sprites.
- [ ] Allow enough parallax/depth to read front/back, elevation, flight and climbing.
- [ ] Keep camera behavior consistent on desktop and mobile.
- [ ] Ensure touch camera controls do not conflict with Skill/Spell targeting.
- [ ] Ensure ground-point spell targeting remains usable with the chosen camera angle.
- [ ] Validate wall/tree occlusion rules in combat.

---

## P1 — Targeting contracts

Unit targeting remains valid, but it is no longer the only targeting model.

- [ ] `unit`: target one or more canonical Unit IDs.
- [ ] `ground_point`: target a continuous world point.
- [ ] `direction`: origin + direction for line/cone effects.
- [ ] `area`: reference an existing persistent area when an action modifies/removes it.
- [ ] Preserve current Unit-target Skill/Spell planner behavior during migration.
- [ ] Add spatial target selection without exposing coordinates to the player.
- [ ] Show clear valid/invalid targeting feedback as product UI.
- [ ] Do not require the player to interact with hidden grid cells.

---

## P1 — Range, movement and adjacency replacement

- [ ] Replace `grid_pos` range checks with continuous footprint distance.
- [ ] Replace `findClosestHostile()` grid distance with spatial distance.
- [ ] Remove Combat Engine ownership of `moveAttackerToTarget()` positioning.
- [ ] Define melee reach from continuous footprints.
- [ ] Define ranged Skill/Spell range from continuous distance.
- [ ] Define adjacency through footprint/reach distance rather than square neighbors.
- [ ] Reuse continuous movement budget for combat.
- [ ] Reuse canonical difficult-terrain movement multiplier instead of approximating it as arbitrary Speed loss.
- [ ] Respect collision/blocked terrain during committed combat movement.
- [ ] Define forced movement through the spatial bridge rather than direct coordinate mutation.

---

## P1 — Persistent areas

Persistent areas are a core reason for the migration and must not use Attack Weight as a population cap.

- [ ] Canonical persistent-area record with ID, source, caster, shape, position, dimensions and duration.
- [ ] Radius area.
- [ ] Cone/line support where persistence is relevant.
- [ ] Terrain/visibility/status metadata as rule references, not duplicated rule engines.
- [ ] All geometrically affected Units are evaluated; Attack Weight does not cap environmental zones.
- [ ] Area remains fixed in world space unless the source explicitly says it moves.
- [ ] Unit enter/exit/turn-start/turn-end queries are deterministic.
- [ ] Area cleanup at duration end/Encounter end.
- [ ] Optional player-facing area visualization without debug telemetry.

### First spell pilots

- [ ] **Fog Cloud**: ground-point placement, persistent radius, inside/outside query, visibility-rule integration.
- [ ] **Grease**: ground-point placement, persistent terrain, initial/entry/turn-end Save hooks, difficult terrain.
- [ ] Verify Create/Destroy Water fog interaction against a real persistent Fog Cloud area.
- [ ] Use these pilots to validate that spell rules remain in the spell/runtime layer while geometry remains in the spatial layer.

---

## P1 — Flanking and elevation foundations

- [ ] Connect continuous `CombatGeometry` to combat Units.
- [ ] Validate footprint-aware distance.
- [ ] Define final flanking threshold separately from rendering.
- [ ] Validate flanking around large Units.
- [ ] Elevation is authoritative for flying Units.
- [ ] Define when vertical separation prevents melee/reach interaction.
- [ ] Define climbing adjacency/reach against ground Units.
- [ ] Keep Line of Sight/cover as later explicit rules rather than silently inferring them from visuals.

---

## P1 — Battle Viewer / Player UI adaptation

The goal is to keep the working combat UX while changing the battlefield renderer beneath it.

- [ ] Keep Skill menu as DOM/screen-space UI.
- [ ] Keep Spell menu as DOM/screen-space UI.
- [ ] Keep Action Slots as DOM/screen-space UI.
- [ ] Keep HP/SP/Status HUD as product UI.
- [ ] Preserve ownership/auth checks.
- [ ] Route Unit selection from Forest back into the existing planner contracts.
- [ ] Route ground-point/direction selection into new spatial plan payloads.
- [ ] Avoid exposing `x/y/z`, Unit IDs or area IDs to players.
- [ ] Adapt selection/hover feedback for touch.
- [ ] Ensure targeting mode cannot leave the HUD stuck/blocked after cancel.

---

## P1 — DM Viewer adaptation

- [ ] DM can observe the same spatial Encounter without requiring fake DOM combatant sprites.
- [ ] Replace `.sprite-img` count as the only visual-readiness proof.
- [ ] Accept explicit Forest Combat Renderer readiness.
- [ ] Preserve DM encounter controls and planning authority.
- [ ] Keep DM product UI separate from spatial debug tooling.
- [ ] Define observer camera behavior separately from Player targeting camera if necessary.
- [ ] Verify reconnect/late join receives correct Unit transforms and active persistent areas.

---

## P2 — Encounter placement and deployment

- [ ] Replace Battle Viewer percentage-like `x/y` placement with world-space encounter spawn anchors.
- [ ] Preserve Front/Mid/Back as optional deployment intent, not fake geometry.
- [ ] Resolve deployment intent into valid terrain positions.
- [ ] Respect collisions and footprint when spawning multiple Units.
- [ ] Define fallback placement when the desired region is blocked.
- [ ] Preserve reserves/backups without rendering inactive Units as active field Units.
- [ ] Validate interior encounters against actual room geometry.

---

## P2 — Mobile requirements

Forest already contains mobile-specific behavior; spatial combat must consume it rather than build a second mobile implementation.

- [ ] Reuse Forest mobile renderer/streaming profile where compatible.
- [ ] No desktop-only hover requirement for targeting.
- [ ] Touch Unit selection is reliable with billboard sprites.
- [ ] Touch ground-point placement is reliable and cancellable.
- [ ] Camera orbit/pan gestures do not conflict with spell/Skill gestures.
- [ ] Action/Spell HUD remains readable without crushing the viewport.
- [ ] No arbitrary "adaptive" compression that makes controls unusable.
- [ ] Validate portrait.
- [ ] Validate landscape.
- [ ] Validate low/medium mobile performance profile.
- [ ] Validate combat cleanup returns memory/render load to expected non-combat state.

---

## P2 — Test surfaces

Testing tools must not ship in normal Player/DM UI.

- [ ] Add dedicated spatial-combat test harness or explicit dev route.
- [ ] Harness can spawn canonical test Units without adding spawn buttons to production HUD.
- [ ] Harness can exercise grounded/flying/climbing Units.
- [ ] Harness can place radius/cone/line previews.
- [ ] Harness can run Fog Cloud and Grease pilots.
- [ ] Harness can test 6-Unit Standard Encounter.
- [ ] Harness can stress higher Unit counts.
- [ ] Automated smoke test for bridge lifecycle.
- [ ] Automated smoke test for stable Unit identity.
- [ ] Automated smoke test for radius membership.
- [ ] Automated smoke test for area enter/exit.
- [ ] Automated smoke test for cleanup/no duplicate spatial Units.
- [ ] Automated smoke test for mobile-safe target payload shape.

---

## Initial verification matrix

| Scenario | Desktop | Mobile portrait | Mobile landscape | Automated |
| --- | --- | --- | --- | --- |
| Mount/unmount spatial Encounter | [ ] | [ ] | [ ] | [ ] |
| 6 sprite Units render with stable IDs | [ ] | [ ] | [ ] | [ ] |
| Unit targeting | [ ] | [ ] | [ ] | [ ] |
| Ground-point targeting | [ ] | [ ] | [ ] | [ ] |
| 20 ft radius membership | [ ] | [ ] | [ ] | [ ] |
| Fog Cloud persistent area | [ ] | [ ] | [ ] | [ ] |
| Grease persistent terrain | [ ] | [ ] | [ ] | [ ] |
| Difficult terrain movement | [ ] | [ ] | [ ] | [ ] |
| Flying Unit elevation | [ ] | [ ] | [ ] | [ ] |
| Climbing Unit surface orientation | [ ] | [ ] | [ ] | [ ] |
| HUD remains upright/readable | [ ] | [ ] | [ ] | [ ] |
| Encounter cleanup / no leaked renderer | [ ] | [ ] | [ ] | [ ] |

---

## Deferred until the spatial foundation is proven

- [ ] Full character 3D models.
- [ ] Skeletal combat animation system.
- [ ] Large VFX library.
- [ ] Full tactical AI rewrite.
- [ ] Full line-of-sight/cover rules.
- [ ] Destructible terrain.
- [ ] Spatial shops/event scenes.
- [ ] Cinematic camera system.
- [ ] Network interpolation/prediction beyond what the first combat slice requires.

These are not blockers for the first spatial Encounter.

---

## First playable milestone

The first milestone is complete when all of the following are true:

- [ ] A Standard Encounter can run in a **120 × 120 ft** Forest-backed combat area.
- [ ] Two allied and four enemy canonical Units appear as 2D sprite billboards using stable combatant IDs.
- [ ] Existing HP/SP/Status and Skill/Spell/Action Slot UI remains usable.
- [ ] Existing Clash/Save/Damage resolution still works.
- [ ] Player can select a Unit target from the Forest battlefield.
- [ ] Player can place Fog Cloud on a ground point.
- [ ] Combat runtime can determine exactly which Units are inside Fog Cloud.
- [ ] Player can place Grease and terrain membership updates correctly as Units move.
- [ ] At least one flying Unit can occupy/read a non-ground elevation.
- [ ] At least one climbing Unit can bind visually to a vertical surface while its HUD remains upright.
- [ ] Encounter teardown leaves no duplicate renderer/Unit runtime behind.
- [ ] The same slice is usable on desktop and at least one mobile profile.

Until this milestone passes, do not expand scope into combat animation polish, shops, cinematic events or full tactical AI.
