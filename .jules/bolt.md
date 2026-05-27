## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2024-05-27 - [Optimize O(N²) Firebase real-time rendering lookups]
**Learning:** Using `Object.values(cache).find()` inside a loop powered by a Firebase `.on('value')` listener generates a severe O(N²) performance bottleneck, especially for logs like the 'Teatro de la Mente' where N grows over time and re-renders frequently.
**Action:** Always pre-compute a lowercased Map (`new Map()`) for O(1) lookups outside the render loop before iterating over the Firebase data entries. Note: Do not use this pattern for single-event lookups like `click` events to avoid unnecessary memory overhead.
