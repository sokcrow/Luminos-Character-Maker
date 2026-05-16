## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [DOM Fragment Batching in Teatro de la Mente rendering]
**Learning:** O(n) layout reflows and O(n^2) lookups were occurring in the real-time Firebase `.entries(logs)` loop for the "Teatro de la Mente" chat rendering. Appending `row` iteratively to `scrollArea` causes severe reflow bottlenecks, and running `Object.values().find(...)` inside the loop causes unnecessary overhead.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1). Pre-computed a Map of actors outside the loop for O(1) icon matching lookups instead of executing array `.find()` inside the loop.
