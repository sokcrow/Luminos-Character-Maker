## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-31 - [O(1) Map Lookups replacing O(N²) Object.keys().find() in Render Loop]
**Learning:** Found an O(N²) performance bottleneck during UI rendering in `hoja_personaje.js`. `Object.keys(data).find(...)` for case-insensitive lookups was being executed iteratively inside `skillRows.forEach()`. This blocks the main thread during heavy Firebase synchronization. (Note: Avoided doing this inside single-event handlers like `click` as allocating temporary hashmaps to perform a single O(N) lookup creates unnecessary garbage collection pressure/is an anti-pattern).
**Action:** Replaced iterative `Object.keys().find()` inside loops with pre-computed lowercase hashmaps (`baseStatsLower`, `modifiersLower`) constructed outside the loop, reducing lookup time from O(N) per iteration to O(1) direct property access.
