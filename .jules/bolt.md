## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-27 - [O(n²) reduction in Theatre Logs]
**Learning:** Evaluated that running `Object.values(cache).find()` inside `Object.entries(logs)` loop for every message rendering causes O(n²) bottlenecks in the real-time Firebase listener, particularly visible with large logs and actor caches.
**Action:** Always pre-compute a lowercase map (`new Map()`) outside the loop for O(1) lookups in rendering loops, and combined it with `DocumentFragment` for batched DOM insertion to prevent rendering blocking.
