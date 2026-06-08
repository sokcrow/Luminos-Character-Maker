## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-04-18 - [O(1) Map Pre-computation & DocumentFragment in Theatre Log]
**Learning:** Found an O(N^2) complexity bottleneck inside a high-frequency Firebase `.on('value')` real-time listener for the Theatre Log. For each chat log message, it was performing an array `.find()` against a global cache of actors to locate icons, and directly appending elements to the live DOM, causing layout thrashing.
**Action:** Replaced the array lookup with a pre-computed `Map` (hash map) built outside the rendering loop for O(1) lookups, and batched all DOM insertions via `document.createDocumentFragment()`.
