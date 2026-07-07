## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2026-07-07 - [O(n) find bottleneck in Teatro log loops]
**Learning:** Found an O(N^2) complexity issue inside the real-time Firebase '.on("value")' rendering loops for the 'Teatro de la Mente' logs across `hoja_personaje.js`, `hoja_personaje.html`, and `pantalla_dm.html`. For every log message, the script invoked `Object.values(cache).find()` over the global actors cache, causing severe repetitive layout logic processing.
**Action:** Pre-computed a hash map (`new Map()`) with lowercase actor names outside the log loop to change the O(n) inner array lookup into an O(1) hash map lookup, drastically reducing the operational overhead for large logs.
