## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [Theatre Log Iterative Lookup Bottleneck]
**Learning:** Found O(N²) bottlenecks in `hoja_personaje.js`, `hoja_personaje.html`, and `pantalla_dm.html` during real-time theatre log rendering, where `Object.values(cache).find()` was executed iteratively inside loops.
**Action:** Replaced repetitive array lookups inside `.on('value')` Firebase loops with an O(1) hashmap (`Map`) pre-computed outside the loop.
