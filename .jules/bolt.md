## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-27 - [O(1) Lookups & DOM Batching in Teatro Logs]
**Learning:** O(N^2) performance bottleneck caused by repeatedly calling `Array.prototype.find()` on actor caches inside the `on('value')` real-time Firebase listener loop for the Theatre Log. Coupled with direct O(N) DOM appends (`scrollArea.appendChild(row)`), this created excessive CPU overhead and layout thrashing as log counts grew.
**Action:** Replaced array `.find` calls inside rendering loops with a pre-computed O(1) Hashmap (`new Map()`). Wrapped iterative DOM node creations inside a `DocumentFragment` before appending to the live DOM layout to condense reflows.
