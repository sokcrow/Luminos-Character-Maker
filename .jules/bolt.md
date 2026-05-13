## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-05-13 - [Teatro de la Mente log O(n^2) Render Loop]
**Learning:** Found O(n) array lookups (e.g., Object.values(window.allActoresCache).find(...)) nested inside O(n) real-time Firebase render loops for the Teatro log across hoja_personaje.js, hoja_personaje.html, and pantalla_dm.html. Since logs can grow large and re-render often during active RP, this structure scales extremely poorly (O(n^2)) leading to UI thread bottlenecking.
**Action:** Replaced iterative lookups inside the message iteration loop with a precomputed O(1) Javascript Map for character icons built outside the loop, vastly reducing thread blocking and reflow issues during dynamic RP events.
