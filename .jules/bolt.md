## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2026-05-22 - [O(1) Map Lookup for Actor Cache in Teatro de la Mente]
**Learning:** Discovered an O(n) performance bottleneck during high-frequency UI rendering of the 'Teatro de la Mente' log. The code was using an array `.find()` to lookup actor icons for every message inside the `.on('value')` Firebase listener loop, resulting in O(N x M) complexity.
**Action:** Replaced the array `.find()` with a pre-computed O(1) Map lookup outside the loop. The Map uses lowercase names as keys, achieving O(N + M) time complexity and significantly reducing CPU overhead during chat syncs.
