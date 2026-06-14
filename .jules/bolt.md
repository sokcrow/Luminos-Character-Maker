## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-27 - [Pre-computing O(1) Maps inside Firebase Realtime Rendering]
**Learning:** Found an $O(N \times M)$ performance bottleneck where an `Object.values(cache).find()` lookup was executing inside the loop for every single log message received during a Firebase `.on('value')` re-render in the Theatre Log.
**Action:** Lifted the array lookup out of the render loop by pre-computing a lowercase `new Map()` of actors *before* iterating over the real-time messages, reducing lookup complexity to $O(1)$ and significantly speeding up the iterative DOM generation when scrolling/rendering large theatre histories.
