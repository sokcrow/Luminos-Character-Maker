## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [Replace O(N²) array lookup with O(1) hash map in Real-Time Render Loops]
**Learning:** Calling `.find()` on an array of cached data inside a real-time rendering loop (e.g., Firebase `on('value')` listeners for the theater log) causes an O(N²) performance bottleneck, significantly slowing down UI generation as the data set grows.
**Action:** Always pre-compute a lowercase key-value hashmap (e.g., `new Map()`) *outside* the iterative loop for O(1) lookups instead of using array operations like `Object.values(cache).find()`. Note: Strictly avoid using this map-building pattern inside single-event listeners (like `click`), as allocating full map objects for a single lookup introduces unnecessary memory overhead; use standard `.find()` for single lookups.
