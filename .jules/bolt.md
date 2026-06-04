## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-06-04 - [Optimize O(N) .find() Inside Real-Time Render Loops]
**Learning:** Calling `Object.values(cache).find()` iteratively inside `Firebase` `.on('value')` re-rendering loops causes O(N^2) bottlenecks when rendering lists (like Theatre Log messages vs Actors cache).
**Action:** Replaced iterative `.find()` lookups inside the loop with an O(1) Map pre-computed outside the loop (`new Map()`) to drastically reduce processing overhead during frequent UI re-renders. Combined with `DocumentFragment` to batch DOM insertions to minimize reflows.
