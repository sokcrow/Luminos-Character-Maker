# Theatre Core v1 stabilization contract

Tracked by GitHub Issue #595.

## Goal

Theatre Core v1 is stable when the same persisted scene produces a deterministic, viewer-scoped presentation for:

1. DM.
2. Actor/self.
3. Player who knows the actor.
4. Player who does not know the actor.
5. Late joiner who did not receive the reveal.

This gate is intentionally preserve-behavior. It does not redesign Theatre UI, actor discovery, language rules, Scene Time, or the Check Coordinator.

## Identity

Identity is resolved from actor + viewer knowledge, never from message type.

- DM resolves canonical identity.
- Self never resolves as unknown to itself.
- Known viewers receive the permitted canonical identity.
- Unknown viewers receive `???`.
- A late joiner without viewer-scoped knowledge remains unknown even when another viewer was previously shown the identity.
- `ACTUAR` may hide its scene Nameplate, but hiding a Nameplate does not anonymize the action log for self/DM/known viewers.

The authoritative viewer-scoped knowledge store remains `campaña/teatro/conocimiento_identidad`.

## Visibility

Actor-library state, visible-stage state and viewer-local display preferences are separate concerns.

- Hiding the owner's own sprite is a local render preference.
- That preference must not remove the actor from Firebase or hide it for DM/other players.
- Reload/reconnect must reconstruct the same local preference and persisted scene.
- Clearing the visible scene may clear current stage state, but must not delete the actor library or identity-discovery history.
- Existing FIFO/LRU-visible-actor behavior remains unchanged.

## Message modes

The established intervention contract remains:

- `dialogo`: eligible for Nameplate.
- `actuar`: actor-bound action, no scene Nameplate by default, identity still viewer-scoped in action/log text.
- `pensamiento`: no Nameplate and does not replace actor identity data.
- `narracion`: no actor Nameplate; scene narration behavior remains isolated from actor ownership.
- `ooc` / system rows: no diegetic identity mutation.

Expression selection remains prepared until the intervention is published. Scene/background changes continue through the existing Theatre scene transition path.

## Checks

`js/theatre-check-coordinator.js` remains the primary Theatre Ability/Skill check route.

Scene Time Action Instances link to the existing `theatre_check_requests` / command / live flow. #595 must not introduce a second roller or independent random resolution path.

## Scene Time

#584 is implemented and closed. Theatre consumes its contract rather than creating another clock.

- One World Time source: `campaña/calendario`.
- Combat owns +6 seconds per completed round.
- Theatre interventions do not double-count time while Combat owns the clock.
- Continuing Action Instances consume those same world-time deltas.

## Reconnect / late join

Theatre reconstructs current scene/dialogue from Firebase subscriptions rather than from a private client-only copy.

Viewer-local preferences may be restored from local storage, but they cannot mutate shared visibility. Viewer-scoped knowledge remains scoped to the viewer who received it.

## Stabilization matrix

`tests/theatre_core_stabilization.spec.js` is the compact cross-system gate. It is intentionally complemented by the existing domain regressions:

- `tests/theatre_issue_511.spec.js`
- `tests/theatre_viewer_scope.spec.js`
- `tests/theatre_realtime.spec.js`
- `tests/player_theatre_regression.spec.js`
- `tests/theatre_check_coordinator.spec.js`
- `tests/theatre_intervention_ux.spec.js`
- `tests/theatre_special_languages.spec.js`
- `tests/theatre_special_language_enforcement.spec.js`
- `tests/scene_time_engine.spec.js`

## Merge gate

Focused gate:

```bash
npx playwright test \
  tests/theatre_core_stabilization.spec.js \
  tests/theatre_issue_511.spec.js \
  tests/theatre_viewer_scope.spec.js \
  tests/theatre_realtime.spec.js \
  tests/player_theatre_regression.spec.js \
  tests/theatre_check_coordinator.spec.js \
  tests/theatre_intervention_ux.spec.js \
  tests/theatre_special_languages.spec.js \
  tests/theatre_special_language_enforcement.spec.js \
  tests/scene_time_engine.spec.js \
  --workers=1
```

Then run the complete repository regression suite:

```bash
npm test -- --workers=1
```

#595 is complete when both gates are green and no production behavior had to be changed outside a demonstrated regression.
