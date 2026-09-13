# Canonical Combat v0.7.3 cutover

## Authority

`alpha-v0.7.3-combat-engine-1.html` is the canonical combat surface and rules/presentation reference for the current cutover. `js/combatEngine.js` and the `battle-viewer-*073/074` bootstrap/planner stack are legacy and must not remain runtime authorities after the cutover.

## Shared systems retained

The cutover does not delete shared domain services. In particular, Status remains centralized in `js/status-library.js` + `js/status-engine.js`, with condition/elemental/fixed-damage bridges kept as shared services. Traits, spells, items, skills, action economy, unit catalogs and character runtimes remain reusable domain services unless a direct dependency audit proves they are only a Battle Viewer adapter.

## Firebase namespace

New combat state lives under `campaña/combate_v073` so the canonical runtime is not coupled to legacy `campaña/combate` ownership/planner data.

- `session`: active flag, encounter id, phase, round, background.
- `combatants/{combatantId}`: canonical unit/sprite/runtime data selected by the DM.
- `views/{uid}`: per-player combatant identity, visible combatants, camera state and UI permissions.
- `plans/{round}/{combatantId}/{slot}`: player planning commands.

Only the lightweight `session` subscription may stay alive while combat is inactive. Combatant/view subscriptions and the WebGL requestAnimationFrame loop must be detached/stopped outside an active combat session.

## Per-player presentation contract

A player view may define:

```json
{
  "playerCombatantId": "player:example",
  "visibleCombatantIds": ["player:example", "enemy:1"],
  "camera": { "mode": "player", "focusId": "player:example" },
  "ui": { "showRootMenu": true, "readOnly": false }
}
```

The DM receives an unrestricted/full-field view. Players receive only the presentation state authorized for their UID. Camera and menu visibility are presentation data; combat truth stays in the shared encounter/combatant state.

## Lifecycle requirement

The canonical WebGL renderer in the alpha uses `requestAnimationFrame`. Integration must start it only when `session.active === true` and stop it when the session becomes inactive, the iframe is hidden/unmounted, auth changes, or the WebGL context is lost. Firebase listeners follow the same lifecycle.

## Removal rule

Legacy files are deleted only after no production HTML, shared runtime, class runtime, test harness or Firebase rule references them. New canonical smoke tests replace deleted Battle Viewer 0.7.4 adapter tests.
