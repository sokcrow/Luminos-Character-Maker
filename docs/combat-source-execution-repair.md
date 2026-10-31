# Combat source execution repair

AI and human casting now prepare the spell definition before the active packed
0.7.3 executor resolves it. The alternative GOAP compiler uses the same preparer.
The AI supplies legal choices (with optional `ai.spellChoices[spellId]`
preferences); the authored spell supplies Power, status payloads and scaling.
The selection does not read hidden target resistances or consume combat RNG.

The packed executor now translates canonical event names, preserves the selected
element through sealing, applies Poison Spray's existing-Poison multiplier, and
keeps count-based Chill Touch scaling distinct from potency. It dispatches
available automatic spell handlers, starts/ends concentration, and charges one
slot when a cast actually starts. Missing utility handlers cancel with a reason.
Quick/Reaction spells are excluded from ordinary AI Action Slot candidates.

Chromatic Orb resolves another normal hit on a critical, keeps its element,
never repeats a target, and stops after the slot-level jump budget. The shared
hit executor emits the jumps and their HP/status changes through the existing
authority/playback event path. Jumps do not spend additional slots. Shocking
Grasp's authored Counter suppression is honored by that executor as well.

Normal Action Slot Traits now invoke the same transactional Trait activation as
Quick/Free Traits, preserving authored uses and conditions without spending a
Quick Action. Spell selections are added to the hydrated combat kit, and Extra
Action replanning preserves the spell's class and slot level.

Validation uses the real native status dispatcher extracted from the source
document and the actual shared hit executor, plus the existing GOAP, real-engine
Unit AI, independent Trait, spell-loadout, bootstrap/sealing and packed-bundle
regressions. The new regression covers all six Orb choices, scaling/idempotence,
Poison Spray, Chill Touch, Ray of Frost, concentration status metadata, slot
charging, full Orb hit chains, and Skill event phases.

This is not an assertion that every spell's full gameplay contract has received
an end-to-end test. No live Firebase DM + players session or browser visual
playtest was run. Utility handlers and specialized spell runtimes still own
their authored behavior; they must be present for a successful cast.
