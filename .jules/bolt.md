## 2025-03-26 - [DOM Fragment Batching in hoja_personaje.js]
**Learning:** Found an O(n) layout reflow pattern in coin toss animation DOM creation loop.
**Action:** Replaced iterative DOM appending with DocumentFragment appending to reduce reflows to O(1) in the tight requestAnimationFrame logic contexts.

## 2025-03-26 - [DOM Attribute Thrashing in renderCharacterSheet]
**Learning:** Found that assigning `.innerText` or `.value` unconditionally inside high-frequency real-time `on('value')` listeners (like Firebase data sync) causes unnecessary DOM layout recalculations and repaints, even if the value string hasn't changed.
**Action:** Introduced strict equality checks (e.g., `if (el.innerText !== String(newVal))`) before applying data to DOM node attributes during iterative render loops.

## 2024-06-21 - [DocumentFragment Appending Must Be Explicit]
**Learning:** When refactoring a loop to use `DocumentFragment` for batched DOM insertions to prevent reflows, it is a common pitfall to append elements to the fragment but forget to append the fragment itself to the target DOM container after the loop concludes. This causes the UI elements to entirely disappear.
**Action:** Always verify that `scrollArea.appendChild(fragment)` (or the equivalent target container) is present immediately following any loop that populates a `DocumentFragment`.
