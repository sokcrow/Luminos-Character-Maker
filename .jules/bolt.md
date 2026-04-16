## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2026-04-16 - [Optimize Teatro Log Rendering]\n**Learning:** Re-rendering chat logs using DocumentFragment in Firebase .on() listeners significantly reduces layout thrashing, and substituting loop-based N*M object lookups with a Map drastically improves computation time to O(N).\n**Action:** Always map-cache lookup references outside of DOM-generation loops and utilize DocumentFragments for batch appending.
