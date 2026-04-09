## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-04-09 - [Hidden O(N²) Firebase Listeners in Theatre Log]
**Learning:** Found an O(N²) bottleneck in Theatre Log rendering loops in both Player and DM views. `Object.values().find()` was called iteratively inside a loop handling an array of Firebase messages to match lowercase Actor names. Since this is bound to `.on('value')`, it ran per-render, freezing the main thread during rapid chat spikes.
**Action:** Lifted the hash map construction (`lowercaseActorsMap.set()`) outside the iteration loop for an O(1) map lookup, and coupled it with `DocumentFragment` batch appending to achieve maximum throughput.
