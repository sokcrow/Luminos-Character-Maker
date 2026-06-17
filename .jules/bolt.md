## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-06-17 - [O(N²) Array Lookups inside Render Loops]
**Learning:** Found a severe O(N²) bottleneck in `renderizarLog()` (used in `hoja_personaje.js/html` and `pantalla_dm.html`). Inside the loop iterating over theater log messages, the code used `Object.values(cache).find()` to locate the corresponding actor's icon. With large chat histories, this caused significant main-thread blocking during Firebase UI syncs.
**Action:** Replaced the array `.find()` loop with a `Map` pre-computed outside the loop (`new Map(Object.entries(cache))`), transforming the O(N²) operations to O(N) setup + O(1) lookups, drastically reducing UI processing time.
