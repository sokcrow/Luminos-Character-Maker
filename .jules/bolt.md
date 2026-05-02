## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.
## 2024-05-02 - [Firebase UI Rendering Loops]
 **Learning:** Avoid using array \`.find()\` operations like \`Object.values(cache).find()\` inside Firebase \`.on('value')\` real-time rendering loops, as this leads to severe O(N²) performance bottlenecks during rapid log updates. Additionally, directly appending elements within the loop triggers O(N) layout reflows/layout thrashing.
 **Action:** Always pre-compute a lowercase key-value Map (O(1) lookups) outside the rendering loop, and use a \`DocumentFragment\` to batch all DOM insertions into a single append operation at the end.
