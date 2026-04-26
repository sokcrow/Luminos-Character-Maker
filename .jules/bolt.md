## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-04-26 - [Pre-computed Hashmaps in Firebase Render Loops]
**Learning:** Using `Array.find` or `Object.values(obj).find` inside real-time UI rendering loops like `skillRows.forEach` and log message loops (triggered by frequent Firebase `.on('value')` updates) causes an O(N²) bottleneck that grows linearly with data size and view elements. Memory constraints dictate these map optimizations should strictly occur outside rendering loops and not inside isolated one-off event listeners (like click events), where the memory allocation cost of building the map for a single lookup outweighs the `find()` iteration overhead.
**Action:** Extract list/object lookups by pre-computing lowercase `key-value` hashmaps immediately prior to the UI iteration loops in `hoja_personaje.js` and `pantalla_dm.html`, converting lookup complexity from O(N) per iteration to O(1).
