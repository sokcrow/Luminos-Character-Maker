## 2026-03-23 - Optimize renderInventoryGrid DOM Reflows
**Learning:** In `hoja_personaje.js`, `renderInventoryGrid` appends elements directly to the DOM one by one inside a `.forEach` loop (`grid.appendChild(slot)`), causing unnecessary layout reflows on each iteration.
**Action:** Batch DOM updates in vanilla JS rendering loops (like `renderInventoryGrid`) by accumulating HTML or using a `DocumentFragment` before appending it to the DOM exactly once.
