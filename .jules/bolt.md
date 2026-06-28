## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(n²) Array Lookups inside real-time render loops]
**Learning:** Found O(n²) performance bottlenecks where Firebase `on('value')` listener callbacks for lists (e.g., Theatre Log messages) were calling `Object.values(cache).find()` inside their rendering loops for *every single item* to match dynamic attributes. This causes compounding CPU load.
**Action:** Replaced iterative `.find()` lookups within real-time rendering loops with an O(1) `Map` pre-computed outside the loop.
