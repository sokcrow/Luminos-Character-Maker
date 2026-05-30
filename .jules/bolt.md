## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2025-05-30 - [O(1) Map Pre-computation in Firebase Listeners]
**Learning:** Found an O(N²) bottleneck in `hoja_personaje.js`, `hoja_personaje.html`, and `pantalla_dm.html` theatre log rendering. The `.on('value')` listener was looping through all log messages, and for *each* message, performing an `Object.values().find()` over the entire actors cache to find the matching icon. This resulted in O(M * N) complexity every time a single message was added (where M is messages and N is actors).
**Action:** Pre-computed a `Map` of lowercase actor names to icons *outside* the message loop. This changes the O(N) array lookup into an O(1) hash map lookup, drastically reducing layout latency and CPU spikes during high-frequency chat updates.
