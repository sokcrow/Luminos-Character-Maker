## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-27 - [O(n²) Array Find inside Firebase real-time loops]
**Learning:** Found that `Object.values(cache).find()` lookups inside iterative DOM creation loops of Firebase `.on('value')` listeners triggered O(n²) bottlenecks, combined with O(n) layout reflows from iterative `appendChild` calls.
**Action:** Pre-computed a lowercase `Map()` outside the render loop for O(1) icon lookups, and utilized `document.createDocumentFragment()` to batch DOM row insertions across all Theatre of Mind log logic (`hoja_personaje.js`, `hoja_personaje.html`, `pantalla_dm.html`).
