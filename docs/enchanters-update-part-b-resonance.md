# Enchanter's Update — Part B: Resonance, Gem Anchors and Enchantment Recipes

Status: **design contract frozen for implementation**.

This document extends Part A for PR #931 with the canonical rules for gemstone resonance, physical Gem Anchors, specialization/hybrid builds, consumed ritual materials and Enchantment recipe compatibility.

It does **not** author the full final Enchantment catalog or the full Magic Loot reagent catalog. Those remain content passes built on this contract.

## 1. Core model

Enchantment construction distinguishes four different concepts:

```text
Physical Item Material
!= Gem Anchor
!= Consumed Ritual Material
!= Enchantment Effect
```

They may interact, but they are not interchangeable.

- **Physical Item Material** determines the mundane structure and may be more or less compatible with magical wear.
- **Gem Anchor** is a physical gemstone mounted into the Item and used to channel one installed Enchantment.
- **Consumed Ritual Material** is spent during application/strengthening whether the attempt succeeds or fails.
- **Enchantment Effect** is the canonical magical Trait/effect definition installed on the Item.

## 2. Existing gemstone resonance remains canonical

The current gemstone catalog keeps its existing core resonances:

| Gem | Core resonance |
| --- | --- |
| Ruby | fire, heat |
| Sapphire | cold, ice |
| Aquamarine | water, flow |
| Topaz | lightning, energy |
| Garnet | blood, physical |
| Emerald | vitality, nature |
| Amethyst | arcane, mental |
| Onyx | shadow, necrotic |
| Moonstone | spirit |
| Opal | prismatic |
| Diamond | light, force |
| Starstone / Exotic Gem | exotic |

Part B does not replace these tags.

Gemstones may additionally expose **Enchantment Affinities**: broader magical branches compatible with their identity.

Examples already approved by design:

- **Ruby** may support Fire/Heat Enchantments and compatible HP/Vigor/Regeneration/Fire Resistance branches.
- **Sapphire** may support Cold/Ice and compatible SP/Intelligence/Focus/Cold Resistance branches.
- **Topaz** may support Lightning/Energy and compatible Speed/Initiative/Movement/acceleration branches.

The complete 12-gem affinity matrix remains catalog authoring work, but every added affinity must remain coherent with the gem's canonical resonance identity.

## 3. One Gem Anchor channels one Enchantment

A gemstone can have many compatible magical affinities, but one mounted Gem Anchor channels **one installed Enchantment at a time**.

Example:

```text
Ruby affinities:
- fire
- heat
- vigor
- hp
- regeneration
- fire_resistance

Installed on Item:
Ruby -> Flamebound II
```

That Ruby does not simultaneously grant HP, regeneration and fire resistance.

To obtain another Gem-Anchored effect, the Item requires another valid Gem Anchor and another Enchantment allocation.

This prevents one gemstone from becoming a bundle of every effect in its affinity family.

## 4. Gem Anchors are not consumed on successful application

When a gemstone is used as the channel for a Gem-Anchored Enchantment, the gemstone remains physically mounted in the Item.

The Enchantment resides/can be traced through that Gem Anchor.

Non-gem ritual components such as formulas, powders, essences, creature components, blood, arcane reagents or other authored materials are normally **consumed** by the ritual.

Consumed ritual materials are lost whether the attempt succeeds or fails once the application attempt begins.

## 5. Gem failure and depletion

A failed or unstable Enchantment attempt can damage the Gem Anchor.

Depending on failure severity and authored recipe behavior, a gemstone may:

- crack/break;
- lose its magical properties;
- become magically depleted;
- become unstable;
- become the source of an accidental Curse.

A broken/depleted Anchor cannot continue providing its anchored Enchantment normally.

If removal/breakage causes the Item to exceed its remaining Enchantment capacity, the dependent Enchantment becomes **Dormant** rather than being silently deleted.

## 6. Gem quality determines stable channel capacity

Gem quality determines how much Enchantment Rank a gemstone can safely channel.

Baseline:

| Gem Quality | Stable channel capacity |
| --- | ---: |
| Poor | Rank I, unstable |
| Standard | Rank I |
| Fine | up to Rank II |
| Exceptional | up to Rank III |

Trying to channel above the gemstone's stable capacity is **Overchanneling**.

Overchanneling increases difficulty and makes serious failure more likely to damage/deplete the gemstone or produce an accidental Curse.

The exact Overchannel TH penalty belongs to implementation/balance data and must be tested against Part A thresholds.

## 7. Resonance compatibility

An Enchantment recipe may define multiple compatible resonance/affinity routes.

The engine must distinguish:

- **primary / ideal compatibility**;
- **accepted compatibility**;
- **incompatible**.

A gem does not need to match only an elemental word. Non-elemental affinities such as HP, regeneration, Speed, SP, Intelligence, resistance, Force, Spirit and similar authored branches are valid when the Enchantment definition accepts them.

Opal and Starstone are **not universal substitutes**.

- Opal serves Prismatic-compatible Enchantments or authored Prismatic functions.
- Starstone serves Exotic-compatible Enchantments or authored Exotic functions.

Their value/rarity does not make them valid for every Enchantment.

## 8. Specialization versus hybrid builds

Gem composition determines the magical architecture of an Item.

### Resonance Specialization

An Item specializing in one compatible resonance/affinity family receives additional stabilization when installing or strengthening another Enchantment in that same branch.

Example:

```text
Ruby -> Flamebound I
later:
another Fire-compatible Enchantment
```

The existing Fire specialization helps reduce the Threshold.

### Hybrid Resonance

An Item with different Gem Anchor families becomes a hybrid build.

Example:

```text
Ruby     -> Flamebound
Sapphire -> Frostbound
```

Hybrid Items gain access to both branches but do not receive the same accumulated specialization benefit as a pure single-branch build.

Hybridization is not automatically penalized; it simply does not receive the full specialization bonus.

## 9. Threshold stabilization from Gem Anchors

Part A baseline application/strengthening Thresholds remain:

| Rank | Base TH |
| --- | ---: |
| I | 22 |
| II | 28 |
| III | 34 |

A compatible Gem Anchor reduces the Enchantment TH.

Baseline:

```text
Compatible Gem Anchor -> -2 TH
```

Gem quality and same-branch specialization may provide further stabilization.

The total reduction supplied by the gemstone/resonance side of the Item is capped so that a Rank I base TH 22 can reach **TH 18** from ideal gem compatibility/quality/specialization.

This is a cap on the **Item/Gem stabilization contribution**, not a global minimum TH.

External factors may reduce TH further, including authored:

- Enchantment Table;
- Arcane Workshop;
- proper specialist tools;
- specialized Enchanter facilities;
- assistants or other approved ritual infrastructure.

Improvised/poor conditions may likewise increase TH.

## 10. Base Enchantment Slots and Enchantment Gem Sockets

Part C clarifies that direct/pure Item Enchantments and physical Gem-Anchored Enchantments use **separate capacity tracks**.

```text
Base Enchantment Slots
!=
Enchantment Gem Sockets
```

Direct/pure Item Enchantments continue to use Part A Base Slot rules:

- Rank I -> 1 Base Slot;
- Rank II -> 2 Base Slots;
- Rank III -> 3 Base Slots;
- maximum Base Slots = 3.

Physical Gem-Anchored Enchantments use explicit **Enchantment Gem Sockets** instead.

Canonical Gem Socket rules:

- an enchantable chassis may support up to 3 Enchantment Gem Sockets;
- one physical Gem Anchor occupies one Gem Socket;
- one Gem Anchor channels one Enchantment;
- strengthening a Gem-Anchored Enchantment does not automatically consume another physical Gem Socket;
- up to three Rank II Gem-Anchored Enchantments may coexist where all three sockets are valid;
- only one Rank III Gem-Anchored Enchantment may exist on the Item;
- attempting to install a fourth Enchantment Gem is catastrophic: the Item and prior Gem Anchors are destroyed and the last inserted gem is the only gem left by that event.

Mundane decorative gemstone composition in Jewelry is not the same thing as an Enchantment Gem Socket.

## 11. Gem Rank pressure

Gem Anchors are intentionally more valuable/flexible than direct Enchantments because physical channeling gives them their own socket capacity and generally better Magical Durability.

This does **not** make one gem grant every affinity it possesses: one Gem Anchor still channels one installed Enchantment.

The exact validation of a Rank III Gem Anchor coexisting with lower-rank Gem Anchors must be explicit in the catalog/runtime tests before implementation is considered complete.

## 12. Per-action channel choice remains authoritative

Multiple installed Enchantments may coexist even when their active properties conflict.

When compatible Enchantments belong to an exclusive action channel, the wielder chooses which one participates in that Skill/Spell/action.

Example:

```text
Gauntlets:
Flamebound
Frostbound

Current Skill:
choose Fire OR Cold
```

The Item does not automatically apply both contradictory branches to the same action.

This rule also supports cases where one branch applies Burn and another applies a different Status/effect: only the chosen channel participates when the definitions conflict.

## 13. Consumed ritual materials and recipe semantics

Gem Anchors are only one possible Enchantment route.

Enchantment recipes may also consume:

- magical formulas;
- powders/dust;
- essences;
- creature-derived components;
- blood/ichor;
- organs/glands;
- arcane reagents;
- profane/corrupted components;
- other future Magic Loot materials.

Recipes should primarily use semantic requirements/tags so future content can expand without rewriting the engine.

Example contract:

```js
recipe: {
  requiredResonances: ["fire"],
  acceptedAffinities: ["fire", "heat", "vigor"],
  requiredTags: ["enchantment_material"],
  consumedRequirements: [
    { anyTags: ["fire_essence", "arcane_formula"], quantity: 1 }
  ]
}
```

Specific Enchantments may still require exact named Items when their fiction/mechanics demand it.

## 14. Bind construction

Bind is a special Curse-family Enchantment state. It may occur accidentally or be intentionally attempted; Part D defines its equip/Attunement lock and recharge behavior.

Bind may occur as an **accidental beneficial outcome** or be intentionally attempted.

Intentional Bind:

- increases the Enchantment Threshold;
- requires additional authored materials/work;
- retains the Part A x1.25 positive-effect multiplier;
- makes the Enchantment non-removable through normal procedure;
- remains strengthen-able.

Initial design baseline:

```text
Intentional Bind -> +4 TH
```

This value is implementation/balance data and should receive regression/economy testing.

Bind does not need to appear in the Item display name.

## 15. Curse construction

Curse may be accidental through instability/backlash or intentionally authored.

Intentional Curse uses questionable/profane/macabre materials appropriate to the Curse's drawback.

Examples of semantic Curse reagent families:

- blood/profane;
- vitality drain;
- sanity/mental corruption;
- weakness/atrophy;
- paralysis/slowness;
- cognitive impairment;
- necrotic/death;
- other authored corrupted components.

A Curse's negative effect is defined by the specific cursed Enchantment. Examples may include HP drain, SP/Sanity drain, reduced Strength, reduced Dexterity, reduced Intelligence or other authored penalties.

Part A still applies:

- positive Enchantment effect x1.50;
- Curse penalties may scale with Rank;
- Curse can strengthen;
- Curse remains hidden until detected;
- cursed market value is lower than the clean equivalent.

Initial intentional-curse difficulty baseline:

```text
Intentional Curse -> +6 TH
```

Intentional Curse also requires its profane/corrupted recipe materials.

## 16. Gem affinity catalog rule

Gemstones should provide **multiple coherent Enchantment routes**, not one hard-coded Enchantment each.

The catalog must therefore separate:

```text
core resonance
from
enchantment affinities
```

Example schema:

```js
gemMagicProfile: {
  resonances: ["lightning", "energy"],
  enchantmentAffinities: [
    "speed",
    "initiative",
    "movement",
    "lightning_damage",
    "lightning_resistance"
  ],
  canAnchorEnchantment: true
}
```

An Enchantment selects one authored route. The gemstone does not grant all affinities simultaneously.

## 17. Part B implementation tasks

### Gem magic profile

- [ ] Add canonical `gemMagicProfile` data to all 12 gemstone identities.
- [ ] Preserve existing `resonanceTags` as the core resonance source of truth.
- [ ] Author the full 12-gem Enchantment Affinity matrix.
- [ ] Validate that added affinities remain coherent with each gem's canonical resonance identity.
- [ ] Add Gem Quality -> stable Rank capacity resolution.
- [ ] Add Overchannel state and failure-risk hooks.

### Gem Anchors

- [ ] Add physical Gem Anchor linkage between mounted gemstone instance/composition and one installed Enchantment.
- [ ] Enforce one active anchored Enchantment per Gem Anchor.
- [ ] Preserve Gem Anchor identity through save/load, transfer and equipment flows.
- [ ] Implement broken/depleted/unstable Gem Anchor states.
- [ ] Make overflow-dependent Enchantments Dormant when their Anchor support disappears.
- [ ] Prevent removal/replacement flows from silently deleting dependent Enchantments.

### Recipe/resonance validation

- [ ] Add primary/accepted/incompatible resonance compatibility.
- [ ] Add non-elemental Enchantment affinity compatibility (HP, SP, INT, Speed, resistance, regeneration, etc.).
- [ ] Add semantic consumed-material requirements.
- [ ] Allow exact Item requirements for exceptional recipes.
- [ ] Consume non-gem ritual materials once an application attempt begins, success or failure.
- [ ] Keep mounted Gem Anchors on successful application.
- [ ] Apply failure outcomes that can break/deplete/corrupt the Gem Anchor.

### Specialization / hybrid resolution

- [ ] Detect same-branch Resonance Specialization.
- [ ] Detect Hybrid Resonance when different Gem Anchor families coexist.
- [ ] Apply compatible Gem Anchor baseline -2 TH.
- [ ] Apply Quality/specialization stabilization up to the approved Item/Gem reduction cap.
- [ ] Do not grant full specialization stacking to hybrid builds.
- [ ] Keep external facility/tool TH modifiers separate from Item/Gem stabilization.
- [ ] Add Enchantment Table / Arcane Workshop/tool integration seam.

### Gem Socket capacity

- [ ] Keep direct/pure Base Enchantment Slots separate from Enchantment Gem Sockets.
- [ ] Add explicit per-Item Enchantment Gem Socket capacity with hard maximum 3.
- [ ] Enforce one Gem Anchor / one Enchantment per socket.
- [ ] Allow up to three Rank II Gem-Anchored Enchantments where valid.
- [ ] Enforce only one Rank III Gem-Anchored Enchantment per Item.
- [ ] Finalize/test exact Rank III coexistence with lower-rank Gem Anchors.
- [ ] Block/warn ordinary fourth-gem installation and implement the authored catastrophic forced outcome.
- [ ] Keep mundane Jewelry gemstone composition separate from Enchantment Gem Sockets.

### Bind / Curse recipe integration

- [ ] Add intentional Bind modifier flow with initial +4 TH baseline.
- [ ] Add accidental beneficial Bind outcome hook.
- [ ] Add intentional Curse modifier flow with initial +6 TH baseline.
- [ ] Add profane/corrupted semantic reagent requirements for authored Curses.
- [ ] Allow instability/backlash to create accidental Curse only when the relevant recipe/outcome permits it.
- [ ] Preserve Part A x1.25 Bound and x1.50 Curse positive-effect modifiers while applying Part D Curse-family runtime behavior.

### Tests / CI

- [ ] Add 12-gem profile validation tests.
- [ ] Add one-anchor/one-Enchantment tests.
- [ ] Add Gem Quality Rank-cap tests.
- [ ] Add Overchannel failure tests.
- [ ] Add compatible/accepted/incompatible resonance tests.
- [ ] Add specialization versus hybrid TH tests.
- [ ] Add Item/Gem TH cap tests and external-tool separation tests.
- [ ] Add ritual-consumable loss tests on success/failure.
- [ ] Add Gem Anchor break/depletion/Dormant tests.
- [ ] Add separate Base Enchantment Slot vs Enchantment Gem Socket capacity tests, including Rank II multi-anchor, Rank III exclusivity and fourth-gem catastrophe.
- [ ] Add per-action Fire/Cold channel-choice regression tests.
- [ ] Add intentional/accidental Bind tests.
- [ ] Add intentional/accidental Curse recipe tests.
