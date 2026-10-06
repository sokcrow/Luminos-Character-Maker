# Loot Update Checklist

Status: planning / implementation tracker.

This document freezes the current scope and lets the Loot Update be completed in slices without mixing in Enchanter or Magic Loot work.

## Scope rules

- [ ] Keep the Loot Update focused on mundane loot, corpse resources, search, harvest/salvage, encounter context and compendium knowledge.
- [ ] Keep Magic Items, enchantments, cursed items, magical affixes and random magical loot outside this update.
- [ ] Reserve enchanted-item creation/editing for the Enchanter's Update.
- [ ] Reserve magical drop integration for the Magic Loot Update.
- [ ] Preserve one canonical Unit Library as source of truth instead of duplicating full stat blocks into player compendiums.
- [ ] Make loot deterministic at the instance level once generated: re-searching must not regenerate the corpse/inventory.
- [ ] Enforce the rule: Skill rolls may discover/recover possible loot; they must never create impossible loot.

## Existing DM Loot tab

- [ ] Replace the legacy `RESOURCES / LOOT` table-only workflow in `pantalla_dm.html`.
- [ ] Preserve the existing DM entry point/tab instead of adding a second Loot dashboard.
- [ ] Stop copying raw global Item definitions directly into player stash.
- [ ] Route awarded/generated Items through the modern Item Instance / Inventory Runtime.
- [ ] Add DM inspection of generated loot provenance and source modifiers.
- [ ] Keep manual/custom DM loot overrides for exceptional encounters.

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
- [ ] Make Zone context visible to the DM when inspecting generated loot.

## Encounter Event modifiers

- [x] Define an Encounter Event loot modifier contract.
- [x] Let Events add otherwise unavailable loot categories when narratively justified.
- [x] Let Events guarantee authored Items.
- [x] Let Events increase/decrease rarity weights.
- [x] Let Events modify quantities and quality.
- [x] Support examples such as convoy, robbery, famine, war, evacuation, plague, medical shipment, mining expedition, smuggling operation, laboratory escape, treasure expedition and black-market deal.
- [ ] Record Event provenance on generated loot.

## Loot instance generation

- [ ] Resolve Unit Profile + Body + Role + Wealth + Zone + Event + DM overrides.
- [ ] Generate carried loot only once per Unit instance.
- [ ] Freeze generated carried loot before player search actions.
- [x] Reconcile ammunition from authoritative post-combat state before loot lock: remaining ammo plus surviving recovered projectiles; never regenerate spent ammo from the initial loadout.
- [ ] Preserve actual equipped Items separately from hidden carried Items.
- [ ] Generate/record currency once per Unit instance.
- [ ] Generate corpse harvest capacity once using Body Profile and integrity.
- [ ] Prevent repeated search/harvest from rerolling the source inventory.
- [ ] Support explicit DM regeneration only before the loot instance is locked.
- [ ] Give every generated Item proper instance IDs and provenance.

## Post-combat interactions

- [ ] Add Search Corpse for carried Items/currency.
- [ ] Add Harvest for organic/general body resources.
- [ ] Add Extract for delicate anatomical resources.
- [ ] Add Salvage for artificial/mineral/mechanical bodies.
- [ ] Add Examine / Autopsy for knowledge acquisition.
- [ ] Define which actions consume/remove recovered resources from the corpse.
- [ ] Prevent multiple players from independently extracting the same finite resource.
- [ ] Support partial discovery: hidden carried loot may remain on the corpse after a failed search.

## D&D Skill integration

- [ ] Search uses Investigation (INT) as the default check.
- [ ] Harvest uses Survival (WIS) as the default practical field check.
- [ ] Delicate organ/anatomical extraction uses Medicine (WIS).
- [ ] Autopsy supports Medicine (WIS) and Investigation (INT) for different information.
- [ ] Wire generic Combat Analyze to Perception (WIS) for observable combat information.
- [x] Define the generic Analyze resolution contract as Perception (WIS) while preserving class-feature bypass signals.
- [ ] Use actual player/ally/NPC D&D modifiers, proficiency, half proficiency and expertise.
- [ ] Use the existing Coin Engine instead of raw percentage rolls for player-facing checks.
- [ ] Keep impossible loot at probability zero regardless of roll result.
- [ ] Let successful checks reveal/recover more of an already-valid loot source rather than generating new impossible categories.

## Combat Analyze / Observation

- [ ] Replace only the generic automatic Analyze path with a real Perception-based check; preserve Ranger Favored Enemy `bypassCheck` and Battle Master Know Your Enemy `bypassAnalyseCheck` automatic-success paths.
- [ ] Use observable combat facts only.
- [ ] Allow discovery of Speed-related information.
- [ ] Allow discovery of used/observable Skills.
- [ ] Allow discovery of visible traits/behavior.
- [ ] Allow discovery of observed resistances/weaknesses after interaction.
- [ ] Do not reveal arbitrary hidden Ability Scores through combat observation alone.
- [ ] Reuse/extend `observationKnown` as encounter-level knowledge where appropriate.
- [ ] Allow successful knowledge to be kept private or shared.

## Post-combat investigation knowledge

- [ ] Let Autopsy/Examine reveal anatomy and body composition.
- [ ] Let Medicine reveal biological information.
- [ ] Let Investigation reveal technical/equipment/contextual information.
- [ ] Allow high-quality post-combat investigation to reveal selected Ability Score/stat-block facts where justified.
- [ ] Keep combat-observable and autopsy-only knowledge as separate categories.

## Player Compendium

- [ ] Create a persistent local Compendium per player.
- [ ] Reference canonical Unit IDs instead of copying full Unit definitions.
- [ ] Store knowledge as discovered facts/fields.
- [ ] Support partial entries rather than discovered/not-discovered only.
- [ ] Store known combat data.
- [ ] Store known biology/body data.
- [ ] Store known harvest data.
- [ ] Store known loot/currency ranges.
- [ ] Store known environmental/zone variants.
- [ ] Store knowledge provenance where useful.
- [ ] Support player-authored notes per Unit entry.

## Shared Compendium

- [ ] Let a player keep newly discovered information private.
- [ ] Let a player share discovered facts with the party/global shared compendium.
- [ ] Support direct player-to-player knowledge transfer where needed.
- [ ] Preserve author attribution on player notes.
- [ ] Do not merge personal notes into a single anonymous note.
- [ ] Distinguish local knowledge from shared knowledge.
- [ ] Never expose undiscovered Unit Library truth through the shared layer.

## Loot knowledge in Compendium

- [ ] Track observed possible carried Items.
- [ ] Track observed currency ranges.
- [ ] Track observed equipment.
- [ ] Track harvestable resources.
- [ ] Track edible/culinary resources.
- [ ] Track valuable organs/materials.
- [ ] Track known uses in Cooking/crafting where systems support them.
- [ ] Allow player-facing rarity labels such as Very Rare / Rare / Uncommon / Common / Likely / Guaranteed.
- [ ] Keep exact percentages hidden unless a future knowledge/perk system explicitly unlocks them.

## Inventory / provenance

- [ ] Create harvested/looted outputs as real Item Instances.
- [ ] Record source Unit ID.
- [ ] Record source Unit instance/corpse ID.
- [ ] Record Encounter ID.
- [ ] Record Encounter Zone where relevant.
- [ ] Record Encounter Event where relevant.
- [ ] Record acquisition method: search / harvest / extract / salvage / equipment / DM grant.
- [ ] Record integrity/condition where relevant.
- [ ] Preserve culinary/procedural provenance for harvested food ingredients.
- [ ] Respect Active Inventory / Stash limits and normal transfer rules.

## DM Loot Studio

- [ ] Show Unit/Profile source.
- [ ] Show Body Profile.
- [ ] Show Wealth and Role modifiers.
- [ ] Show Encounter Zone modifiers.
- [ ] Show Encounter Event modifiers.
- [ ] Show generated carried loot.
- [ ] Show corpse/harvest resources.
- [ ] Show impossible vs allowed categories.
- [ ] Allow explicit DM override/add/remove.
- [ ] Allow preview before locking a loot instance.
- [ ] Allow lock/finalize.
- [ ] Avoid player-facing debug information.

## Tests and validation

- [x] Add schema/unit tests for Loot Profiles.
- [x] Add Body Profile validation.
- [x] Add impossible-loot regression tests.
- [ ] Add deterministic instance-generation tests.
- [x] Add Zone modifier tests.
- [x] Add Event modifier tests.
- [x] Add Wealth/Role interaction tests.
- [x] Add corpse-integrity/harvest integration tests.
- [ ] Add Search/Harvest/Salvage finite-resource tests.
- [ ] Add Compendium knowledge persistence tests.
- [ ] Add private/share knowledge tests.
- [ ] Add Inventory Runtime integration tests.
- [x] Add post-combat ammunition reconciliation regression tests.
- [x] Add Analyze resolution-contract regression coverage for Ranger Favored Enemy and Battle Master Know Your Enemy bypasses.
- [ ] Add Battle Analyze end-to-end regression tests when Analyze is wired into Battle Viewer.
- [ ] Add DM Loot Studio smoke coverage.

## Explicitly deferred

- [ ] Enchanter's Update: enchanted Item authoring and enchantment mechanics.
- [ ] Magic Loot Update: magical drop pools, magical rarity, random enchantments, cursed loot and magical Encounter modifiers.
