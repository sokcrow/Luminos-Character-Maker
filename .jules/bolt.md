## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-27 - [O(n²) Loop Optimizations inside Firebase Listeners]
**Learning:** Legacy theatre logs used `Object.values(cache).find()` iteratively inside `Object.entries(logs)` rendering loops triggered by Firebase real-time syncs, producing an O(N*M) calculation bottleneck exacerbated by direct single-node DOM layout thrashing, causing visible UI lag on new messages.
**Action:** Always pre-compute a lowercase string-matching Hash Map (`new Map()`) outside iterative string-matching loops for O(1) lookups during DOM generation within Firebase callbacks, combined with `DocumentFragment` insertion.
