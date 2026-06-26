## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [Replace O(N²) array lookups with O(1) Maps in tight render loops]
**Learning:** Performing `Object.values(cache).find()` inside the iteration loop of a real-time event listener (like Firebase `on('value')` for chat logs) degraded performance quadratically as actors and messages grew, jeopardizing 60FPS.
**Action:** Always pre-compute a lowercase lookup map (O(N) to build once) outside the primary rendering loop to execute O(1) `.get()` lookups during the list hydration.
