# Limbus — Downed / Combat interruption / AI + loot review contract

## Scope of this foundation PR (implemented)

1. **P0: 0 HP hard interruption** in both canonical CombatAction resolver and v0.7.3 incremental Coin/Clash/Guard/Evade route. Falling during bleed, counter, status or mid-action must prevent subsequent actions/effects. Preserve damage legitimately applied **before** the transition.
2. **P0: life states**. Players, Captain and Leader use existing 5-coin Death Saves (3 successes / 3 failures). These units stay **Downed** and targetable at 0 HP, but are unable to act. Normal Units die at 0 HP. Hard is a classification, not a fourth rank.
3. **P0: corpse eligibility**. Downed is **not** a corpse: exclude Downed Captain/Leader from postcombat loot until actual confirmed death. v0.7.3 emits `UnitDowned` instead of `UnitDefeated` for eligible 0 HP transitions.
4. **P0: AI planning**. Do not plan even an automatic Escape for actors unavailable at 0 HP.
5. Regression smoke tests for status-driven Downed, Captain/Leader, 0 HP loot eligibility, GOAP, direct resolver and v0.7.3 bleed/Coin interruption.

## Corrections from the first Codex review

- Real `CombatEngine.resolveUnilateralWithCounter` checks actor availability after Coin/status and event hooks, before damage and before later Coins or Counter scheduling. Fatal Bleed cannot land its own Coin in either resolver mode.
- Incremental Clash interruption cancels the incapacitated actor and resolves the survivor's remaining Coins unopposed against a legal target. It grants no synthetic Clash-win SP. Guard remains defensive.
- Kill variants require confirmed death. First knockdown of Captain/Leader fires no kill tags; later death fires them once.
- The live HP setter commits the real Downed/death transition before snapshots/events. Incremental damage, healing, round-end Death Saves, Retreat/return and both replacement paths now consume that state. Death at 0 HP emits UnitDefeated; Downed does not become a corpse or consume a reserve.
- Authority checkpoints, Firebase state and hydration signatures preserve life state and Death Saves, including changes while HP stays at zero. The shipped runtime is rebuilt from source; lifecycle script URLs refresh together.
- `tests/pr1042-real-downed-regression-smoke.mjs` exercises actual engine/resolver and production incremental rule functions, plus the deployment bridge and checkpoint serializer. The three Downed suites run in the combat live workflow.

## Follow-up work — explicitly NOT shipped as working features here

**P1: full combat life-state integration**
- One central `canAct` and `isTargetableFor(action)` contract for all execution paths, target selection, queued actions, reactions and statuses.
- Explicit persistent `alive -> downed -> stable/revived/retreated/dead` transitions; replay sync to DM/player Theatre and backups must never delete Downed.
- Reconciliation of `[On Kill]`, `UnitDefeated`, `UnitDowned` and `on_death` triggers; once-only dispatch; ensure old UI consumers react correctly. Audit eventual combat victory/defeat, reinforcement queues and encounter-end state.
- HP overflow / D&D massive damage policy **requires specification**; do not invent thresholds or change damage math in review.
- Per-actor queue cancellation/rollback: test already-sealed actions, remaining targets, save-based spells, status follow-up and redirected clashes, especially when the other clash participant can still act.

**P2: Robar during combat and GOAP logistics** (no transfer implemented yet)
- Add a proper CombatAction for **Robar** on an eligible Downed living target, with reach, visibility, action economy, contested roll/check, failed-attempt limits and theft entitlement validated on the trusted authority.
- Combat penalty proposal: +4 TH; waived with full Sleight of Hand proficiency. Existing postcombat unproficient +8 TH stays separate; reconcile before merging.
- Pick randomly among accessible item slots / coins; do not reveal a target's hidden inventory; use atomic transfer and idempotency to avoid duplication. Existing Search reveals to all and Sustraer postcombat randomly takes item or all coins; do not accidentally reinterpret either.
- Surviving escapees retain stolen items; stolen items should become retrievable if carrier later dies. Organ extraction from living creatures is **not** corpse-autopsy/pickpocket and needs its own hostile action/rule.

**P3: personality / morale / leadership GOAP**
- 20 extensible archetypes (assassin, skirmisher, looter, healer, protector, coward, opportunist, tactician, etc.), 0–100 trait intensities, motivations, morale, observation-based memory.
- **INT** controls option/search depth; **WIS** risk sensitivity; personality changes utility; **Captain** gives tactical coordination; **Leader** assigns squad tasks. Do NOT add arbitrary INT to a ranked creature.
- Command falls to the next active commander as soon as Captain/Leader becomes Downed. Respect faction knowledge and individual access; no omniscient inventory/HP reading.
- Normalize candidate utilities before weighting theft, kill, extraction and escape. Consider survival/risk and number of turn slots spent.

## Requested focused Codex review (do not auto-merge)

Please review the **implemented P0 diff** for correctness and regression before discussing P1–P3. Report issues with file/line references and proposed fixes:
1. **Fatal interruption**: no Coin, multi-target hit, Clash or auto-effect from a 0 HP actor; status/DoT killing actor during a roll, hit, counter or async presentation must interrupt at next safe checkpoint. Audit other unpatched legacy execution paths.
2. **Targetability distinction**: a Downed player/Captain/Leader stays in FIELD and can be healed, robbed or attacked when action rules allow, but cannot be selected as an acting source. Check `isTargetAvailable`, `isUnitTargetable`, deployment and event handling.
3. **Death Saves**: Captain and Leader identical to player existing contract; status-caused Downed gives one failure only; avoid double processing, duplicate death, wrong retreat, unexpected on_kill.
4. **Loot boundary**: no postcombat corpse for Downed; genuine dead normals/captains/leaders remain lootable; existing transactional claim and equipment truth unchanged; no item duplication.
5. **Replay and spectators**: DM, player and Theatre receive consistent events and animations; `UnitDowned` compatibility with existing `UnitDefeated` listeners needs concrete audit.
6. **GOAP/rank**: no escape/actions by incapacitated owner, existing INT/WIS, focus-fire, rank buffs and SP recovery unchanged, fallback from Leader to Captain.
7. **Regression tests**: run Node smokes incl. `tests/combat-action-resolver-smoke.mjs`, `tests/combat-action-queue-smoke.mjs`, `tests/combat-v073-rules-smoke.mjs`, `tests/individual-goap-combat-ai-smoke.mjs`, `tests/unit-rank-command-smoke.mjs`, `tests/loot-live-postcombat-runtime-smoke.mjs` and new tests below.
8. Identify required follow-up fixes for P1–P3 **without silently implementing unrelated UI, Firebase schema/rules, damage math, skill/deck economy or loot semantics**. Report blockers separately from enhancements. Review mobile+desktop simultaneously if proposing UI changes.

## Focused smoke commands

```sh
node tests/downed-lifecycle-and-interrupt-smoke.mjs
node tests/combat-v073-downed-interrupt-smoke.mjs
node tests/pr1042-real-downed-regression-smoke.mjs
```

## Delivery protocol GH-01

Do not wait/poll GitHub workflows or Codex; review and CI proceed after the PR is submitted. No auto-merge.
