## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2024-05-24 - Optimize Theatre Log Rendering by eliminating O(N^2) `.find()` lookup
**Learning:** Found multiple instances where an O(N) array `.find()` was executed inside a loop over log entries when rendering the Theatre Log in `hoja_personaje.js`, `hoja_personaje.html`, and `pantalla_dm.html`. This creates an O(M * N) bottleneck, particularly when logs become large.
**Action:** When rendering large lists derived from real-time syncs, ALWAYS pre-compute an O(1) Map lookup (e.g., `new Map()`) for reference data (like actors/icons) *before* iterating over the main array to reduce complexity to O(M + N).
