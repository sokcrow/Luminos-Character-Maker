# Combat integration — Phase 0 baseline

Reviewed 2026-10-17. Base: `main` at `a879160ec397e1b557b53626d0d10b1f191a1da3`.

## Result and scope

This branch reconciles PR #984 (`d6ee776fa0a9e8495dfabdb83e965248b6adc899`) with the current main, carries forward the #933 spatial workboard, fixes the Spell planner crash and establishes an editable, verifiable source for the packed Combat runtime.

Authenticated emulator validation exposed a real round-close failure: `afterRound()` deletes `plannedActions` and `readyPlayers` at their container roots, but their former rules granted DM writes only below those roots. The new DM-only parent grants allow the existing close/reset operation. Player ownership, phase checks and payload validation remain in place. Tests explicitly reject Player deletion of either container, writes to another Player's slot, writes to authority and edits of enemy HP.

Browser validation also exposed a cancelled-listener startup race: RTDB can reject a Combatant listen before authentication reaches the connection, leaving an authenticated viewer permanently empty. The live adapter now refreshes the authenticated token and retries that cancelled listen once. Closing Combat cancels the retry; persistent permission failures remain failures and no read permissions are broadened.

Full browser rounds exposed an executor conflict: the Action-runtime loader replaced the packed live timeline, but read a different planner and ignored the sealed queue, producing a completed round with no attacks. Live mode now keeps its existing queue executor. The separate Action runtime continues to install outside live mode. A matching canonical `running` round also satisfies the legacy Ready guard without resubmitting Player Ready; authority refuses completion after an early runtime return.

This phase keeps the existing seeded client execution and DM checkpoint protocol. It does not implement result-event playback, change combat formulae, migrate the battlefield to Forest or deploy Firebase rules.

## Reconciled changes

- #984: live DM loadout updates to Player, linked Unit and deployed Combatant; selection is captured before asynchronous saving.
- #984: player-facing Skill/Spell details, Coins/Status, mobile layout and centered Player camera.
- Fix: `battle-viewer-player-spell-planner-074.js` used an undefined `normalizeId`, preventing leveled Spell planning.
- Fix: the Spell planner smoke still searched `.write` for validation that belongs to `.validate`; it now checks authentication and validation in their respective rules.
- Fix: only the DM can clear the two planning containers when a round completes.
- Fix: one bounded recovery for a realtime listen cancelled during Auth startup (`0.7.3-live.5-auth-listener-recovery`).
- Fix: execute the DM-sealed running round in observer mode and reject false completion after an early runtime return.
- Fix: prevent the separate Action-runtime loader from replacing the live seeded queue executor.
- Foundation: editable packed-runtime source, integrity manifest, roundtrip builder, frozen protocol reference and repeatable validation commands.

## Runtime and network contract

Machine-readable reference: [`combat/runtime-contract.json`](../combat/runtime-contract.json).

| Area | Preserved contract |
| --- | --- |
| Live runtime | `0.7.3-live`; external 0.7.4 planners remain adapters. |
| Plans | `schemaVersion: 2`, `engineVersion: 0.7.3-live-authority`. |
| Authority | `schemaVersion: 1`, `engineVersion: 0.7.3-authority.8-sealed-round-start`. |
| Identity | Existing canonical Player key, owner UID, combatant ID and source/target slot indexes. |
| Planning | Authenticated owners submit plans/Ready while planning; the DM seals the round. |
| Resolution | Seeded execution in clients, with DM state/digest/RNG checkpoints and final persistence. |
| Timeline | `seeded-live-runtime`; the separate Action runtime does not replace the packed live executor. |
| World | Existing coordinates/renderer; continuous Forest geometry remains the #933 migration. |
| Persistence | Existing campaign roots, Player vitals and inventory bridges. |
| UI | Production menus/HUD; test fixtures and commands remain outside the Player/DM product surface. |

This JSON is a baseline reference, not a newly enforced client handshake. Schema/capability negotiation and presentation events belong to later phases.

## Editable source and generation

`combat/source/combat-v073-live.html` is the exact decompressed payload before the compatibility patches in `Battle-viewer.html`. Its initial SHA-256 is `971d99dc09e9e4e9618aacb09869e129f7d53641ea895e72c75445d9edb2510f`. Extraction leaves all 13 delivered bundle parts unchanged.

The live surface still consists of that source **plus** the bootstrap patches and external `combat-v073-*` bridges. Editing `js/combatEngine.js` alone does not necessarily modify the functions executed by the live surface. Future work must identify the owning lane before changing rules.

```bash
npm run check:combat-live
npm run build:combat-live
npm run test:combat-phase0
```

`check:combat-live` checks the source, loader part order, compressed payload and manifest. `build:combat-live` is a byte-preserving no-op when the source is unchanged; source edits regenerate gzip/base64 parts using the existing split layout and update the manifest. It rejects payloads too short for that legacy layout rather than silently producing empty parts. Removing the legacy split layout is a separate loader migration.

Edit `combat/source/combat-v073-live.html`, then run the builder and checks. Do not edit the generated shards directly. `--extract` exists for the initial migration and refuses to overwrite an existing source/manifest.

## Automated validation

| Gate | Status and scope |
| --- | --- |
| Local baseline | 36/36 Node checks passed after reconciliation, rules, listener recovery and live execution fixes. Covers live bootstrap, loadout, HUD, plans, ownership, Speed, vitals, inventory, deployment and lifecycle. |
| Build integrity | Source/packed equality, no-op byte preservation, edited-source roundtrip, repeated build and manifest corruption rejection passed. |
| Real local Auth/RTDB | Production loadout and authority methods exercised through independent DM/Player accounts. The harness provides the DOM and runtime adapter; it does not certify browser choreography. |
| Browser | `Combat Phase 0 Baseline` runs the real Battle Viewer with emulator Auth/RTDB, two Player contexts and a DM context; screenshot/trace artifacts and a completed-round result are required. Status must be taken from the actual run, not inferred from this document. |
| Manual production acceptance | Pending: authenticated DM/Player session on the actual deployed app, mobile portrait/landscape review and final visual acceptance of #984. |

Local browser startup is unavailable in this managed environment: the bundled headless Chromium exits before a page opens. Browser acceptance is delegated to the CI job and remains unverified until that job completes successfully and its screenshots are inspected.

## Running the emulator gates

Install isolated test dependencies and Chromium with the versions in `.github/workflows/combat-phase0-baseline.yml`. Use Node 22 and Java 21 for the CI path.

```bash
npx firebase emulators:exec --only auth,database \
  --project demo-luminos-combat-phase0 --config firebase.combat-phase0.json \
  -- "node tests/combat-phase0-auth-emulator.mjs && npx playwright test --config playwright.combat-phase0.config.cjs --reporter=line"
```

The tests require explicit loopback emulator hosts and a fixed `demo-*` project. They seed isolated test users and campaign data, never production accounts. Node RTDB proxy variables are cleared only inside the emulator test process because the SDK otherwise proxies loopback WebSockets in managed environments.

Browser evidence goes to `artifacts/combat-phase0/`: DM desktop, Player desktop, Player portrait, Player landscape, traces on failure and `online-result.json` on a completed round. Remote image assets use an SVG substitute in this test so the evidence verifies layout/interaction, not the final character art. Firebase requests outside loopback are forbidden.

## Acceptance still required

- Inspect CI screenshots; DOM/static assertions alone do not establish visual acceptance.
- Initial browser screenshots expose existing HUD issues to resolve before visual acceptance: portrait title/Ready/status overlap, landscape menu clipping and an overflowing standalone DM setup panel. Placeholder art does not certify final sprites or background composition.
- Confirm normal Player and DM use on the deployed app after the branch and database rules are deliberately released.
- Retain Draft status until #984's real-session and visual acceptance is satisfied.
- Leave every unfinished spatial feature in #933 unchecked. Its first Forest 2-vs-4 encounter belongs to the later spatial phase, not to this baseline.

References: [#984](https://github.com/sokcrow/Luminos-Character-Maker/pull/984), [#933](https://github.com/sokcrow/Luminos-Character-Maker/pull/933), [`combat-engine-forest-spatial-evolution.md`](combat-engine-forest-spatial-evolution.md).
