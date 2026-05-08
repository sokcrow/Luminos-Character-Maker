## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2025-03-27 - [O(n²) Array Lookups inside DOM Render Loops]
**Learning:** Found an O(n²) performance bottleneck in `renderizarLog` caused by performing an array `.find()` lookup over cached actors for every single message entry inside a real-time Firebase rendering loop.
**Action:** Replaced the array `.find()` lookup with a pre-computed hash map (`new Map()`) built outside the loop, reducing the lookup time to O(1) and preventing scaling performance degradation as message history or actor lists grow.
