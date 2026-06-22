## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-26 - [O(N²) Array Lookups Inside High-Frequency Realtime Firebase Rendering Loops]
**Learning:** Legacy UI arrays embedded inside `db.ref.on('value')` real-time listeners caused an O(N²) layout rendering bottleneck when performing iterative `Array.find()` lookups on deeply cached actor datasets during the theater log iteration loop.
**Action:** Lift the array lookup strictly outside the loop. Instantiate a pre-computed case-insensitive map (`new Map()`) just once at the beginning of the `on` callback to execute O(1) loop evaluations, alongside document fragment DOM batching.
