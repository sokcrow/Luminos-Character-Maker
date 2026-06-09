## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-06-09 - [O(1) Map Pre-computation in Render Loops]
**Learning:** Found a performance bottleneck where array lookup (`Object.values(cache).find()`) was executed iteratively inside real-time Firebase `.on('value')` rendering loops, causing O(N^2) complexity.
**Action:** Replaced the array lookups inside the rendering loops with a pre-computed O(1) hash map (`new Map()`) built outside the loop. Avoided applying this pattern to single-event listeners to prevent overhead.
