## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2026-05-24 - [O(N^2) Performance Bottleneck in Chat Log Rendering]
**Learning:** Found an O(N) array lookup `Object.values(window.allActoresCache).find()` being repeatedly executed inside a loop to render each chat message, resulting in an O(N^2) complexity that scales poorly as the log grows.
**Action:** Replaced the in-loop array iteration with an O(1) Map lookup by pre-computing `const actoresMap = new Map()` outside of the rendering loop. Always build HashMaps/Maps for lookup data when iterating over large datasets in Firebase '.on("value")' listeners.
