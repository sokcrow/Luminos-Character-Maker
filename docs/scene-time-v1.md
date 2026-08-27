# Scene Time v1

Tracked by GitHub Issue #584 and implemented in PR #585.

## Goal

Use one diegetic world clock for Theatre, Combat and world systems so elapsed time is deterministic and does not depend on real-world waiting or DM memory.

## Canonical World Time

- Reuse `campaña/calendario`; do not create an independent clock.
- Preserve second precision internally even if the visible HUD only renders hour/minute.
- World-time mutations are authoritative and idempotent: clients submit Scene Time requests and the DM runtime transactionally applies them to `campaña/calendario`.
- OOC never advances world time.

## Combat Time

- One completed combat round advances World Time by exactly **6 seconds**.
- Ten completed rounds equal exactly **60 seconds**.
- Time advances once per round, never once per actor turn.
- Dialogue and thoughts made during combat occur inside the round window and do not add extra seconds.

## Theatre intervention timing

| Intervention | Scene-time rule |
| --- | --- |
| OOC | 0 s |
| Thought (`pensamiento`) | 1 s fixed |
| DM narration (`narracion`) | 2 s fixed regardless of text length |
| Dialogue (`dialogo`) | `max(2, ceil(words / 2.5))` |
| Instant action | 2 s |
| Normal action | 3 s |
| Full action | 6 s |
| Long/complex action | explicit duration |

Character limits are guardrails, not clocks: 280 characters for dialogue, 200 for actions and 100 for combat dialogue.

## Concurrency

Simultaneous activities use **MAX, never SUM**. One Scene Time delta decrements every active Action Instance by that same amount. Talking or thinking during an action therefore consumes the same interval rather than adding another independent clock.

## Action Instance

`ACTUAR` creates a persistent Action Instance. While active, the same actor cannot start another physical action, but may still speak, think or use OOC. Real-world waiting, AFK or disconnecting does not complete the action.

The DM HUD exposes remaining time and controls to adjust duration, complete, interrupt, mark impossible, advance to the next event and attach/resolve a Check.

## Checks

Checks are attached to the concrete Action Instance and reuse `js/theatre-check-coordinator.js`. Scene Time uses canonical check ids such as `str` and `athletics`. By default the Check resolves after the action duration; `before` timing is supported. Failure never refunds elapsed time.

## Theatre ↔ Combat

There is one clock source. Entering Combat changes the Scene Time mode; round-end events advance six seconds and consume any continuing action timers using those same deltas. Theatre dialogue/thought/narration does not add time while combat owns the clock.

## Identity regression

`ACTUAR` identity is viewer-scoped: self, DM and viewers who know the actor see the canonical name; unknown viewers see `???`. The runtime repairs legacy `(??? hace esto)` rows without globally rewriting the message payload or leaking a multi-word canonical identity.

## Security / authority

- Non-DM clients may submit Theatre events only for the actor assigned to their authenticated player record.
- Non-DM clients cannot submit arbitrary time advances, combat rounds or DM controls.
- Only the DM runtime writes `campaña/calendario`.
- Event IDs are retained in a bounded processed-event ledger to prevent duplicate Firebase retries from advancing time twice.

## Merge gate

The implementation is mergeable only when:

1. `npm test -- --workers=1` is green.
2. The 27 Scene Time contract regressions are green.
3. Theatre intervention, viewer-scope, check-coordinator and weather integration regressions are green.
4. Syntax checks pass for the new runtime and loaders.
5. No unresolved PR review thread or failing required GitHub check remains.

The workflow `.github/workflows/scene-time-v1.yml` enforces the automated portion of this gate.