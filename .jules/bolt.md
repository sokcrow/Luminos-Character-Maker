## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(N²) array lookups to O(1) map and batched DOM updates]
**Learning:** In the 'Teatro de la Mente' log render function, using `Object.values(cache).find()` inside a loop processing an array of messages creates an O(N²) bottleneck (where N is number of messages and M is actors in cache). Additionally, directly inserting into the DOM with `scrollArea.appendChild(divider)` during iteration causes severe layout reflow thrashing.
**Action:** Replaced `Object.values(cache).find()` with an O(1) `Map` precomputed outside the loop to map lowercase actor names to their data. Batch DOM append operations by using `document.createDocumentFragment()`, allowing a single `scrollArea.appendChild(fragment)` to prevent O(N) reflows. These changes must be consistently mirrored across `hoja_personaje.js`, `hoja_personaje.html` inline script, and `pantalla_dm.html`.
