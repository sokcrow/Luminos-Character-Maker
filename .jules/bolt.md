## 2024-05-19 - DocumentFragment batch rendering
**Learning:** Calling `appendChild` dynamically generated nodes inside long loops connected to real-time `Firebase .on("value")` listeners causes massive O(n) layout thrashing, significantly tanking UI performance on each update.
**Action:** Always isolate DOM additions using `document.createDocumentFragment()` inside heavy loops. Build the fragment internally, and then append it to the live DOM exactly once outside the loop.
