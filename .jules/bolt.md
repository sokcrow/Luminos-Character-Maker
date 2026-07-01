## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-03-27 - [O(N²) Array Lookups inside Render Loops]
**Learning:** Found a severe O(N²) layout bottleneck in the "Teatro de la Mente" where every single chat message dynamically iterated over an array of all known actors via `Object.values().find(...)` to fetch icons during the Firebase render loop.
**Action:** Lifted the cache evaluation outside the loop to build a strict pre-computed Map (hash table) for O(1) lookups on actor icons, dramatically reducing CPU overhead during large batch renders.
