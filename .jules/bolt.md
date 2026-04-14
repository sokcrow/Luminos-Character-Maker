## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(N²) Key Lookup Bottleneck in Rendering Loops]
**Learning:** Using `Object.keys().find()` to perform case-insensitive fallback key lookups inside a DOM iteration loop (like `skillRows.forEach`) creates an O(N²) execution pattern that heavily degrades CPU performance during frequent real-time UI re-renders. Conversely, using them in a single-event click listener is acceptable and preferable to allocating full map objects which could introduce garbage collection overhead.
**Action:** When working in tight rendering loops (`requestAnimationFrame` or high-frequency `.on('value')` Firebase syncs), pre-compute lowercased proxy hashmaps `O(1)` outside the loop to handle case-insensitive fallbacks efficiently.
