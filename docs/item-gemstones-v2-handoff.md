# Gemstones V2 — Rough, Cut, Icons, Pricing and Resonance

## Scope

This pass closes the current Gemstone family before Jewelry / Valuables.

There are 12 gemstone identities and two canonical states per gemstone:

```text
Rough Gem -> Lapidary -> Cut Gem
```

Rough gems are natural/raw gemstone pieces. Cut gems are the processed form intended for jewelry, equipment sockets and enchantment work.

## Pricing model

Currency remains AHN. Gemstones are priced **per piece**, not per Material Unit.

```text
Cut Standard value = Rough Standard value × Lapidary Multiplier
```

Pricing model:

```text
rough_value_x_lapidary_multiplier_v2
```

Lapidary profiles:

| Profile | Multiplier | Tier |
| --- | ---: | --- |
| Resonant | 2.50× | workshop |
| Precious | 2.75× | workshop |
| Exotic | 3.00× | corp_wing |

## Final gemstone values

| Gem | Rough | Cut | Profile | Resonance |
| --- | ---: | ---: | --- | --- |
| Ruby | 90,000 Ahn | 225,000 Ahn | Resonant | fire, heat |
| Sapphire | 90,000 | 225,000 | Resonant | cold, ice |
| Aquamarine | 95,000 | 237,500 | Resonant | water, flow |
| Topaz | 105,000 | 262,500 | Resonant | lightning, energy |
| Garnet | 105,000 | 262,500 | Resonant | blood, physical |
| Emerald | 120,000 | 300,000 | Resonant | vitality, nature |
| Amethyst | 135,000 | 371,250 | Precious | arcane, mental |
| Onyx | 150,000 | 412,500 | Precious | shadow, necrotic |
| Moonstone | 170,000 | 467,500 | Precious | spirit |
| Opal | 190,000 | 522,500 | Precious | prismatic |
| Diamond | 240,000 | 660,000 | Precious | light, force |
| Starstone / Exotic Gem | 400,000 | 1,200,000 | Exotic | exotic |

## Enchantment semantics

Rough gems remain valid resonant/enchantment feedstock but are not marked as fully prepared.

Cut gems are marked:

```text
enchantmentReady: true
```

and expose:

- `enchantment_material`
- `accessory_socket`
- `armor_socket`
- `weapon_socket`

Both rough and cut forms preserve the same `resonanceTags` so lapidary processing never changes the gem's intrinsic affinity.

## Icon families

Every gemstone now has a dedicated rough and cut icon family.

Examples:

```text
rough_ruby -> gem_ruby_rough
ruby       -> gem_ruby_cut

rough_sapphire -> gem_sapphire_rough
sapphire       -> gem_sapphire_cut
```

The same mapping exists for all 12 gemstones.

## Validation

- 12 rough gemstones
- 12 cut gemstones
- 24 dedicated gemstone icon families
- 0 missing icon families
- 0 rough/cut resonance mismatches
- 0 lapidary pricing formula mismatches
- all cut gemstones are enchantment-ready
- all cut gemstones support armor and accessory sockets
- combined Ore/Ingot/Gem catalog remains 98 entries

## Next family

Jewelry / Valuables can now consume:

- refined Silver / Gold / Platinum
- cut gemstones
- Quality
- gemstone resonance
- future enchantment rules
