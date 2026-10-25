# Unit Challenge Ratings + Victory XP (Luminos)

## Single existing XP engine, no Level->CR invention
The source of truth for party XP is `js/combat-xp-runtime.js`. Its fixed D&D CR->XP table is unchanged (0, 1/8, 1/4, ... 30).
Every Unit's **challengeRating** describes the D&D source stat block, not its dynamically selected Luminos level or Unit Rank. Scaling a Goblin from LV 2 to LV 60 does **not** silently recalculate CR. If the DM authors a modified monster, they can supply an explicit `threat.rating` or `xpValue` for that specific combatant.

### Source CRs for all 33 current canonical Units on main
| Family | Unit | CR | Standard XP |
|---|---|---|---:|
| Goblin | goblin (Goblin Warrior) | 1/4 | 50 |
| Goblin | goblin_boss | 1 | 200 |
| Wolf | wolf | 1/4 | 50 |
| Wolf | dire_wolf | 1 | 200 |
| Kobold | kobold_dagger | 1/8 | 25 |
| Kobold | kobold_sling | 1/8 | 25 |
| Kobold | winged_kobold | 1/4 | 50 |
| Kobold | dragonheart_kobold (Dragonshield) | 1 | 200 |
| Kobold | scale_sorcerer_kobold (Scale Sorcerer) | 1 | 200 |
| Beasts | 23 attacking `beast_cr0` species | 0 | 10 each |
| Beasts | seahorse (no attack Skill) | 0 | 0 |

D&D CR0 can award 0 **or** 10 XP according to a creature's stat block. The beast catalog already classifies these 24 as CR0; the 23 with attack Skills get explicit `xpValue:10`, and Seahorse remains 0 XP. Source: D&D 2024 Basic Rules, How to Use a Monster and Creature Stat Blocks.

The Sapphire Spider + Spiderling live in separate pending PR #1028; they are **homebrew** without an approved CR. Their rating must be configured by the DM, not guessed from their Level 30 designation.

### Web references (CR lookup)
- https://www.dndbeyond.com/monsters/5195050-goblin-warrior
- https://www.dndbeyond.com/monsters/5195047-goblin-boss
- https://www.dndbeyond.com/monsters/5195096-kobold-warrior
- https://www.dndbeyond.com/monsters/4775850-wolf
- https://www.dndbeyond.com/monsters/4775812-dire-wolf
- https://www.dndbeyond.com/sources/dnd/br-2024/how-to-use-a-monster

## DM ends Encounter with Victory
The actual Battle-viewer loads the XP runtime before its DM console:
1. DM-authorized `claimEnd()` moves Combat to `ENDING`.
2. Encounter-end effects and existing loot finalization run unchanged.
3. `awardVictoryXp()` collects enemy casualties (field and `defeated` ledger, deduplicated by combatant key), including neutralized threats. Living enemies do not award XP; `xpPolicy:none` adds zero.
4. The eligible participants are the persisted Encounter participants, excluding escaped/departed players. **Offline participants still count.**
5. The existing `resolveEncounterXp` computes `totalXp = enemyXp + fixedEncounterXp + bonusXp` and floors `totalXp/participantCount`. Remainder is recorded but not assigned arbitrarily.
6. DM-authenticated Firebase transactions on `campaña/jugadores/<playerId>` increment `xp` and atomically record `encounterXpAwards[encounterId]`. Retrying an interrupted Victory pays unpaid players only.
7. When and only when all eligible players have a durable receipt, `commitEnd()` seals `ENDED/victory`, stores `estado.xpAward`, displays the reward breakdown and returns clients to Theater.

Defeat and Cancelled: **no XP**. Escape: **no XP**. Unknown homebrew CR: **not guessed**; returned in `missingCr`, contributes 0 until given an authored `challengeRating`, `threat.rating` or `xpValue`. No arbitrary level-to-CR formula.

Only `xp` is advanced automatically. The current player progression tree reads a character's `level` and has a Level 100 limit, but there is no verified canonical XP-to-Level 100 curve. Do **not** invent one or silently change level while granting XP.

### Validation
`node tests/combat-xp-runtime-smoke.mjs`
`node tests/combat-victory-cr-xp-delivery-smoke.mjs`

Use the new workflow for automated verification; a real multi-client Firebase Victory end-to-end check should also be performed before merging.
