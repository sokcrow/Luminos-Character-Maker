## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [Pre-computing Maps in Render Loops]
**Learning:** Found an O(N²) layout bottleneck in `hoja_personaje.js`, `hoja_personaje.html`, and `pantalla_dm.html` caused by using an array `.find()` inside a Firebase data sync loop (`.on('value')`) to find actor icons.
**Action:** Replaced the internal `.find()` lookup with an O(1) Map lookup by pre-computing a `new Map()` of `nombre` to `icono` mappings just before the iteration loop.
