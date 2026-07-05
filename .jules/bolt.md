## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2025-03-26 - [DOM Fragment Batching and O(1) Map Cache in Teatro Logs]
**Learning:** Rendering theater logs inside `hoja_personaje.html`, `hoja_personaje.js`, and `pantalla_dm.html` utilized O(N²) lookups (`Object.values(cache).find()`) inside a loop that also modified the live DOM (via `.appendChild`) on each iteration, causing severe layout reflow thrashing.
**Action:** Implemented a pre-computed O(1) Map for lookups outside the loop and batched all DOM insertions into a `DocumentFragment`, preventing layout thrashing and transforming time complexity to O(N + M).
