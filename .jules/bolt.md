## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [DOM Loop O(N²) Lookup in renderCharacterSheet]
**Learning:** Found that running `Object.keys().find()` dynamically against a hashmap inside a high-frequency `document.querySelectorAll().forEach` loop blocked the main thread significantly.
**Action:** Extracted the search by pre-computing lowercased hashmaps (`baseStatsLower` and `modifiersLower`) once before iterating over the DOM nodes, shifting from O(N*K) to O(1) loop execution complexity.
