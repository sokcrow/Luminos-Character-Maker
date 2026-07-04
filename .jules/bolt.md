## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2026-07-04 - [O(n²) Layout Thrashing in Firebase Loop]
**Learning:** Found an O(n) array `.find()` lookup inside an `Object.entries(logs)` rendering loop attached to a `.on('value')` Firebase listener. Worse, it was doing live DOM insertions `scrollArea.appendChild(row)` inside the loop, leading to severe N² layout thrashing during real-time UI updates (like the 'Teatro de la Mente').
**Action:** Always pre-compute a `new Map()` outside the rendering loop for O(1) `.get()` lookups and use a `DocumentFragment` to batch DOM insertions before appending to the live DOM container.
