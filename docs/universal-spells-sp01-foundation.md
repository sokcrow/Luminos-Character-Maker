# Universal Spells SP-01 — foundation and Codex review contract

## What the PR MUST do
- Boot the canonical Spell stack from the actual **decompressed** `Battle-viewer.html` runtime, not only from `combat/source/combat-v073-live.html`.
- Keep the authoritative 0.7.3 sealed-round/Firebase timeline unchanged. **Do not boot another 0.7.4 Firebase/role-UI session.**
- Initialize Content Registry, Spell Catalog, Spellcasting Basic Rules, canonical assigned loadout, 0.7.3 Action Adapter, 0.7.4 canonical Spell Adapter and handlers. Report missing modules rather than falsely reporting ready.
- Preserve canonical saved assignments (including versioned empty selections) in Player hydration.
- Display assigned but invalid Spells as disabled with localized reasons; an explicitly empty selection must not resurrect demo `permanent.spells`.
- Validate Player Spell plans at DM seal, not only in the client UI.
- Leave existing Spell Slots, class progression, legacy schema and shared replay authority intact.

## Important limitation — DO NOT MARK UNIVERSAL CASTING COMPLETE
Bootstrapping the 0.7.4 Action Adapter and effect handlers does **not** prove the
packed 0.7.3 executor invokes them. SP-04 must unify that execution path, its
resource charge/commit, Coin/Save/heal/status/Concentration effect handlers and
multiplayer playback; integration tests must prove actual execution.

## Follow-on implementation, aligned to user decisions
- SP-02: versioned per-class `known` / `prepared` / `alwaysPrepared` and audited grants. DM exceptions require verified DM authorization, `grantId`, `spellId`, `origin=dm_exception`, `authorizedByUid`, `reason`, casting ability, source revision, and explicit charge/slot cost. A client `dm_exception` flag alone grants nothing.
- SP-03: D&D 5e **2024** class-specific preparation/replacement rules, correct per-class class-level conversion to Limbus, multiclass shared slots and separate Warlock Pact Magic. Migrate spent resources without resetting `spellcastingState`.
- SP-04: CombatAction source, targeting, resource gating and effects from the real sealed-round executor.
- SP-05: Unit Capability Resolver for Players, NPCs, allies, summons and FIELD/BACKUP. Wire active GOAP, not a species-specific fallback or skill-only heuristic.
- SP-06: Character Sheet Spellbook showing known, prepared, granted and blocked spells across mobile+desktop.
- SP-07: end-to-end DM + two Players + NPC with actual packed Viewer, authority and playback.

## Extremely specific Codex review checklist
1. Read the packed/decompressed `Battle-viewer.html` entry and verify the SP-01 bootstrap actually executes at runtime; static source HTML alone is insufficient.
2. Examine dependency races, duplicate script IDs, idempotency and `battle-viewer-spell-runtime-074.js` publishing its global only once `ready`. No false-ready states.
3. Trace `fire_bolt` from DM save → RTDB `campaña/jugadores` → linked Unit → deployed Combatant → live Viewer. Include an explicitly empty V1 assignment: it MUST remain empty.
4. Does the menu display invalid **assigned** Spells disabled with understandable reason? Ensure unassigned Spells do not reappear from `permanent.spells` or `UNIT_KITS`.
5. Verify `sealRound` rejects forged/unselected/class-invalid Player Spell plans and missing canonical runtime, while NPC innate magic is not accidentally class-gated as a Player.
6. Identify whether actual sealed 0.7.3 execution calls the installed 0.7.4 adapter and effect handlers. If not, point to exact missing bridge; do not claim full execution.
7. Validate no Player gains unauthorized exceptional DM grants and no reset of resource spent counts.
8. Check player caster/noncaster, multiclass, Wizard preparation, class selection, saves, concentration, Quick/Reaction, and the 2024 shared-slot issue; report unfinished areas explicitly.
9. Check touchscreen viewports 360×800, 390×844, 844×390, 768×1024 and desktop 1280×720, 1920×1080; do not expose debug UI.

CI is delegated to GitHub; no waiting for Actions or Codex after the review request.
