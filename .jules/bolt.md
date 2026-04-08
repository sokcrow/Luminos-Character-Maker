## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [DOM Fragment Batching in pantalla_dm.html]
**Learning:** Found the same O(n) layout reflow pattern in the loops rendering `renderActorAsignacion` and `renderModalLlamarEscena` where `document.createElement()` results were immediately appended to the live container one by one.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the DM view components to match earlier optimizations.
