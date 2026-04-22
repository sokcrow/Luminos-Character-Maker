## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2024-04-22 - [Teatro de la Mente Log O(N²) + Layout Reflows]
**Learning:** Found an O(N²) bottleneck in Firebase `.on('value')` listeners processing 'Teatro de la Mente' logs. `Object.values().find(...)` was called for every log message in a loop to match actor icons. Combined with direct `appendChild` to a visible container inside the loop, it caused massive CPU spikes and layout reflows during initialization of large chat logs.
**Action:** Always extract static reference data (like `window.allActoresCache`) into pre-computed `Map` objects before the loop for O(1) lookups, and batch DOM updates using `document.createDocumentFragment()` before appending to the live DOM.
