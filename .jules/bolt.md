## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2024-05-18 - [Optimize Teatro de la Mente O(n^2) Bottleneck]
**Learning:** Found a severe O(N*M) performance bottleneck where `Object.values(cache).find()` was being executed for every single log message inside the render loop for the 'Teatro de la Mente'. In `hoja_personaje.js` and `pantalla_dm.html`, iterating logs while searching the global actors cache creates enormous GC pressure and UI thread blocking as log history grows.
**Action:** Replaced the inside-loop `.find()` by pre-computing an `actorsMap` (using lowercased names as keys) globally/outside the loop, effectively reducing complexity to O(N + M) with O(1) icon lookups. Remember to safely default or fallback when `null` values are present, but the O(1) map pre-computation dramatically smooths chat rendering in long campaigns.
