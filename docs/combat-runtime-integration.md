# Combat Runtime Integration

This milestone connects canonical `CombatAction` definitions to round planning, Speed order, Clash interception and the existing combat resolver.

## Round lifecycle

`ON_TURN_START` → `PLANNING_PHASE_PLAYER` → `PLANNING_PHASE_AI` → `COMBAT_START` → `COMBAT_PHASE` → `COMBAT_END` → `ON_TURN_END`.

Speed and equal-Speed random placement are snapshotted at `ON_TURN_START` and remain frozen for the round. Normal Units share one Speed across every Action Slot. Abnormality Parts may provide their own Speed for the Actions belonging to that Part.

## Action ordering and Clash

Actions execute from highest frozen Speed to lowest. Equal-Speed sources use the random placement generated at turn start; no secondary stat or actor ID is a gameplay tie-breaker.

A Unit may force a Clash against an Action that is not targeting it only when its frozen Speed is strictly greater than the target Action's Speed. A Unit that is already the target may Clash regardless of relative Speed.

## Action Slots and team resources

Normal Actions require an `actionSlotId`. A slot cannot contain two unresolved Actions and a Unit cannot plan more Actions than its usable Action Slot count.

Quick Action and Help are once per side per round. Reaction is once per Unit per round unless the Unit exposes a higher reaction limit. When a TeamActionEconomy encounter is present it remains authoritative; otherwise the runtime keeps equivalent local budgets.

## Volley targeting

Focused targeting keeps every Coin on the focused target. If that target becomes unavailable during the Skill, remaining Coins are cancelled.

Unfocused Volley selects a target for every Coin. It avoids the previous target while another valid option exists; if only one valid target remains, subsequent Coins may continue hitting it. With Attack Weight greater than one, Unfocused Volley stays inside the originally marked target group and does not replace dead marked targets with outside targets. Indiscriminate expands the valid selection pool but never includes the Skill user.

## Cancellation

Stagger or another action-blocking state cancels every unresolved Action of the affected Unit. If it occurs during Coin-by-Coin execution, the current Action stops at that point; resolved Coins are not reverted.

A Clash that becomes unilateral because its opponent is already cancelled, unavailable or Staggered still validates and consumes the active Action's economy/resources before attacking.

## Grapple, Retreat and Escape

A successful Grapple cancels the target's unresolved Actions and locks exactly one Action Slot on both participants when TeamActionEconomy is available.

Retreat resolves at `ON_TURN_END`. With a backup it swaps to the next backup and the replacement inherits at most two Action Slots. Without a backup the Unit leaves `encounter.active` for the entire following round and returns for the round after that without being treated as a backup swap.

Escape resolves at `ON_TURN_END`, removes the Unit from active encounter play and sets `eligibleForXp = false`.

## Verification

`.github/workflows/combat-runtime-smoke.yml` runs schema, team economy, resolver, queue, lifecycle and runtime-rules smoke tests on every push to the integration branch and on pull requests to `main`.
