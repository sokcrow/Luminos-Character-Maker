## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(N²) array lookups in Theatre Log Rendering]
**Learning:** Found O(N²) array lookup pattern when mapping chat actors inside `.on('value')` Firebase real-time loops in `hoja_personaje.js`, `hoja_personaje.html`, and `pantalla_dm.html`. Inside loops formatting each chat message, it iterated over `Object.values(window.allActoresCache).find(...)` multiple times.
**Action:** Implemented a pre-computed O(1) string lowercase key map matching mechanism outside of the message formatting loops and also wrapped the DOM append logic inside `document.createDocumentFragment()` to reduce O(N) DOM reflows to O(1).
