## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2025-03-26 - [DOM Fragment Batching and Pre-computation in Theatre Log Rendering]
**Learning:** Found an O(n²) array search pattern `Object.values(cache).find()` running inside an iterative real-time rendering loop across three files. Found DOM elements were being appended one by one, triggering layout recalculations.
**Action:** Combined O(1) `Map` generation directly outside the `for` loops with a `DocumentFragment` appending pattern across the logic scopes in `hoja_personaje.js`, `hoja_personaje.html`, and `pantalla_dm.html`.
