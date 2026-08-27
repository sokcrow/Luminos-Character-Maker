# Scene Time v1

Tracked by GitHub Issue #584.

## Goal

Use one diegetic world clock for Theatre, Combat and world systems so elapsed time is deterministic and does not depend on real-world waiting or DM memory.

## Canonical World Time

- Reuse `campaña/calendario`; do not create an independent clock.
- Preserve second precision internally even if the visible HUD only renders hour/minute.
- World-time mutations must be authoritative and idempotent: the same event must not be applied twice because of client retries or concurrent listeners.
- OOC never advances world time.

## Combat Time

- One completed combat round advances World Time by exactly **6 seconds**.
- Ten completed rounds equal exactly **60 seconds**.
- Time advances once per round, never once per actor turn.
- Dialogue and thoughts made during combat occur inside the round window and must not add extra seconds.

## Theatre intervention timing

| Intervention | Scene-time rule |
| --- | --- |
| OOC | 0 s |
| Thought (`pensamiento`) | 1 s fixed |
| DM narration (`narracion`) | 2 s fixed regardless of text length |
| Dialogue (`dialogo`) | estimated speech duration; default `max(2, ceil(words / 2.5))` |
| Instant action | 1–2 s |
| Normal action | 3 s |
| Full action | 6 s |
| Long/complex action | explicit duration |

Character limits are guardrails, not clocks. Default trial values from #584 are approximately 280 characters for dialogue, 200 for normal actions and a lower combat-dialogue cap.

## Concurrency rule

Simultaneous activities use **MAX, never SUM**.

For one actor:

```text
effective window = MAX(physical action, speech, thought)
```

The same rule applies across actors participating in the same scene interval. A 10-second action and a concurrent 4-second action consume a 10-second interval, not 14 seconds.

## Action Instance

`ACTUAR` creates a persistent action instance. While it is active the same actor cannot start another physical action, but may still speak, think or use OOC.

Conceptual shape:

```js
{
  schemaVersion: 1,
  actionId,
  roomKey,
  actorId,
  description,
  status,
  durationSeconds,
  remainingSeconds,
  startedAtWorldTs,
  check: {
    required: false,
    timing: "after",
    allowed: [],
    dc: null
  },
  result: null
}
```

Required statuses include `active`, `resolution_pending`, `resolved`, `cancelled`, `interrupted` and `impossible`.

The timer is scene time, not `Date.now()`. Real-world waiting, AFK or disconnecting must not complete the action.

## DM controls

The DM must be able to see actor timers and, per action instance:

- increase/reduce duration;
- complete manually;
- cancel/interupt;
- mark impossible;
- attach a Check;
- inspect remaining/consumed time.

The player only needs to see their current action, remaining time and whether `ACTUAR` is locked.

## Checks

Reuse `js/theatre-check-coordinator.js`; do not introduce a second check engine.

A Check belongs to the concrete action instance. Example: pushing a box may let the DM authorize either `STR` or `Athletics` with a DC. By default the Check resolves after the action duration is consumed; `checkTiming: before` is available when the roll determines whether the action may begin.

A failed Check does not refund elapsed time.

## Theatre ↔ Combat

There is only one clock source.

- Entering Combat disables independent Theatre-time advancement.
- Combat advances time by six-second round deltas.
- Actions that can continue during combat consume those same round deltas rather than adding another timer.
- Suspended/reanudable actions retain `remainingSeconds` when transitioning back to Theatre.

## Identity regression

`ACTUAR` currently has a regression where viewers who know the actor can still receive `(??? hace esto)`.

Identity must be resolved from **Actor + Viewer + knowledge/reveal state**, never from message type.

- Self always knows self.
- DM resolves the canonical actor.
- A viewer who has discovered the actor sees the known identity.
- An unknown viewer sees `???`.
- `ACTUAR` may remain without a Theatre nameplate while still retaining the correct actor identity in text/log/timer/check data.

This must reuse the same viewer-scoped identity resolution used by the rest of Theatre rather than introducing another action-specific resolver.

## Merge gate

The PR implementing this contract is mergeable only when:

1. `npm test` is green.
2. New Scene Time tests cover world-time precision, 10 rounds = 60 s, intervention costs, concurrency/MAX semantics, action locking, action persistence, cancellation/interruption, check linkage and Theatre/Combat transition.
3. Regression tests prove known actors do not render as `???` in `ACTUAR`, while genuinely unknown actors still do.
4. Firebase retry/concurrency tests prove one event cannot advance World Time twice.
5. Manual smoke test with DM + at least two player viewers confirms viewer-scoped identity, independent actor timers and simultaneous actions.
6. No pre-existing Theatre, Combat, Weather or check-coordinator regression remains.

Until all gates pass, the implementation PR remains Draft and must not be merged to `main`.
