# Loot Update Checklist

Status: planning / implementation tracker.

This document freezes the current scope and lets the Loot Update be completed in slices without mixing in Enchanter or Magic Loot work.

## Scope rules

- [x] Keep the Loot Update focused on mundane loot, corpse resources, search, harvest/salvage, encounter context and compendium knowledge.
- [x] Keep Magic Items, enchantments, cursed items, magical affixes and random magical loot outside this update.
- [x] Reserve enchanted-item creation/editing for the Enchanter's Update.
- [x] Reserve magical drop integration for the Magic Loot Update.
- [x] Preserve one canonical Unit Library as source of truth instead of duplicating full stat blocks into player compendiums.
- [x] Make loot deterministic at the instance level once generated: re-searching must not regenerate the corpse/inventory.
- [x] Enforce the rule: Skill rolls may discover/recover possible loot; they must never create impossible loot.

## Existing DM Loot tab

- [x] Replace the legacy `RESOURCES / LOOT` table-only workflow in `pantalla_dm.html`.
- [x] Preserve the existing DM entry point/tab instead of adding a second Loot dashboard.
- [x] Stop copying raw global Item definitions directly into player stash.
- [x] Route awarded/generated Items through the modern Item Instance / Inventory Runtime.
- [x] Add DM inspection of generated loot provenance and source modifiers.
- [x] Keep manual/custom DM loot overrides for exceptional encounters.

## Unit loot profile

- [x] Add a canonical Loot Profile contract to Unit Library definitions.
- [x] Separate carried loot from body harvest.
- [x] Separate actual equipped/loadout Items from random carried loot.
- [x] Support currency ranges and zero-currency outcomes.
- [x] Support consumables, tools, valuables, documents, food, ammunition and personal Items.
- [x] Support explicit impossible categories so a high roll cannot bypass world logic.
- [x] Support rarity/weight classes without requiring player-facing exact percentages.

## Body Profile

- [x] Add Body Profile data independent of creature type.
- [x] Support organic flesh/blood/bone bodies.
- [x] Support hide/pelt, scale/chitin/shell and hard-part bodies.
- [x] Support metal/mechanical bodies.
- [x] Support stone/mineral bodies.
- [x] Support wood/plant bodies.
- [x] Support ooze/gel bodies.
- [x] Support crystal/synthetic/other non-organic bodies.
- [x] Support mixed bodies with multiple recoverable material families.
- [x] Do not expose biologically impossible resources from incompatible bodies.

## Harvest / Salvage Profile

- [x] Define recoverable resources per Unit/Body Profile.
- [x] Reuse `item-harvest-integrity-engine.js` for corpse damage/integrity.
- [x] Make combat damage affect final harvestable quality/yield.
- [x] Support meat.
- [x] Support hide/pelt.
- [x] Support hard parts / bones / structural parts.
- [x] Support internal organs.
- [x] Support sensory organs.
- [x] Support brain tissue.
- [x] Support glands.
- [x] Support blood/ichor.
- [x] Support venom/secretion.
- [x] Support ooze/gel.
- [x] Add salvage equivalents for metal, stone, mechanical and synthetic bodies.
- [x] Define quantity/yield ranges by body size/species/profile.
- [x] Track whether a resource is intact, damaged, contaminated or destroyed.

## Wealth and social/economic profile

- [x] Reuse the canonical AHN salary/economic bands already present in the repository.
- [x] Give eligible humanoids/NPCs a wealth profile.
- [x] Separate wealth from carried cash.
- [x] Let wealth influence item quality/value and plausible carried categories.
- [x] Support extreme poverty, poor, low, stable-low, middle, high, Nest bands, very rich and City elite.
- [x] Avoid assuming rich units carry their total wealth on their person.
- [x] Allow valuable low-cash profiles such as scavengers carrying scrap/materials.

## Role / profession modifiers

- [x] Add role tags that modify plausible carried loot.
- [x] Support civilian.
- [x] Support worker.
- [x] Support miner.
- [x] Support cook.
- [x] Support merchant.
- [x] Support doctor/medic.
- [x] Support soldier/security.
- [x] Support Fixer.
- [x] Support executive.
- [x] Support researcher.
- [x] Support hunter.
- [x] Support scavenger.
- [x] Support cultist/smuggler/other authored roles.
- [x] Allow role-specific guaranteed equipment where appropriate.

## Encounter Zone modifiers

- [x] Define an Encounter Zone loot-context contract.
- [x] Let Zones modify availability/weights instead of rewriting canonical Item value.
- [x] Support environmental tags such as forest, mine, industrial, hospital, rich district, poor district, laboratory, ruins, etc.
- [x] Let Zones increase/decrease categories such as food, medicine, technology, gems, biomaterials and industrial materials.
- [x] Allow Zones to mark categories impossible when appropriate.
- [x] Make Zone context visible to the DM when inspecting generated loot.

## Encounter Event modifiers

- [x] Define an Encounter Event loot modifier contract.
- [x] Let Events add otherwise unavailable loot categories when narratively justified.
- [x] Let Events guarantee authored Items.
- [x] Let Events increase/decrease rarity weights.
- [x] Let Events modify quantities and quality.
- [x] Support examples such as convoy, robbery, famine, war, evacuation, plague, medical shipment, mining expedition, smuggling operation, laboratory escape, treasure expedition and black-market deal.
- [x] Record Event provenance on generated loot.

## Loot instance generation

- [x] Resolve Unit Profile + Body + Role + Wealth + Zone + Event + DM overrides.
- [x] Generate carried loot only once per Unit instance.
- [x] Freeze generated carried loot before player search actions.
- [x] Reconcile ammunition from authoritative post-combat state before loot lock: remaining ammo plus surviving recovered projectiles; never regenerate spent ammo from the initial loadout.
- [x] Preserve actual equipped Items separately from hidden carried Items.
- [x] Generate/record currency once per Unit instance.
- [x] Generate corpse harvest capacity once using Body Profile and integrity.
- [x] Prevent repeated search/harvest from rerolling the source inventory.
- [x] Support explicit DM regeneration only before the loot instance is locked.
- [x] Give every generated Item proper instance IDs and provenance.

## Post-combat interactions

- [x] Add Search Corpse for carried Items/currency.
- [x] Add Harvest for organic/general body resources.
- [x] Add Extract for delicate anatomical resources.
- [x] Add Salvage for artificial/mineral/mechanical bodies.
- [x] Add Examine / Autopsy for knowledge acquisition.
- [x] Define which actions consume/remove recovered resources from the corpse.
- [x] Prevent multiple players from independently extracting the same finite resource.
- [x] Support partial discovery: hidden carried loot may remain on the corpse after a failed search.

## D&D Skill integration

- [x] Search uses Investigation (INT) as the default check.
- [x] Harvest uses Survival (WIS) as the default practical field check.
- [x] Delicate organ/anatomical extraction uses Medicine (WIS).
- [x] Autopsy supports Medicine (WIS) and Investigation (INT) for different information.
- [x] Wire generic Combat Analyze to Perception (WIS) for observable combat information.
- [x] Define the generic Analyze resolution contract as Perception (WIS) while preserving class-feature bypass signals.
- [x] Use actual player/ally/NPC D&D modifiers, proficiency, half proficiency and expertise.
- [x] Use the existing Coin Engine instead of raw percentage rolls for player-facing checks.
- [x] Keep impossible loot at probability zero regardless of roll result.
- [x] Let successful checks reveal/recover more of an already-valid loot source rather than generating new impossible categories.

## Combat Analyze / Observation

- [x] Replace only the generic automatic Analyze path with a real Perception-based check; preserve Ranger Favored Enemy `bypassCheck` and Battle Master Know Your Enemy `bypassAnalyseCheck` automatic-success paths.
- [x] Use observable combat facts only.
- [x] Allow discovery of Speed-related information.
- [x] Allow discovery of used/observable Skills.
- [x] Allow discovery of visible traits/behavior.
- [x] Allow discovery of observed resistances/weaknesses after interaction.
- [x] Do not reveal arbitrary hidden Ability Scores through combat observation alone.
- [x] Reuse/extend `observationKnown` as encounter-level knowledge where appropriate.
- [x] Allow successful knowledge to be kept private or shared.

## Post-combat investigation knowledge

- [x] Let Autopsy/Examine reveal anatomy and body composition.
- [x] Let Medicine reveal biological information.
- [x] Let Investigation reveal technical/equipment/contextual information.
- [x] Allow high-quality post-combat investigation to reveal selected Ability Score/stat-block facts where justified.
- [x] Keep combat-observable and autopsy-only knowledge as separate categories.

## Player Compendium

- [x] Create a persistent local Compendium per player.
- [x] Reference canonical Unit IDs instead of copying full Unit definitions.
- [x] Store knowledge as discovered facts/fields.
- [x] Support partial entries rather than discovered/not-discovered only.
- [x] Store known combat data.
- [x] Store known biology/body data.
- [x] Store known harvest data.
- [x] Store known loot/currency ranges.
- [x] Store known environmental/zone variants.
- [x] Store knowledge provenance where useful.
- [x] Support player-authored notes per Unit entry.

## Shared Compendium

- [x] Let a player keep newly discovered information private.
- [x] Let a player share discovered facts with the party/global shared compendium.
- [x] Support direct player-to-player knowledge transfer where needed.
- [x] Preserve author attribution on player notes.
- [x] Do not merge personal notes into a single anonymous note.
- [x] Distinguish local knowledge from shared knowledge.
- [x] Never expose undiscovered Unit Library truth through the shared layer.

## Loot knowledge in Compendium

- [x] Track observed possible carried Items.
- [x] Track observed currency ranges.
- [x] Track observed equipment.
- [x] Track harvestable resources.
- [x] Track edible/culinary resources.
- [x] Track valuable organs/materials.
- [x] Track known uses in Cooking/crafting where systems support them.
- [x] Allow player-facing rarity labels such as Very Rare / Rare / Uncommon / Common / Likely / Guaranteed.
- [x] Keep exact percentages hidden unless a future knowledge/perk system explicitly unlocks them.

## Inventory / provenance

- [x] Create harvested/looted outputs as real Item Instances.
- [x] Record source Unit ID.
- [x] Record source Unit instance/corpse ID.
- [x] Record Encounter ID.
- [x] Record Encounter Zone where relevant.
- [x] Record Encounter Event where relevant.
- [x] Record acquisition method: search / harvest / extract / salvage / equipment / DM grant.
- [x] Record integrity/condition where relevant.
- [x] Preserve culinary/procedural provenance for harvested food ingredients.
- [x] Respect Active Inventory / Stash limits and normal transfer rules.

## DM Loot Studio

- [x] Show Unit/Profile source.
- [x] Show Body Profile.
- [x] Show Wealth and Role modifiers.
- [x] Show Encounter Zone modifiers.
- [x] Show Encounter Event modifiers.
- [x] Show generated carried loot.
- [x] Show corpse/harvest resources.
- [x] Show impossible vs allowed categories.
- [x] Allow explicit DM override/add/remove.
- [x] Allow preview before locking a loot instance.
- [x] Allow lock/finalize.
- [x] Avoid player-facing debug information.

## Tests and validation

- [x] Add schema/unit tests for Loot Profiles.
- [x] Add Body Profile validation.
- [x] Add impossible-loot regression tests.
- [x] Add deterministic instance-generation tests.
- [x] Add Zone modifier tests.
- [x] Add Event modifier tests.
- [x] Add Wealth/Role interaction tests.
- [x] Add corpse-integrity/harvest integration tests.
- [x] Add Search/Harvest/Salvage finite-resource tests.
- [x] Add Compendium knowledge persistence tests.
- [x] Add private/share knowledge tests.
- [x] Add Inventory Runtime integration tests.
- [x] Add post-combat ammunition reconciliation regression tests.
- [x] Add Analyze resolution-contract regression coverage for Ranger Favored Enemy and Battle Master Know Your Enemy bypasses.
- [x] Add Battle Analyze end-to-end regression tests when Analyze is wired into Battle Viewer.
- [x] Add DM Loot Studio smoke coverage.

## Live post-combat integration

- [x] Give every real combat Encounter a stable canonical Encounter ID.
- [x] Auto-finalize and persist locked Loot Instances for defeated loot-eligible enemies when a victorious Encounter ends.
- [x] Initialize and persist one shared post-combat Interaction State per corpse/Loot Instance.
- [x] Make finite corpse recovery concurrency-safe so multiple players cannot recover the same resource twice.
- [x] Persist recovered Item Instances into the canonical Player Active Inventory / Stash authority.
- [x] Credit recovered AHN through the canonical Player finance balance and transaction history.
- [x] Keep failed-capacity/currency deliveries as resumable idempotent Pending Deliveries.
- [x] Persist post-combat Compendium facts produced by Examine / Autopsy and recovered material knowledge.
- [x] Load the Loot post-combat runtime stack in the real Battle Viewer.
- [x] Add a clean player-facing post-combat corpse/action surface after Victory.
- [x] Add live integration regression coverage for refresh/resume, contested recovery, AHN credit and Battle Viewer bootstrap.

## Follow-up updates outside Loot

- [x] Enchanter's Update V1: magical +1/+2/+3 Item Instance authoring, DM Enchanter Studio, player inventory and Battle Viewer combat integration. Merged to `main` in [PR #957](https://github.com/sokcrow/Luminos-Character-Maker/pull/957) after 30 passing CI checks.
- [x] Enchanter's Update V1.1: AHN labor/Item valuation, Essence Units and core/cut-gem recipes, atomic Firebase ritual crafting, DM Studio price preview and public Enchantments Compendium. Merged to `main` in [PR #960](https://github.com/sokcrow/Luminos-Character-Maker/pull/960) after 6 passing CI checks.
- [ ] Enchanter's Update — live acceptance: verify authenticated DM → Firebase → player equipment/attunement → Battle Viewer, paid ritual with real player materials/AHN, concurrent attempt, and enchantment removal in a multi-client session. Automated CI and simulated runtime checks do not replace this acceptance.
- [ ] Magic Loot Update: magical drop pools, magical rarity, random enchantments, cursed loot and magical Encounter modifiers.

Enchanter V1.1 materials and numeric pricing were newly authored and documented in `docs/enchanters-update-economy-compendium-v1.md`. Gemstone resonance is compositional metadata only; elemental enchantments were **not** added.
