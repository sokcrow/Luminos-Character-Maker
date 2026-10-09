# General Traits — Batch 01 (D&D 5e 2014 → Limbus)

**Canonical source:** the fourteen General Traits reviewed and adjusted in the campaign discussion. These **English descriptions and values** take priority over unadapted 2014 Feat rules. A feat becomes an optional **General Trait**, not an automatic Class Grant. The existing Class Milestone selection remains the only acquisition method.

## Format

Every definition in `js/general-trait-catalog.js` has:

- **Title** (uppercase, e.g. `DUAL WIELDER`).
- **Type:** General Trait.
- **Activation:** Passive or Manual (Reaction/Action).
- **Context:** Theatre, Combat or Theatre / Combat.
- **Prerequisites:** English text, with no redundant acquisition text.
- **Effects:** concise, numbered English mechanics.

The catalog exposes `display` for this presentation format, `rules` / `effects` for declarative Trait Engine hooks, `mechanics` for domain-specific resolvers, and `source.type = "general"` for progression. **No guessed Grants**.

## Approved Traits (1–14)

| # | Feat / Limbus name | Domain bindings | Current implementation state |
| ---: | --- | --- | --- |
| 1 | ACTOR | +1 CHA and tagged impersonation Check Threshold −4 | Executable stat rule and Theatre Check; voice mimic + opposed detection need DM context |
| 2 | ALERT | First-Turn Haste +5; Surprise immunity; counters Invisibility's +5 Final Power | Metadata contract; status and encounter bridge pending |
| 3 | ATHLETE (Strength/Dexterity) | Choice of +1 STR or DEX; standing from Prone; climbing and running jumps | Two stat-choice definitions with executable +1; feet/movement effects NOT live |
| 4 | CHARGER | +5% Melee Damage when faster than target | Conditional passive modifier available when combat modifier resolver receives target and current Speed |
| 5 | TRIGGER EXPERT | [Turn End] crossbow/firearm reload; ranged-vs-melee Clash +1 | Weapon-family contract; reload/Clash dispatcher pending |
| 6 | DEFENSIVE DUELIST | Manual Reaction, proficient Finesse Weapon, Guard +4 Defense Power vs melee, once/Turn | Action marked unavailable until an actual Guard/Reaction resolver is installed; **no wasted Reaction** |
| 7 | DUAL WIELDER | 1-handed melee each hand: +1 Defensive Level; every 2nd Coin +5% Damage | Declarative equipment modifier and Coin helper accepting granted Trait; combat caller still needs to provide the Trait |
| 8 | DUNGEON DELVER | Tagged search/save Checks Threshold −4; half Trap Damage | Theatre tagged Checks executable; trap Damage resolution pending |
| 9 | DURABLE | +1 CON; Recover adds max(2, 2 × CON Mod) HP | Executable stat rule; Recover wired to Rest Engine for given Traits |
| 10 | ELEMENTAL ADEPT (7 Sin Affinities) | Chosen Sin Affinity: +5% Spell Damage; ignore 0.3 of reducing Sin Resistance | Seven selectable variants; conditional Spell Damage modifier executable; enemy Sin Resistance adjustment pending |
| 11 | GRAPPLER | +5% Damage vs targets Grappled by self; action repeats Grapple Check and Restrains both | Action unavailable until linked Grapple resolver is added; passive grappler relation check pending |
| 12 | GREAT WEAPON MASTER | Heavy Melee: opt into −2 Clash/+15% Damage; On Crit/Kill +1 Attack Power Up next Turn once/Turn | Decision prompt, Crit/Kill stacking guard and status bridge pending |
| 13 | HEALER | [Stabilize] target gains 5% Max HP; HP Healing Item to other Unit +5% Max HP once/target/rest | Stabilize and Item Use hooks with owner/target identity + rest scope pending |
| 14 | HEAVILY ARMORED | +1 STR and Heavy Armor Proficiency; Medium Armor Proficiency prerequisite | Executable stat rule; Proficiency grant/prerequisite bridge pending; linked to Equipment Proficiency scaling rules |

## Choice encoding

- `ATHLETE`: choose **one** of `athlete_strength` and `athlete_dexterity`; the effect is +1 in the respective stat. Both represent one conceptual Feat.
- `ELEMENTAL ADEPT`: `elemental_adept_wrath`, `elemental_adept_lust`, `elemental_adept_sloth`, `elemental_adept_gluttony`, `elemental_adept_gloom`, `elemental_adept_pride`, `elemental_adept_envy`. The distinction preserves multiple selections of the same Feat with **different** affinities using the existing Milestone identity model. Do not add duplicate same-affinity bonuses.
- This batch does **not** yet enforce all choice/exclusivity or ability/armor proficiency/spellcasting prerequisites at the progression validation boundary; a future hardening pass must do so before treating these as completely player-ready.

## Existing integrations

- `js/player-trait-runtime.js` includes these Definitions among all available sources, allowing canonical Milestone selection and normal Trait resolution.
- `js/dm-trait-catalog-importer.js` synchronizes Definitions through its **atomic** catalog importer; there are no predefined Grants. Existing DM-custom Traits are preserved.
- `js/trait-engine.js` exposes `TargetSpeed` to formulas, and fixes English/Spanish stat keys for the additive Stat operation.
- `js/universal-modifier-engine.js` fixes canonical Spanish stat aliases; its conditional passive rules power tagged effects as applicable.
- `js/rest-engine.js` accepts declarative `recoverFlatBonusFormula` using `options.traits`; both Short Rest and Combat Recover send the known current Traits, preserving existing recovery calculations without Traits.
- `js/weapon-property-runtime.js` can honor `dual_wielder` in its second-Coin helper, without stacking the existing dual-Light benefit.

## Important integration boundaries

**Do not claim all 14 Traits function end-to-end in live encounters yet.** There is no universal live bridge for each new trigger, prerequisite, conditional target, item event or action. Merely placing a number in `mechanics` does not activate it. Manual combat actions for Defensive Duelist / Grappler are blocked until safe resolvers exist, instead of consuming a Reaction/Action as a no-op.

Damage/Clash and level passives are conditional on the actual runtime calling `LuminousUniversalModifiers.resolveTraitModifiers` with the relevant Trait list, target, skill and equipment. Existing legacy Combat Engine paths do not always call that resolver. The Player/DM must not infer full coverage from catalog validation.

Equipment Proficiency calculations are described in `docs/equipment-proficiency-scaling.md`; this PR does not grant categories automatically or silently apply their bonuses.

**Use the smoke test plus live combat integration tests as the completion gate**, not a successful catalog sync alone. Status-first mechanics, prereq enforcement, and unsupported physical movement remain separate blockers.
