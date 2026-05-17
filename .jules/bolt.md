## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2026-05-17 - [O(n²) to O(n) rendering for Teatro Log]
**Learning:** Found O(n²) bottleneck in Teatro de la Mente rendering loops across multiple files where `Object.values(allActoresCache).find()` was being executed for every single log message during Firebase `.on("value")` updates.
**Action:** Replaced the array find inside the loop with an O(1) Map pre-computed outside the loop (`actorsByName.get()`), reducing rendering complexity from O(n²) to O(n).
