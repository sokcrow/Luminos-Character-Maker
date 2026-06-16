## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2024-06-16 - [Optimize O(N^2) Theatre Log Rendering]
**Learning:** During the rendering of the theatre log (`renderizarLog`), an `Object.values(allActoresCache).find()` operation was occurring inside a loop iterating over all logs. Because logs are frequently appended and potentially numerous, this created a hidden $O(N \times M)$ performance bottleneck on the UI thread when generating the DOM.
**Action:** Lift the array mapping logic outside the log rendering loop by creating a pre-computed `Map()` hash map with lowercased keys. This shifts the lookup operation from an O(M) search inside an O(N) loop to an O(1) lookup inside an O(N) loop, resolving the scaling bottleneck.
