## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-05-11 - [O(1) Map Caching in Theatre Log Array Filtering]
**Learning:** The Theatre Log rendering loop executed `Object.values(cache).find()` on every single message to find matching icons, introducing an O(M * N) bottleneck that triggered on every chat update.
**Action:** Replaced `.find()` within loops with an O(1) `Map()` lookup pre-computed globally before the loop to reduce the operation to O(M + N).
