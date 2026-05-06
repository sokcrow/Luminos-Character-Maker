## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-05-06 - [O(1) Map Pre-computation in Firebase Real-time Render Loops]
**Learning:** Found a severe O(N*M) bottleneck when rendering UI lists (like Theatre Logs) from Firebase `.on('value')` real-time listeners. Using `.find()` on a large globally-cached array for every log entry inside the iterative rendering loop caused significant thread blocking.
**Action:** Always pre-compute an O(1) key-value Map object outside the loop to handle cross-referencing caches (like `allActoresCache`) during high-frequency syncs, preventing N*M lookup regressions.
