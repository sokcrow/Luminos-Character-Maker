## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(n^2) nested loops during real-time rendering log]
**Learning:** Found O(N * M) performance bottleneck inside a high-frequency real-time Firebase listener, where iterating over a list of log messages performed an `Object.values().find()` lookup for each actor in the actor cache. This resulted in O(N^2) complexity and potential main-thread blocking during rapid log updates or with many actors.
**Action:** Replaced O(N) array lookups within rendering loops with O(1) Map pre-computation built outside the iteration. Ensured the map is built from the reactive cache explicitly just once per loop instead of repeatedly querying.
