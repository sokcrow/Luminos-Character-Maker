# Enchanter's Update — Reconciliation of Later Editorial Proposals

> **SOURCE OF TRUTH:** PR #931, `enchanters-update/checklist`. This note and all `game-codex/enchantments-review-*.js` / `game-codex/enchantment-magic-durability-review.js` entries are **DRAFT DESIGNS**, not new canonical schemas or live gameplay. The Enchanter Update belongs to PR #931, not a second parallel PR.
>
> **Do not merge or implement this material by itself.** The Part A–D contracts and existing canonical runtime remain authoritative until a reviewed design change is explicitly accepted.

## Why this note exists

On 2026-10-09, a separate design-only draft (formerly PR #963) explored 119 named Enchantments across 16 schools, including Status, HP/SP, Speed, Ability Scores, Slash/Pierce/Blunt, seven SIN affinities, universal damage, resilience and Magic Durability/recharge. This draft was originally filed as a separate PR without checking that PR #931 was already the Enchanter's Update living tracker. Those drafts were preserved here for review; **they must not be taken as approved replacements for #931**.

## Confirmed prior canonical rules on #931

| Topic | Existing canonical #931 contract | Where |
|---|---|---|
| Direct/pure slots | Tier I=0, II=1, III=1, IV=2, V=3 base slots; normal Rank I/II/III consumes 1/2/3 slots | Part A §1 |
| Gem slots | Separate maximum three Gem Sockets; multiple Rank II gem effects allowed, Rank III gem-exclusive | Parts B/C |
| Named item | `Flamebound Longsword` and `Flamebound III` in description, not generic `+N` naming | Part A §2 |
| Main damage-focused enchantments | **+10% / +15% / +25%** at Ranks I/II/III | Part A §4; `js/item-catalog-enchantments.js` |
| Authored secondary damage | **+4% / +8% / +18%**, only when explicitly present | Part A §4 |
| Magical Durability baseline | **Direct/pure: 50%** of physical Max Durability; **Gem-anchored: 75%**; normal rounding to nearest whole point | Part A §9; Part C §12; Part D §7; `js/item-enchantment-engine.js` |
| Enchantment wear | Authorized per-effect usage/passive wear; incompatible materials multiply magic wear ×2 | Part A §8–9 |
| Magical recharge | **Definition-driven**, with time, rests, rituals, Enchanter services etc; **no universal rule for all Magic Items** | Part D §8 |
| Charges & Spell Slots | Magic Item Charges backed by Magical Durability; self-powered Item Spells don't spend wielder's Spell Slots; conduits do | Part D §7–9 |
| Interaction | Multiple compatible enchanted effects allowed within slots, subject to hard conflicts and per-action exclusive channels | Part A §7 |
| Attunement | Rank I normally none; Rank II/III normally requires | Part D §3 |
| Knowledge/services/Bind/Curse | Subject to established Parts A–D, not overwritten by a later brainstorming catalog | Parts A–D |

## More recent user design directions — proposed changes to reconcile

1. **Single Base Effect / Rank scaling**: for a named Enchantment, Rank I ×1, Rank II Ceil(×1.50), Rank III Ceil(×2.50); keep the same effect rather than unrelated tier abilities. **Needs reconciliation with existing authored Part A rank data and specific damage curves.**
2. **Specialist damage amplification**: +5% base, scaling to +8% and +13%, for *one* Slash/Pierce/Blunt Damage Type or *one* SIN affinity. Premium universal damage boosters should cost more; their exact base % has **not** been approved. **Potential distinct family from Part A's dedicated main-damage baseline; must be explicitly classified.**
3. **Resistance protection**: subtract 0.06 / 0.09 / 0.15 from a matching physical/SIN Resistance value, not add it or subtract flat HP. The current physical/SIN damage application pipelines are not identical; integrate only through an authoritative path.
4. **Support effects**: HP Max +5/8/13%; HP regen 2/3/5% (timing draft); SP restoration 2/3/5; involuntary SP loss mitigation 1/2/3; conditional Speed, Offensive Level and Defensive Level changes; temporary Ability Scores.
5. **Event families**: On Turn Start, Encounter Start, On Hit, Before Getting Hit. The last requires an authoritative pre-damage event that must execute *before* damage, not a post-damage hook.
6. **Revised Magic Durability proposal:** Rank I/II/III = 75%/100%/125% of physical weapon Max Durability; cost 1 point per activation and no activation at 0. Short Rest 10%, Long Rest 30% of Max Magic Durability; consuming a Spell Slot of level L gives +5L% recharge. **This directly differs from #931's direct/pure 50% and gem 75% capacity rules, nearest-point rounding, and definition-driven recharge.** Reconcile whether source (direct/gem) affects the new capacity and whether the rest/slot rule applies universally.
7. **Wear/charge exceptions**: The PR #931 ×2 incompatible-material rule, authored passive wear, Gem Anchors, multiple effects, Bound exemption and independent Item charges must not be silently discarded to impose “1 per use” everywhere.
8. **Rounding and recovery details remain unapproved:** ceil for non-integer Magic capacity and recovery, whether spell slots may be spent outside rests, whether charges recover from zero, whether multi-Coin Skills consume one or several points, and the capacity of enchanted Armor/Shields/Accessories.
9. **Economy:** the existing Part A rank labor floors/TH and resonance compatibility matter. No invented generic crafting prices or premature approval of universal damage base values.
10. **Curse Update sequencing:** existing Bind/Curse rules in Part A–D remain documented, but this editorial pass does not extend Curse gameplay or initiate a separate Curse Update.

## Migration / implementation boundary

The entire imported standalone preview remains **read-only**: `game-codex/enchantments-review.html`, `.js`, `.css`, original catalog plus additions, and `game-codex/enchantment-magic-durability-review.js`. The separate docs catalog is `docs/enchantment-compendium-english-review.md`. None of these are the canonical `js/item-catalog-enchantments.js`, `js/item-enchantment-engine.js`, Magic Item runtime, rest, combat, persistence or service runtime.

**Next gate**: compare and explicitly approve the disputed numerical and event contracts above; only then migrate selected Enchantment definitions into the canonical #931 catalog/schema and smoke tests. The absence of a live hook is not fixed by displaying a design in the preview.

**Do not revive PR #963 as a second Enchanter workstream.** Keep the single issue/PR history under #931.

## 2026-10-09 — Owner-approved selective recovery decisions (design record only)

> **Scope and authority:** The owner explicitly approved the decisions recorded in this section while requesting **no canonical runtime changes yet**. This section is a design decision log and supersedes inconsistent assumptions *in the imported #963 review materials*. It does not silently change the frozen Part A–D implementation contracts, turn the 119 review entries into live definitions, or approve a complete #963 merge. Follow-up implementation must reconcile documents, author definitions individually, and pass gameplay regression checks.

### Earlier seven design directions, reaffirmed

1. **Individual Rank values:** preserve explicitly authored values for each Enchantment/Rank; reject a mandatory global `×1 / Ceil(×1.5) / Ceil(×2.5)` curve.
2. **Independent specialist damage family:** distinguish physical Damage Type and SIN affinity specialists from Part A's existing main-damage and optional secondary-damage families.
3. **Resistance reductions:** subtract approved `0.06 / 0.09 / 0.15` from the matching incoming-damage resistance input/multiplier, never from flat HP.
4. **Support/activation concepts:** accept the proposed HP/SP/Speed/Offensive Level/Defensive Level/Ability Score and event families as design scope; their exact triggers and stacking must be authored.
5. **Magical Durability capacity unchanged:** direct/pure `50%` and Gem-Anchored `75%` of Physical Max Durability, rounded to nearest whole point; preserve authored native Magic Item/Relic exceptions.
6. **Usage/recharge unchanged:** per-definition wear, charges and recharge; reject universal 1 point/activation, universal 10%/30% Rest recharge and blanket Spell Slot-based recharge. Keep Part A material incompatibility wear ×2, Bound ordinary-wear exemption, and authored activated costs.
7. **Rounding/edge cases:** keep existing canonical defaults for now; any novel rounding, resource-zero and exception behavior remains subject to tests, not automatically imported from #963.

### Thirteen explicit owner decisions

| # | Subject | Approved design decision | Implementation/test boundary |
|---|---|---|---|
| 1 | Specialist damage magnitude | Rank I/II/III = **+5% / +8% / +13%** | Distinct from existing main +10/15/25 and optional secondary +4/8/18 |
| 2 | Attack source | Only Skills **sourced from the enchanted weapon** qualify | Check actual Item Instance and Skill origin; do not boost unrelated attacks |
| 3 | Matching physical + SIN channels | **Choose one** eligible specialist bonus **per Skill** | Do not add or multiply a physical and SIN specialist on that Skill; follow Part A channel-choice contract |
| 4 | Main + specialist damage | **Use the largest applicable bonus** on the same eligible damage contribution | Do not globally rewrite the original Rank curves; preserve unrelated effects and resolve ties deterministically during implementation |
| 5 | Universal Sovereign Impact | **Keep as unapproved draft** | No approved base percentage, price, costs or live behavior |
| 6 | Defensive stacking | For the same resistance axis, use **only the greatest eligible reduction** | Different axes can coexist subject to Item slot/conflict rules |
| 7 | Resistance limits | Preserve physical input floor **0.30**; SIN uses its **own** established domain limits | Unify adapter semantics; do not force a 0.30 SIN floor without canonical support |
| 8 | Support numbers | **Finalize** HP Max +5/8/13%; HP regen 2/3/5%; SP restoration 2/3/5 points; involuntary SP loss mitigation 1/2/3 points | These are family-specific approved numbers, **not** universal scaling for other Enchantments; timing/rounding/gates remain per-effect |
| 9 | HP regeneration | **Turn Start**, no resurrection at **0 HP** | Apply only to living targets with missing HP; no overheal; verify one trigger per Turn |
| 10 | Buff duration/duplication | **Individually authored duration; avoid duplicates** | Define source identity, precedence, expiry and non-stacking for each buff |
| 11 | Before Getting Hit reaction | **Allow a player-selected defensive reaction** | Must occur before incoming damage, not at Damage Taken; see shield-wear interpretation below |
| 12 | Multi-Coin Skills | **One activation per eligible Skill** | Never implicitly pay once per Coin; any separately authored per-Hit effect needs its own explicit definition |
| 13 | Continuous passives | **Only expressly authored Magical Durability wear** | No automatic per-Turn or per-Encounter charge for every passive |

### Owner note on the defensive shield

Original owner wording: **“Al recibir daño en ese umbral agregado si baja ahí se consume”.**

**Working interpretation, awaiting precise implementation semantics:** if an opted-in defensive reaction adds temporary Shield, its special magical-resource wear occurs **when that added Shield actually loses points while absorbing incoming damage**, not automatically on presenting/choosing the reaction. Thus attacks that fail to reduce this added Shield should not generate the proposed shield-absorption wear. Do **not** assume an unconditional 1-point charge, apply an event after damage, or silently deduct on granting Shield as proposed in the #963 draft.

The wording does not yet conclusively fix (a) whether the resource consumed is exactly one Magical Durability point or a variable amount, (b) whether a pre-existing Shield absorbs first, (c) behavior if the Item has 0 Magical Durability at reaction time, or (d) whether a reaction can be canceled. These are **test/authoring questions, not permissions to invent behavior**. Reconcile the imported `Threshold Aegis` preview text that currently says to pay 1 point upon shield grant, even on a miss.

### Compatibility review against Part A–D

- **Part A §4:** Keep baseline dedicated damage `+10%/+15%/+25%` and explicitly authored secondary `+4%/+8%/+18%`. New +5/8/13 specialist category must be separately identified. Highest-applicable non-stacking is a new interaction rule for overlap; test how eligible scopes and independent damage adders are separated.
- **Part A §7:** Physical versus SIN choice follows the existing per-action exclusive-channel selection model. Highest-applicable damage across main and specialist must be resolved consistently with that chosen channel and hard conflicts.
- **Part A §§8–9 / Part C §12:** Preserve incompatible-material wear ×2 and independent Physical/Magical Durability; **do not** import #963's rank-based capacity or universal wear.
- **Part B:** Gem Anchor affinities, one-Enchantment-per-Anchor rules, Rank restrictions, Base Slots vs Gem Sockets, and resonance checks remain unchanged. A compatible affinity alone does not grant a damage booster.
- **Part C:** Service TH, material/reagent costs, AHN labor floors, recipe/compendium knowledge and delivery authority remain untouched. No invented specialist/universal prices.
- **Part D §§5–10:** Definition-driven hooks, Attunement, backed Charges, Spell Slot authority, and recharge remain unchanged. A chosen Before Getting Hit reaction is a future authoritative pre-damage interaction, not an existing proven hook.
- **Part D §§11–13:** Depleted enchanted Items remain physically usable; Bind and Curse exemptions and special-authorized resource costs take precedence over generic assumptions.
- **Damage implementation mismatch:** `js/item-armor-runtime.js` treats physical resistances as direct multipliers with a 0.30 minimum, whereas `js/combatEngine.js` converts `physRes` and `sinRes` through its scalar resistance modifier. Approving reductions does not approve applying raw `-0.06` to an already converted output.

### Remaining explicit test / authoring gates (not blockers for recording decisions)

- Resolve actual same-Skill physical/SIN channel selection and the strongest-applicable damage rule in multi-Coin, critical, Clash, mixed-damage and separate damage-event cases.
- Verify equipment-only source identity, Attunement state, unequipping, multiple Item Instances and deterministic stacking.
- Verify resistance-floor preservation, stronger-only stacking, SIN-specific limits and stagger paths.
- Verify HP regeneration at Turn Start (including 0 HP, max HP, absent combat/duplicate event), approved support magnitudes, expiry and same-effect buff duplication.
- Design a **real pre-damage reaction hook and player-facing selection** for Threshold Aegis; ensure missed attacks, damage absorbed by old Shield, partial/no absorption, Magical Durability 0, reconnects and turn frequency behave consistently. No raw debug UI.
- Confirm individual activation cost/wear, shield wear interpretation, and rounding where not explicitly approved. For Magic Durability capacity, retain current nearest-whole-point behavior.
- Keep Sovereign Impact editorial only and leave Curse Update and Magic Loot Update out of this task.

**Implementation status:** Design approvals recorded only; **no live canonical catalog, Part A–D runtime, combat, rest, inventory, persistence, UI, or balancing values were changed by this review.**
