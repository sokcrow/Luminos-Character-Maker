# Social Link: NPC publishing and player consultation HUD

The Character Manager now has a dedicated **Social Link** tab, without the legacy actor-to-player assignment dropdown. That ownership assignment remains under **Ajustes**, and actor classification/faction stays in **Identidad**. The Social Link tab uses a named **Arcano** dropdown with the 30 agreed major/special Arcanos (no numerals in the player UI), plus a separate combatant toggle. The DM can enable it before the NPC's first save, classify it as combatant/noncombatant, and select one or more existing players. This is separate from assigning an actor as a player's character.

Saving the NPC publishes its name, title, portrait, selected Arcano ID and public introduction only to the selected players' HUD records. The player HUD resolves and displays the Arcano's Spanish name without Roman numerals. Existing links with no Arcano remain readable; when an enabled link is edited in the DM editor, an Arcano selection is required before saving. Recipient edits, actor metadata and publication changes share one RTDB root update. Removing a recipient or disabling Social Link withdraws the published entry but preserves the canonical bond's rank, affinity, memories and benefits for a later reactivation. Deleting the actor also withdraws its entries.

The per-player progress editor supports ranks 0–10, signed affinity, public story, memories and benefits. Memories and benefits are entered as one entry per line. A benefit may use `Name — Effect and conditions` to give the player an expandable detail. These are DM-authored descriptions; they do not execute gameplay effects.

The player opens **Vínculos** from the character-sheet HUD. The view contains only NPC selection, current rank/affinity, History and Benefits tabs, expandable benefits, close and retry navigation. It cannot grant points, trigger events, recruit units or activate abilities. Empty data stays empty; the UI invents no characters or rewards.

## Data and compatibility

- `campaña/base_datos_npcs/{actor}/socialLink` (or the actor's existing legacy root): enable flag, combatant classification, `arcana` (stable ID), recipients and public introduction.
- `campaña/estado_mundo/vinculos/{player}/{actor}`: existing canonical bond; ranks now normalize to 0–10. Old progress is not rescaled or reset.
- `campaña/estado_mundo/vinculos_publicados/{player}/{actor}`: explicit HUD projection with public metadata and a public progress snapshot. DM `notas` never enter this projection, and the HUD never subscribes to canonical DM bond records or the complete NPC directory.
- Identity knowledge continues to use its existing Theatre path.
- Affinity thresholds: 10, 15, 20, 30, 40, 50, 65, 80, 100, 125. Reaching a threshold does not automatically advance the rank.

Publication writes inherit the existing DM-only `estado_mundo` write rule. Player HUD reads are bound to the current authenticated character and old listeners are discarded on character/auth changes. Existing campaign-wide authenticated read access is unchanged; this patch does not claim a database confidentiality boundary between campaign participants.

Party capacity, recruitment enforcement, temperament scoring, Assist attachments and combat/shop/crafting effects are outside this UI delivery.

## Validation

`node tests/social-link-hud-smoke.mjs` checks recipient publication, rank 10, signed affinity, hidden DM notes, archived progress, metadata refresh, failure handling and no player HUD writes.

`node tests/social-link-responsive.mjs` uses Playwright/Chromium to exercise the actual editor and HUD scripts at 360×800, 390×844, 844×390, 768×1024, 1280×720 and 1920×1080. It covers create/publish, progress editing, tabs/details, dialog close, empty recipient view and horizontal overflow.

In this editing environment the smoke test passes. The responsive test is syntax-checked but not executed: the preview daemon is unavailable, local Chromium is absent, and the cloud browser rejected a data-URL test harness. Browser validation remains pending; no production Firebase session was used for testing.
