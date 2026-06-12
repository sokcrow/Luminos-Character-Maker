## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(N²) array lookups in Theatre Log Firebase Sync loops]
**Learning:** Found an O(N²) performance bottleneck inside the Firebase `.on('value')` real-time synchronisation loop for the 'Teatro de la Mente'. For every log message rendered, it executed `Object.values(cache).find(...)` to fetch the actor's icon, resulting in heavy processing overhead proportional to the square of log entries and actors whenever new messages arrived.
**Action:** Replaced the intra-loop array lookup with a pre-computed O(1) `Map` mapping actor names to icons, executed entirely outside the loop.
