# Player Clash invalidation correction — 2026-10-27

Base: `51004a2ef969a5cc8caa9a5d1d2ebcbce071b961` (main). This change addresses the two observed code paths identified in the supplied investigation: unrelated DOM invalidation of the VFX canvas and whole-document menu reconciliation on Coin/HUD inserts. It does **not** certify the cause of the user's 10–30 second freeze or claim an FPS improvement without browser measurements.

## Changes

- The bootstrap WebGL patch observes host/camera attributes and the intent SVG subtree, rather than every sprite, HUD, Coin and canvas write under `game-container`. Particle bursts still request their original animation lifetime. Camera transitions, resize and surface visibility retain their existing handlers.
- The economy menu ignores unrelated node insertions, coalesces actual menu changes into one RAF, cancels pending work at unload, and avoids writing identical visibility attributes/classes. Hydration, spell-loadout readiness and resize still explicitly reconcile permissions/layout.
- No changes to rules, authority, RNG, snapshots, Coins, presentation pace, asset quality or Firebase permissions.
- Updated the existing renderer signature test to reflect the shared DOM compositor already present on main. That test failed on the unchanged base because it still expected the earlier low-power-only compositor and continuous round rendering.

## Local work-count comparison

Run `node tests/combat-overlay-invalidation-smoke.mjs ../baseline` with the base checkout at `../baseline`. The test evaluates the **actual bootstrap patch** from each checkout with the same deterministic mutation/RAF workload. These are workload counts, not browser FPS or production call counts.

| Controlled workload | Base | Candidate |
|---|---:|---:|
| 3 sequences × 100 frames × 3 unrelated HUD/Coin mutations: overlay observer callbacks | 900 | 0 |
| Empty VFX canvas frames requested by those mutations | 300 | 0 |
| 500 unrelated Coin/HUD child-list deliveries: menu scans/layout reads | 500 per original callback | 0 |
| 500 actual menu deliveries before one paint: menu reconciliations | 500 per original callback | 1 |

Overlay path/geometry edits, overlay child removal, camera/host attributes, batched frame scheduling, menu replacement/removal and pending-work teardown are asserted. Existing compositor and triangle tests verify full particle lifetime, original geometry/colors/order, planning arrows and hidden-surface cancellation.

Local regressions passed: new overlay/menu invalidation tests; compositor; overlay batching; dirty playback; HUD coalescing; catchup; shared clock; presentation phase cancellation; six-consumer recovery; economy menu; mobile bootstrap; updated renderer signatures; canonical bundle `check:combat-live`. Economy retry smoke also passes (its Node harness emits existing missing-window warnings).

## Browser comparison and limits

The existing authenticated benchmark now supports `COMBAT_BENCH_PLAYERS=1`: exactly one DM context and one isolated Player context, one enemy, three normal-timing rounds **without reload**, five seconds idle, and encounter cancellation through the real DM entry UI followed by `ENDED` / `teatro` / Player viewer hidden. ABBA order repeats each version twice. It compares canonical HP/SP/status/shields, rendered Coin/power/winner results, camera/participants and zero Player damage/RNG calls. Each round waits for a new Clash, not a cue left over from the previous round.

New artifacts: Chromium timeline/V8 traces, observer callback work, per-role frame intervals and long tasks, existing runtime/cue profiles, per-round settled heap/animation counts and ending timestamps. `combat-pair-report.mjs` reports sampled mean FPS separately from median/P95/P99/max frame time, and fails on incomplete samples, trace failure, P95 over 33.3 ms or a frame gap of at least 10 seconds. An absent or partial browser run is never reported green.

`Single Player Clash FPS` runs the six TX-01 viewports (360×800, 390×844, 844×390, 768×1024, 1280×720, 1920×1080). The nine-context benchmark remains available for its fixture/report changes and manual dispatch; editing the shared harness now selects the smaller pair gate first.

**No local browser FPS figures were obtained.** Dependencies and Firebase emulators installed; Java started after providing its library path. Chromium Headless Shell 141.0.7390.37 / Playwright 1.56.1 exited with `SIGTRAP` at launch before opening a page, including a second isolated launch attempt. Consequently desktop/mobile visual QA and before/after FPS remain pending CI.

The CI case uses the existing synthetic SVG sprites with external assets blocked and the Combat entry shell plus iframe. It does not reproduce the full character-sheet document, the user's real assets, GPU, normal/incognito windows or foreground throttling. Do not extend any CI FPS result to those conditions without a reproduction on that setup. Timers/Coins and parent-sheet work were not rewritten without evidence. Revert this commit to roll back the runtime corrections.
