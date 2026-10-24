# Creature field space

Each faction has eight field spaces. This is independent of Action Slots.

| Size | Field spaces | Body scale multiplier |
| --- | ---: | ---: |
| Tiny | 0.5 | 0.55 |
| Small | 1 | 0.8 |
| Medium | 1 | 1 |
| Large | 1 | 1.35 |
| Huge | 2 | 1.85 |
| Gargantuan | 3 | 2.5 |

Large uses the compact-space variant: it occupies one space while its body appears larger. Huge and Gargantuan costs are the initial homebrew values for this change, not D&D grid footprints. Summons and background spell units cost zero spaces, retain their size multiplier and use a separate formation row.

The existing manual sprite scale multiplies the body scale. Tiny, Small and Medium use a 75% information HUD (HP, SP, name, status, shield, Speed and floor). This replaces the smaller Tiny floor footprint with the same 75% floor used by Small/Medium. Action controls keep their size for every creature and move above taller bodies. Large and larger retain the previous information HUD scale and independent floor footprint. DM-pinned positions are preserved.

Deployment checks the incoming creature inside the existing encounter transaction. Bodies that do not fit go to reserves. Reserve promotion chooses the first queued creature that fits; larger skipped creatures remain queued. Existing over-cap encounters are not automatically evicted.

Formation uses the shared deployment runtime on initial hydration and speed updates. Two Tiny creatures can share a normal field cell with distinct anchors; a full Tiny side has sixteen distinct positions. Larger bodies reserve wider positions. Rows beyond two are compressed within the field.

## Validation

Run `node tests/combat-creature-space-smoke.mjs` for weighted deployment, reserve promotion, summon exemption, formation, size aliases and size-only hydration changes. Existing backup, deployment, authority, presentation and packed-viewer boot smoke tests also apply.

Run `node tests/combat-creature-space-responsive.mjs` with Playwright Chromium installed for the real packed viewer at 360×800, 390×844, 844×390, 768×1024, 1280×720 and 1920×1080 in Player and DM roles. It checks six size multipliers, independent action-control geometry, mixed formations, summon capacity and sixteen Tiny anchors, and writes screenshots under `artifacts/creature-space`. An existing browser can be supplied via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Visual validation remains pending in this environment: Chromium is absent and the browser download returned an HTML response rather than an executable archive. Passing logic and boot checks does not establish completed visual QA.

## Target selection follow-up

The screen-space target list is available on desktop and mobile while choosing a target. It lists each eligible Action Slot separately and uses the combat API to resolve the current node and revalidate its eligibility. This keeps selection available when taller bodies move their field controls above the viewport. Capture hit-testing never consumes target-list buttons; exact slot hits take precedence, and overlapping Tiny touch padding chooses the nearest slot.

`node tests/combat-target-selection-smoke.mjs` executes the actual HUD and capture handler with DOM fixtures at all six viewport modes, including button isolation, slot specificity, Tiny neighbor selection, touch and eligibility revalidation. These are interaction-logic checks, not rendered visual QA. The responsive browser suite additionally exercises click and keyboard selection when a browser is available.
