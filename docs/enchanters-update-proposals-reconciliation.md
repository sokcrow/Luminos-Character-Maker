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
