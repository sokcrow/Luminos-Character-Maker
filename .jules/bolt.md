## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2024-05-24 - [O(N²) bottleneck in Firebase realtime loops]
**Learning:** Found a major performance bottleneck where a `db.ref.on("value")` rendering loop executed an `Object.values().find()` lookup for each item in the Firebase snapshot to resolve dynamic references (e.g., actor icons for theater logs). This creates an O(N²) complexity operation directly inside a critical rendering path. Compounded with direct DOM `.appendChild` calls in the loop, this causes massive reflows and locks the main thread as data scales.
**Action:** Always pre-compute a key-value `Map` outside the loop for O(1) lookups of related data caches, and batch DOM insertions using `DocumentFragment` to eliminate reflows inside real-time UI updaters.
