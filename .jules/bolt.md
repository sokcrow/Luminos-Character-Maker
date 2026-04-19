## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(N²) Array Lookups inside Render Loops]
**Learning:** Performing `Object.values(cache).find()` lookups directly inside tight rendering iteration loops like Firebase `.on("value")` array iteration causes an O(N²) execution time, leading to significant main thread blocking for large lists like chat logs.
**Action:** Always pre-compute a secondary O(1) key-value hashmap outside the rendering loop and use that for inner loop lookups.
