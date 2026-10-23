# Universal Encounter Start

The live DM authority now calls `LuminousCombatEventRuntime.planEncounterStart`
before executing the first round. It resolves class and archetype grants from
each combatant's build through the existing catalogs and runtime manifest.
Equipped item Trait definitions, rules and structured Status effects use the
same TraitEngine and StatusEngine. Items in the bag do not activate.

`encounter_start`, `[Combat Start]`, `[On Combat Start]` and
`[On Encounter Start]` normalize to the encounter event. This change is scoped
to encounter startup; it does not redefine action costs or finish the remaining
Quick/Free Action integrations.

## Authority and recovery

Effects are evaluated on detached combatant drafts. A guarded transaction commits
the first-round transition, resulting statuses/resources, per-unit encounter
receipt and playback/recovery baselines together. Failed or competing writes
cannot apply the drafts to the live combatants. Existing receipts survive
hydration and prevent grants from repeating after a reload. Later rounds never
run encounter startup again. Backup units do not receive field startup effects.

The old character-sheet Firebase listener recognizes the live event authority
and does not run the player's startup a second time. Legacy CombatEngine callers
can use `await CombatEngine.triggerEncounterStart(units, { encounterId })` to
reach the same dispatcher. Existing wrappers delegate instead of dispatching again.

## Battle Master

The existing Battle Master runtime registers its encounter adapter with the
shared dispatcher. It resets Superiority to zero, then applies learned Ambush
grants, then resolves Tactical Assessment against the allied field roster.
The live Skill hook awards Superiority on actual Hits and resolved Clash Wins.

Superiority is explicitly registered with `allowZeroCount: true`. Its canonical
icon and Count remain visible at zero; other single-count statuses retain their
normal positive-count validity rule. Spending all Superiority does not hide the
waiting resource. No new debug controls are added.

Initial statuses from both adapters and TraitEngine carry the live viewer's
`appliedRound` metadata, including buffs granted to allies. This lets ordinary
round-end rules expire Haste, Clash Power Up and other temporary bonuses without
removing persistent resources such as Superiority.

After startup, the authority recalculates canonical Speed with the viewer's
shared pure Speed evaluator and the already saved base roll. Base Speed, tie
roll and RNG cursor are preserved; the initial execution/recovery snapshots and
formation use the updated Speed. Recovery without a checkpoint resumes at the
saved startup RNG cursor; a checkpoint's explicit cursor of zero remains valid.
Recovering a still-sealed turn discards the pre-execution local resume snapshot,
so it cannot restore pre-startup units over newly confirmed effects and Speed.
Running turns retain their baseline/checkpoint restoration path.

## Validation

Run the encounter runtime, authority and dependency smoke tests, the Battle
Master/Fighter regressions, and `npm run check:combat-live` / `npm run test:combat-mobile`.
The authority test covers first-round publication, playback/recovery baselines,
write failure, competing startup claims and player write exclusion.

`tests/combat-encounter-start-responsive.mjs` loads the production viewer with
an isolated Firebase fixture at 360x800, 390x844, 844x390, 768x1024, 1280x720 and
1920x1080. It checks the zero-count icon, focus, viewport bounds and live event
Count updates, and captures screenshots. This test is wired into
`.github/workflows/combat-encounter-start.yml`. Local execution was blocked by
the missing Chromium binary and an invalid browser download; visual verification
is pending, not reported as passed.
