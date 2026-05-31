## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(N^2) Lookup Bottleneck in Theatre Log Real-Time Rendering]
**Learning:** Found that rendering the Theatre Log inside a Firebase `.on('value')` listener was using `Object.values(cache).find()` iteratively for each log entry to resolve actor icons. As the log grows and the actor cache grows, this O(N * M) lookup becomes a significant performance bottleneck during real-time multi-user synchronization.
**Action:** Replaced the array `.find()` inside the rendering loop with a pre-computed `Map` built outside the loop, reducing lookup time to O(1) for each message iteration and significantly lowering CPU overhead on frequent Firebase updates.
