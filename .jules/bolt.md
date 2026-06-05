## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2026-06-05 - [DOM Fragment Batching in pantalla_dm.html]
**Learning:** Found multiple high-frequency layout reflows triggering within the `campaña/jugadores/` Firebase `.on('value')` listener due to iterative `appendChild` calls dynamically rendering multiple selects/grids (Banco, Comms, Loot, Tienda).
**Action:** Replaced direct real-time DOM element appending with batched `DocumentFragment` updates per section (`fragComms`, `fragLoot`, `fragRecetas`, `fragTienda`, `bancoFragment`). This eliminates O(n) layout thrashing, reducing it to O(1) inside heavily invoked multi-player update loops.
