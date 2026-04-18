## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-04-18 - [O(1) Hash Map Lookups for Skill Rendering in renderCharacterSheet]
**Learning:** Found an O(N²) layout reflow pattern in renderCharacterSheet DOM iteration due to repeated case-insensitive Object.keys().find() lookups. However, pre-computing full maps should be strictly avoided for single-event listeners (like click) because it introduces memory allocation overhead and GC pauses.
**Action:** Replaced iterative Object.keys().find() lookups with precomputed lowercase key-value hashmaps (baseStatsLowerMap and modifiersLowerMap) allocated exactly once before the rendering loop in renderCharacterSheet, optimizing nested lookups to O(1).
