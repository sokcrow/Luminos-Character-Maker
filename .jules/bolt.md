## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2024-05-18 - [Optimizing O(n^2) FireBase Listeners]
**Learning:** Found instances where \`.on('value')\` real-time listener loops iterate over the new items, but then internally iterate an entire local cache using array \`.find()\` to look up icons. For example, rendering 20 chat messages against 100 actors causes 2,000 lookup iterations on every chat update, blocking the main thread.
**Action:** When working with rendering loops reacting to frequent Firebase updates, pre-compute a lowercase string-based O(1) Map dictionary of secondary data outside the render loop, completely eliminating the inner O(M) search.
