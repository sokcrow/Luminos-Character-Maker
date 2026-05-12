## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2024-05-23 - O(N^2) Array Find in Render Loop & Reflow Thrashing
**Learning:** Legacy UI rendering logic within real-time Firebase `.on('value')` handlers commonly executes `Object.values(cache).find()` sequentially on each item iteration, resulting in `O(N * M)` time complexity. In addition, appending nodes sequentially to a live scrollArea DOM element on each iteration (`scrollArea.appendChild(row)`) causes expensive `O(N)` layout reflows/thrashing. This is especially impactful in real-time listeners for logs, queues, or inventories.
**Action:** When refactoring real-time rendering logic, pre-compute cache values into an `O(1)` Map lookup outside the loop. Secondarily, batch all DOM tree generation into an isolated `document.createDocumentFragment()` outside the live tree, and only append it to the live DOM container once after the loop finishes.
