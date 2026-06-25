## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2024-03-26 - [O(1) Map Lookup & DocumentFragment in Teatro de la Mente Render]
**Learning:** Rendering long theater logs caused severe UI blocking because it appended elements directly to the live DOM sequentially inside a loop (O(n) reflows), and executed an array `.find()` to match actors to logs on every single message (O(n*m) complexity).
**Action:** Used `document.createDocumentFragment()` to batch DOM appends into a single layout repaint. Pre-computed a lowercase `Map` of actor names-to-icons outside the loop to reduce actor lookup inside the loop to O(1).
