## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(N²) Array Search Bottleneck in renderCharacterSheet]
**Learning:** Found that `Object.keys(data).find()` inside a loop over DOM elements causes O(N²) layout rendering bottlenecks on every real-time Firebase data sync.
**Action:** Pre-compute lowercase key-value hashmaps outside loops, while preserving `.find()` patterns in single-event contexts (such as `click` handlers) to avoid unnecessary map allocation overhead.
