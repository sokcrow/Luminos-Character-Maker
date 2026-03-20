## 2024-03-20 - [Aesthetic Enforcement on Universal FABs]
**Learning:** The prompt dictates that floating action buttons (FABs) must universally have a 36x36px ultra-compact circular icon relying entirely on emojis. However, the 'Limbus Company' visual design standards specify strict rectangular shapes (rounded-none) and matte styles, explicitly forbidding rounded pills and 'cyberpunk neon' aesthetics.
**Action:** When designing universal FAB toggles, override standard circle presets and enforce `border-radius: 0 !important` along with matte beige/black backgrounds and thin #FFD700 borders to bridge compact size requirements with strict Limbus geometry. Avoid drop-shadows that mimic neon glows.

## 2024-03-20 - Medical Diagnosis UI
**Learning:** Limbus Company medical/body-part tracking UI requires high-contrast visual states for organ status (organic vs cybernetic) and health status (critical/glitch).
**Action:** Implemented a CSS grid layout for body parts. Used cyan (`#00FFFF`) text and borders for `.cybernetic` augmentations to contrast with the deep red (`#D32F2F`) HP tracks. Applied a subtle glitch animation (`glitch-anim`) and intense red text (`#ff3333`) for `.critical-failure` states when body part HP hits 0 to immediately draw player/DM attention to loss of limb or function.
