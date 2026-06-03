## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(n^2) Loop Array Lookup in Firebase Render Loop]
**Learning:** Performing `Object.values(cache).find()` inside a real-time `Object.entries()` Firebase rendering loop creates an O(N²) bottleneck. This is highly detrimental to real-time sync performance where every data change triggers the entire loop to re-render.
**Action:** Always pre-compute a lowercase O(1) Key-Value HashMap (`new Map()`) outside the loop using `Object.values().forEach()` before iterating over logs or items to look up associated data.
