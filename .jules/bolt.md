## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(N²) bottleneck in render loops via Object.keys().find()]
**Learning:** Using `Object.keys().find()` inside a loop (like iterating through skill rows in `renderCharacterSheet`) dynamically allocates arrays and does a linear search each time, leading to O(N²) time complexity. This is especially problematic when attached to high-frequency Firebase real-time listeners.
**Action:** Always pre-compute lowercase key-value hashmaps OUTSIDE the rendering loop for O(1) lookups. However, specifically for single-event listeners (like UI clicks) where avoiding full object allocation is desired to limit memory overhead and garbage collection, use standard inline loops with early returns instead.
