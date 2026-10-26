# Canonical Native Enemy Physical Profiles

This file records the canonical D&D physical/statistical source used by the nine native enemy Units currently present in the Luminous Unit Library.

The purpose is to prevent combat balance data from silently replacing canonical physical data, and to prevent future catalog edits from reintroducing generic or placeholder Scores/Speed.

## Rule

Each native Unit stores:

- canonical Ability Scores
- canonical Skill/Save proficiency state where supported by the source stat block
- canonical creature Size
- canonical movement in feet
- canonical senses
- source creature name and source book

Luminous combat Speed is **derived** from movement + Size using `docs/canonical-speed-rules.md`.

Rank is applied after the physical base:
- Normal: +0 Min / +0 Max
- Captain: +0 Min / +1 Max
- Leader: +1 Min / +2 Max

## Profiles

| Luminous Unit | Canonical source | Size | Movement | STR | DEX | CON | INT | WIS | CHA | Proficiencies | Base Luminous Speed |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Kobold · Dagger | Kobold Warrior — Monster Manual (2025) | Small | Ground 30 ft | 7 | 15 | 9 | 8 | 7 | 8 | None | 1–8 |
| Kobold · Sling | Kobold Warrior — Monster Manual (2025) | Small | Ground 30 ft | 7 | 15 | 9 | 8 | 7 | 8 | None | 1–8 |
| Winged Kobold | Winged Kobold — Monster Manual (2025) | Small | Ground 30 ft, Fly 30 ft | 7 | 16 | 9 | 8 | 7 | 8 | None | 1–8 |
| Dragonheart Kobold | Kobold Dragonshield — Mordenkainen Presents: Monsters of the Multiverse | Small | Ground 20 ft | 12 | 15 | 14 | 8 | 9 | 10 | Perception Proficient | 1–6 |
| Scale Sorcerer Kobold | Kobold Scale Sorcerer — Mordenkainen Presents: Monsters of the Multiverse | Small | Ground 30 ft | 7 | 15 | 14 | 10 | 9 | 14 | Arcana Proficient, Medicine Proficient | 1–8 |
| Goblin | Goblin Warrior — Monster Manual (2025) | Small | Ground 30 ft | 8 | 15 | 10 | 10 | 8 | 8 | Stealth Expertise | 1–8 |
| Goblin Boss | Goblin Boss — Monster Manual (2025) | Small | Ground 30 ft | 10 | 15 | 10 | 10 | 8 | 10 | Stealth Expertise | 1–8 |
| Wolf | Wolf — Monster Manual (2025) | Medium | Ground 40 ft | 14 | 15 | 12 | 3 | 12 | 6 | Perception Expertise, Stealth Proficient | 1–8 |
| Dire Wolf | Dire Wolf — Monster Manual (2025) | Large | Ground 50 ft | 17 | 15 | 15 | 3 | 12 | 7 | Perception Expertise, Stealth Proficient | 1–9 |

The table above records **base physical Speed before Unit Rank**.

Examples after Rank:
- Dragonheart Kobold is Captain-only by current Luminous design: 1–7.
- Scale Sorcerer Kobold defaults to Captain: 1–9.
- Goblin Boss is Captain-only: 1–9.
- A Leader Kobold Warrior resolves from 1–8 to 2–10.
- A Leader Dire Wolf resolves from 1–9 to 2–11.

## Notes

- Kobold · Dagger and Kobold · Sling are Luminous equipment/loadout variants of the canonical Kobold Warrior profile.
- Dragonheart Kobold is the Luminous adaptation of the canonical Kobold Dragonshield.
- Project HP chassis, Skill power, resist/weak balance, AI, and Luminous-only Traits remain adaptation data and are not overwritten by this physical-profile pass.
