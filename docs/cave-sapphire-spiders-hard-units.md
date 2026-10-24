# Sapphire Spider family — Hard Unit + normal Unit (Cueva Cristalina)

Sapphire Spider is a **Hard Unit**; Sapphire Spiderling is a **normal Unit** (neither is a Boss). Both are rock elementals with crystalline sapphire growths. Both currently allow only the Normal **rank** (which is separate from Unit classification), have native Level 30 and can be spawned up to Level 65. HP = floor(HP Base + Coefficient * Level).

| Unit | Classification | Size | HP Base | Coefficient | HP L30 | OFF | DEF | Speed |
|---|---|---|---:|---:|---:|---|---|---|
| Sapphire Spider | Hard Unit | Large | 48 | 1.50 | 93 | L+2 | L-2 | 1–8 |
| Sapphire Spiderling | Unit normal | Medium | 30 | 1.20 | 66 | L-1 | L-1 | 1–7 |

Both units load the exact same full-resolution original image from the user-supplied Imgur ID 0c9WpCr: Assets/Images/Units/Cave_Crystal/sapphire_spider.png (1254×1254). The original image bytes are stored as a binary file in the repository Units folder, not as a data URL or thumbnail.

## Skills

Adult: Prismatic Slash, Crystal Thread, Hunter's Sting; Faceted Evasion. Passive Swift Predator.
Spiderling: Shard Claws, Silken Snare; Skittering Evasion. Passive Brood Instinct. The Spiderling does not have an S3.

The live Combat runtime executes conditional Coin effects and speed-based bonuses: adult 1 Haste per 3 Poise Potency at Turn Start, +5% Damage per positive Speed difference capped +20%; juvenile 1 Haste per 4 Poise Potency capped 2, damage speed bonus capped +10%. Faceted Evasion gains up to +3 Final Defense Power from Poise Count, and Skittering Evasion up to +2. Both Evades compute base and Coin Power dynamically from current DEX. Juvenile Evade Haste activates at most once per Turn.

Crystal Thread can apply up to 3 Restrained on its critical final Coin. Hunter's Sting can apply Fragile on restrained targets and boosts its final Coin Crit Damage by +20% against Restrained.

**Poise runtime compatibility:** The live Status store discards Potency-only Poise stacks when Count=0. To prevent user-authored Potency gains from vanishing, three initial Poise grants include a minimal +1 Count where otherwise required. This is a deliberate small implementation deviation, not a change to all Poise rules.

## Mineral corpse loot

Body profiles are mineral, materials stone and crystal; never edible. Recoverable families: hard_parts (crystal fragments) and hard_cover_modular (stone carapace), mapped to existing hard_exotic material items. No biological organs, meat, blood, gear or currency.

The existing postcombat resolver maps mineral bodies and stone/crystal material to Salvage / Desmontar (Arcana INT; base DC 10, +8 DC if unproficient), never Medicine-based Extract.

## Compatibility and validation

Live engine resistance bands are WEAK x1.5, NORMAL x1, RESIST x0.5. These units use Slash WEAK, Pierce RESIST, Blunt NORMAL and Pride RESIST. Previous proposal-only Pierce x0.75 is not directly supported by current resistance bands.

Smoke command: node tests/cave-sapphire-spiders-smoke.mjs. It is wired to the Loot Foundation Validation PR workflow. Workflows and Codex review are left to GitHub after PR creation.

## CR and experience

No official CR exists for these **homebrew** units in the supplied design. `challengeRating: null` and `metadata.crPending: true` are deliberate until the DM approves a value; **Level 30 is not CR 30**. The Victory XP engine logs these as missing CR rather than inventing an XP reward. A DM-supplied `threat.rating` or explicit `xpValue` on the combatant can award XP without guessing.
