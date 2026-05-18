## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2026-05-18 - Optimized Theatre Log Rendering O(N^2) Bottleneck
**Learning:** Legacy UI rendering logic executing inside frequent \`firebase.on('value')\` loops using nested \`.find()\` against array structures can introduce severe $O(N^2)$ algorithmic complexity as the dataset grows (e.g., chat logs matched against actors). Additionally, appending elements directly inside these loops forces individual DOM layout reflows per item.
**Action:** Always pre-compute a lowercase lookup hash map (e.g., \`new Map()\`) *outside* the render loop for $O(1)$ property mapping, and accumulate new DOM structures into a \`document.createDocumentFragment()\` to batch the final rendering phase and prevent layout thrashing.
