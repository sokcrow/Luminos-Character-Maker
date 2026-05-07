## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-27 - [O(n^2) Array find inside loops in Teatro Rendering]
**Learning:** Found an O(n^2) logic performance issue in both `hoja_personaje.js` and `pantalla_dm.html` within high-frequency realtime `.on('value')` Firebase loops inside Teatro de la Mente log renderers. The previous logic executed `Object.values(window.allActoresCache).find()` iteratively for each rendered chat message.
**Action:** Replaced iterative array `.find()` with a pre-computed lowercase Map structure built outside the loop for O(1) lookups. Additionally batched DOM insertions for the logs into a `DocumentFragment` instead of appending them linearly to minimize DOM reflows.
