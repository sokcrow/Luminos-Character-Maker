## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-06-29 - [Theatre Log Real-Time Rendering Optimization]
**Learning:** High-frequency real-time `on('value')` listeners triggering loops with `Object.values().find()` string comparisons lead to hidden O(N²) scaling and memory/GC overhead, compounded by O(N) reflows from iterative `appendChild()` to a live scroll container.
**Action:** Replaced O(N) `.find()` with pre-computed O(1) `new Map()` lookups outside the render loop and implemented `document.createDocumentFragment()` for single-pass batch DOM insertion.
