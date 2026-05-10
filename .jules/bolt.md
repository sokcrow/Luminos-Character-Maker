## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2024-11-20 - O(N²) array lookups in Firebase real-time rendering loops
**Learning:** Found a performance bottleneck specific to this codebase's architecture where `Object.values(cache).find()` is used inside Firebase `db.ref.on('value')` real-time rendering loops (like Theatre of the Mind log rendering). Because `.on` fires for the entire dataset on every change, this leads to an O(N * M) bottleneck (where N = number of messages and M = number of actors) that can cause layout frame drops.
**Action:** Always pre-compute lowercase key-value hashmaps (like `new Map()`) outside the loop for O(1) lookups instead of doing array `.find()` lookups on each rendering iteration.
