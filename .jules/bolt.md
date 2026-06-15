## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [Theatre Log Rendering Bottleneck]
**Learning:** Found that rendering large arrays of real-time Firebase chat logs inside `on('value')` listeners was causing an O(N^2) bottleneck. Inside the main rendering loop (which iterated over each log message), there was a nested `Object.values(cache).find()` array search to dynamically resolve actor avatars. Combined with direct `appendChild` insertions into the active DOM per iteration, this caused severe layout reflows and performance degradation when logs grew large.
**Action:** Replaced the nested array `find()` with an O(1) `Map` lookup pre-computed globally right before the iteration loop. Combined with replacing direct `appendChild` calls with a batched `DocumentFragment`, resolving both the computational O(N^2) complexity and the iterative DOM reflow penalty. This change was synchronized across `hoja_personaje.js`, `hoja_personaje.html`, and `pantalla_dm.html`.
