## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2026-05-23 - [O(N²) bottleneck in Firebase realtime logs rendering]
**Learning:** Found that iterating over incoming Firebase snapshot arrays (`logs`) and running an array `.find()` inside the loop to look up cached values (`Object.values(actoresCache).find()`) results in O(N²) time complexity. When rendering the Theatre Log in real-time, this bottleneck slows down the main thread.
**Action:** Pre-compute a Hash Map (`new Map()`) of the cached data before running the iterative loop to provide O(1) lookups during the render cycle.
