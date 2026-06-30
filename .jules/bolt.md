## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2024-06-03 - [Optimize Firebase Listeners with Map & Fragment]
**Learning:** O(N²) lookups inside real-time Firebase loops cause significant performance overhead. Repeated DOM insertions cause layout thrashing and reflows.
**Action:** Replace `Object.values(cache).find()` with pre-computed `Map()` for O(1) lookups outside the loop. Replace direct `appendChild()` with `DocumentFragment` to batch insertions.
