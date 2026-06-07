## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-27 - [O(N²) Reductions inside Firebase Observers]
**Learning:** Found a performance bottleneck where Firebase `on('value')` listeners processing chat logs iteratively used `Object.values(cache).find()` on a large list of actors for *every* message, causing an O(N²) scaling issue alongside single DOM node layout reflows per row.
**Action:** Always pre-compute a lookup Map (e.g., `const map = new Map()`) outside the iteration block for O(1) matching within real-time rendering loops, and utilize `DocumentFragment` to batch all list items into a single DOM append.
