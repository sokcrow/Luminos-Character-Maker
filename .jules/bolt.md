## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2024-05-24 - [Avoid O(N^2) Bottlenecks in DOM Generation]
**Learning:** Using `Object.keys().find()` for case-insensitive lookups inside an iteration that processes numerous DOM elements (like skill rows) results in severe O(N²) layout thrashing and computational overhead, significantly slowing down UI rendering.
**Action:** Always pre-compute lowercase hashmaps (e.g., `lowerMap[key.toLowerCase()] = key`) before looping over DOM elements to transform N*M string comparisons into O(1) dictionary lookups.
## 2025-05-24 - [Avoid Real-Time Caches in Click Handlers]
**Learning:** Found that globally caching real-time Firebase payloads (like character `baseStats`) during an initial boot sequence causes bugs when the data later syncs dynamically, as the cache becomes dangerously stale during interactions. Furthermore, trying to over-optimize single-element interactions (like a single click handler) is often premature, as the true O(N²) bottlenecks originate within massive iterative UI rendering loops, not $O(M)$ single user clicks.
**Action:** Focus O(1) dictionary optimizations strictly within large iterative loops (like `skillRows.forEach`), computing the cache per iteration block rather than globally, and leave single-interaction event handlers simple unless they are definitively blocking the main thread.
