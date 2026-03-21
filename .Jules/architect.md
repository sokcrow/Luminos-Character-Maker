## 2024-05-18 - [Random Login Audio Playback]
**Discovery:** The browser blocks autoplay unless a user clicks first. Additionally, GitHub Raw URLs require `encodeURIComponent` for folders with spaces (like "Don Quixote") to fetch `.wav` assets correctly.
**Action:** Attached the random Sinner login audio playback strictly to a user interaction (clicking the "EMPEZAR" button on the Splash Screen). Utilized `encodeURIComponent` when interpolating the Sinner name into the asset URL.
