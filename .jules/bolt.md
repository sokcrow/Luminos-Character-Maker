## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [Pre-compute Hashmaps for O(1) Actor Lookups in Theatre Logs]
**Learning:** Found an O(N²) layout bottleneck in high-frequency Firebase `.on('value')` real-time rendering loops where `Object.values(cache).find()` is used per message iteration.
**Action:** Replace internal loops using `.find()` inside of a map iteration with a pre-computed `Map` (hashmap) built outside the render loop for O(1) constant time lookups.
