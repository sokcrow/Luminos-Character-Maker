## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [DOM Fragment Batching and O(1) Cache lookups in Teatro Rendering]
**Learning:** Found an O(N) array `.find()` loop wrapped inside another loop resulting in O(N*M) lookups inside real-time Firebase `.on('value')` listeners. Combined with iterative `appendChild` DOM manipulation, this caused significant layout thrashing on message syncs.
**Action:** Replaced the array `.find()` with an O(1) Map pre-computed outside the loop and wrapped all log row creation in a `DocumentFragment` before appending to the DOM to minimize reflows. Applied this across all three theatre implementations (`hoja_personaje.js`, `hoja_personaje.html`, `pantalla_dm.html`).
