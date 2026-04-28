## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2025-05-19 - [O(N^2) Performance Bottleneck during DOM Renders]
**Learning:** During UI generation, calling `Object.keys(obj).find(...)` inside loops creates significant performance bottlenecks when processing dynamic properties like `baseStats` and `modifiers`. Repeated `find()` lookups coupled with `.toLowerCase()` manipulation scaled linearly with array length per loop iteration.
**Action:** In `renderCharacterSheet()`, pre-compute lowercased versions of the dynamically retrieved data maps (`baseStats` and `modifiers`) outside the `forEach` loop. This transforms $O(N)$ lookup checks into $O(1)$ property access checks per skill row, dramatically speeding up `hoja_personaje.js` runtime during Firebase sync events.
