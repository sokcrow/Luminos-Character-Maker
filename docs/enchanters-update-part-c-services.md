# Enchanter's Update — Part C: Enchanter Services, Knowledge and Magical Maintenance

Status: **design contract frozen for implementation**, with any explicitly marked balance values left as implementation data.

This document extends Parts A and B for PR #931 with the canonical service, provider, player-knowledge, delivery-time, maintenance and DM-authoring rules for Enchantments.

Random magic-loot generation remains deferred to the future **Magic Loot Update**.

## 1. Service catalog

The canonical Enchanter service layer must support:

- Enchant;
- Strengthen Enchantment;
- Remove / Rewrite Enchantment;
- Identify;
- Detect Curse;
- Identify / Decode Curse details;
- Magical Repair / Recharge;
- Intentional Bind;
- Intentional Curse;
- Mount Enchantment Gem;
- Extract Gem;
- remove an Enchantment from a Gem Anchor as a distinct destructive procedure where applicable.

These services share one validation/economy contract but providers may expose only a subset.

## 2. Reproducible ceiling: Rank III

Player-crafted and normal Enchanter-crafted Enchantments have a hard reproducible ceiling of **Rank III**.

Rank IV and Rank V Enchantments are **Relic Enchantments**:

- found in exceptionally deep Dungeons, Ruins or equivalent high-end content;
- not reproducible at full Rank by normal Players or Enchanters;
- generally exist as singular Relic-grade enchantment expressions rather than normal craft loops;
- may be studied to derive known lower-rank versions;
- can therefore become the historical/source basis for Rank I-III recipes in the Enchantment Compendium.

The runtime must never let a normal service or player-crafting path silently reproduce Rank IV/V.

## 3. Enchantment Compendium

Enchantments use a discoverable **Compendium** similar in product role to Cooking recipe knowledge.

A Compendium entry may record:

- Enchantment identity;
- known compatible Item families;
- Rank variants known;
- known resonance/affinity routes;
- known Gem Anchor routes;
- required/possible ritual materials;
- known Bind/Curse variants where discovered;
- source/book/relic provenance;
- recipe language/script;
- what the character actually understands.

Knowing a recipe exists does **not** guarantee that a character or provider can execute it.

Books, tablets, manuals and similar recipe sources are readable through the normal language/comprehension rules. If the reader does not understand the source language/script, the content is shown obfuscated/rune-like instead of leaking the recipe.

Arcane magical inscriptions remain their own identification/Arcana layer even when the surrounding book language is understood.

## 4. Provider knowledge and specialization

NPC Enchanters do **not** make a normal Player-style crafting Check.

Their advantage is professional reliability; their disadvantages are price and delivery time.

Each Enchanter Service Profile must be able to author:

- maximum reproducible Rank, never above III;
- known Enchantments / known Compendium entries;
- resonance/affinity specializations;
- Item/equipment specializations;
- Curse/Bind capability;
- facility/workshop linkage;
- service quality/reliability;
- clean-result probability or equivalent controlled-outcome profile;
- delivery-time modifiers;
- price/labor modifiers;
- supplied-material capability;
- available services.

Giving an NPC a recipe they do not know does not magically grant mastery.

An unfamiliar or off-specialization Enchantment may:

- take longer;
- have lower controlled-result probability;
- create more altered/abstract outcomes;
- have greater risk of Bind, Curse, Anchor damage/depletion or other authored magical deviation.

Specialization is therefore part of the provider's mechanical competence, not flavor text.

## 5. NPC outcome model: no binary "failed enchantment"

Professional Enchanter service does not resolve as a simple pass/fail Check.

A service instead resolves an authored magical outcome from the provider's reliability/specialization profile.

Possible result classes include:

- intended/controlled result;
- altered but usable result;
- abstract/unexpected property drift;
- accidental Bind;
- accidental Curse;
- Gem Anchor crack/depletion/loss of magic;
- other recipe-authored arcane consequences.

The resulting Item is returned to the Player unless the specific procedure destroys it.

A poor magical outcome is still an enchanting result; it is not treated like a mundane mechanical craft that simply breaks and is retried from zero.

## 6. Player self-enchanting

A Player enchanting personally still uses the Part A/B TH and Arcana-based Check model.

Passive magical understanding begins from:

```text
Passive Arcana = 10 + Arcana Mod
```

If Passive Arcana is high enough for the information tier, the Player may read that information without a roll.

If deeper analysis is required, the Player may attempt an Arcana Check repeatedly while able to pay the mental cost:

```text
Arcana study attempt cost = 1 SP
```

Each attempt represents deliberate magical analysis.

If the character cannot understand the relevant difficulty/probability/detail tier, that field is rendered as magical runes/obfuscation rather than exposing hidden numbers.

## 7. Knowledge-gated service preview

The Enchanter service UI may know the true canonical quote/result chances internally, but Player presentation is gated by the character's knowledge.

Depending on Arcana/identification knowledge, a Player may learn progressively:

- that the Item is magical;
- Enchantment name;
- Enchantment Rank;
- service difficulty;
- provider controlled-result probability;
- compatible routes/materials;
- effect/stat preview;
- Magical Durability / magical charge state;
- hidden Curse details.

A low-Arcana character may know a shop label such as `Flamebound Longsword` without being able to personally read or analyze the weapon's magical inscriptions.

The UI must never use hidden debug schema as a substitute for unread magical information.

## 8. Identify and Curse knowledge

`Identify` reveals the ordinary magical Enchantment information that it is supposed to identify.

If the Item is cursed, Identify may reveal that the Item is **Cursed** and therefore allow the Player-facing name/state to acknowledge the Curse.

Identify does **not** reveal the Curse's hidden drawback/effect description.

The Curse section remains unread/obfuscated until resolved through the dedicated Curse-reading path.

Canonical information split:

```text
Identify
-> normal Enchantment identity/effects
-> can flag Cursed
-> does not reveal Curse drawback

Detect/Decode Curse path
-> reveals the hidden Curse information according to its authored rules
```

Normal Enchantment inscriptions should read visually as blue magical writing.

Curse information should use a distinct purple/red magical presentation and remain runic/obfuscated while unknown.

## 9. Materials and service quote

Services support three material-supply modes:

- Player supplies all required materials;
- Player supplies some materials and provider supplies the rest;
- provider supplies the complete material package.

Player-supplied valid materials reduce the quoted full-service price rather than being charged again.

Canonical quote remains conceptually:

```text
Service Quote =
Labor
+ provider-supplied materials
+ facility/provider modifiers
```

The normal retail Shop markup must not be blindly multiplied over the service a second time.

Unused/recoverable Player-owned Items should be returned when the procedure allows recovery.

Materials that are actually consumed by the ritual remain consumed according to Part B.

A Gem Anchor may survive, crack, deplete, lose magical properties or be destroyed depending on the procedure/outcome.

## 10. Delivery time

Enchanter services take in-world time.

Baseline service-time bands:

- Rank I: hours;
- Rank II: approximately 1-3 days;
- Rank III: approximately one week or more.

Actual time may change with:

- Enchantment rarity;
- provider specialization;
- whether the provider already knows the recipe;
- provider/facility quality;
- Workshop tools/infrastructure;
- Item complexity;
- Bind/Curse work;
- rush/slow service profiles where authored.

A provider that works faster may trade away quality/reliability, while a slower high-quality provider may deliver a more controlled result.

Exact per-Enchantment durations belong to catalog/provider balance data.

## 11. Enchantment rarity

Enchantments may have rarity/availability metadata independent from Rank.

Rarity can affect:

- whether a provider knows it;
- how difficult it is to find a recipe;
- service time;
- material availability;
- provider reliability when working outside specialty;
- price.

Rarity does not allow normal reproduction above Rank III.

## 12. Magical Durability is an additional magical resource

This section supersedes the earlier Part A draft that split one Durability pool 50/50.

Enchanting an Item **does not cut its Physical Durability in half**.

The Item keeps its normal Physical Durability and gains a separate **Magical Durability / magical-power integrity** resource.

Magical Durability represents how long the Enchantment can keep expressing magical power before it must be repaired/recharged.

- active Enchantment use may spend Magical Durability;
- passive Enchantments may also wear over time/use according to their definition;
- Gem-Anchored Enchantments generally have better magical endurance than equivalent pure/direct Item Enchantments;
- direct/pure Item Enchantments generally have lower Magical Durability than Gem-Anchored equivalents.

Where magical protection/wear interception applies, magical integrity is depleted before ordinary physical wear reaches the Item.

At zero Magical Durability:

- the Enchantment is not permanently erased;
- the magical property becomes depleted/inactive until repaired/recharged;
- runes stop glowing or otherwise visibly indicate loss of magical power;
- a character may see that the magic stopped without understanding why or how to repair it.

Physical Durability remains a separate mundane/mechanical condition.

## 13. Bind, Curse and Magical Durability

Part D classifies Bind as a **special Curse-family state** rather than a purely beneficial standalone property.

A Bound Enchantment ignores ordinary/background magical wear. Its permanent attachment is one of its major advantages and part of why Bind is:

- harder;
- more expensive;
- rarer;
- more dangerous to author;
- impossible to remove normally;
- capable of locking equip/Attunement state.

Special activated powers may still spend their authored magical resource. Bound magic recharges faster according to its definition and may fully recharge at zero by draining the user's Life/HP according to the authored Bind profile.

Other Curses may likewise author persistence/self-preservation and magical recharge behavior.

Bind does not make the physical Item indestructible.

## 14. Magical Repair / Recharge

Magical Repair restores Magical Durability / magical-power integrity.

It does not silently restore Physical Durability.

Physical repair does not silently restore Magical Durability.

The service price should be derived from the magical structure/Anchor/Enchantment being restored plus magical labor rather than arbitrary percentage-of-full-weapon pricing.

The exact repair formula is a dedicated implementation/balance task because Part C changes Magical Durability from the old 50/50 split into an independent resource.

Player self-repair/recharge materials remain content for the future **Magic Loot Update**.

## 15. Gem mounting, removal and destructive procedures

Gem mounting is a physical-magical service.

Normal removable Gem-Anchored Enchantments may permit safe gem extraction after the Enchantment is correctly handled.

A Gem Anchor carrying **Bind** is permanent to the Item for normal gameplay.

Attempting to remove a Bound Gem Anchor:

```text
destroys the Item: 100%
```

There is no normal success roll that saves the Item from this procedure.

Two different service operations must remain distinct:

### Remove/rewrite the Item's Enchantment

The Enchantment is removed or rewritten through the Item-side procedure.

When the procedure preserves the gemstone, the gem becomes ordinary/de-enchanted but its magical quality/rarity is reduced because its magical anatomy has already been written.

The exact downgrade amount is balance/catalog data.

### Destroy/remove the Enchantment through an anchored gem

Where the procedure attacks the Gem Anchor itself, the anchored gemstone may be destroyed while leaving the Item intact.

The UI must not collapse these two procedures into one ambiguous `Remove` button.

## 16. Gem sockets are a separate capacity track

Part C clarifies a rule that supersedes the earlier Part B Resonant Overflow draft:

```text
Base Enchantment Slots
!=
Enchantment Gem Sockets
```

Pure/direct Item Enchantments continue to use the Base Enchantment Slot rules.

Physical Gem-Anchored Enchantments use the Item's **Enchantment Gem Socket** capacity instead of consuming the same Rank-to-slot arithmetic.

Canonical Gem Socket rules from the current design:

- an enchantable Item may have at most **3 Enchantment Gem Sockets** where its chassis supports gem enchanting;
- one physical Gem Anchor occupies one Gem Socket;
- one Gem Anchor channels one Enchantment;
- Gem-Anchored Enchantments may be strengthened without automatically consuming a second physical Gem Socket;
- up to three Rank II Gem-Anchored Enchantments may coexist when all three sockets are valid;
- only one Rank III Gem-Anchored Enchantment may exist on the Item;
- attempting to install a **fourth Enchantment Gem** is a catastrophic invalid operation: the Item is destroyed and the existing Gem Anchors are destroyed; the last inserted gem is the only gem left by that event.

Normal service UI should block/warn against a fourth-socket attempt rather than presenting it as an ordinary safe purchase.

Mundane decorative gemstone composition on Jewelry remains separate from these explicit Enchantment Gem Sockets.

The exact coexistence rules for a Rank III Gem Anchor alongside lower-rank Gem Anchors must be represented explicitly in validation tests/catalog data before implementation is considered complete.

## 17. Strengthening and preview

Service strengthening must be able to preview the resulting Item state when the character has enough knowledge to understand it.

Potentially visible information includes:

- current -> target Rank;
- effect/stat change;
- Gem Socket use;
- Base Enchantment Slot use for direct Enchantments;
- material requirements;
- price;
- delivery time;
- provider controlled-result probability;
- Magical Durability implications;
- incompatibility/channel consequences.

Information above the character's Arcana/identification knowledge remains runic/obfuscated.

## 18. Provider types and world availability

Enchanter capability is a profile that can be attached to:

- a specialized Enchanter NPC;
- a Shop service;
- a Workshop;
- a Jeweler/magic specialist;
- an occult/Black Market provider;
- another DM-authored provider.

They all use the same canonical service runtime.

Workshop Tier/specialization/reputation/quality may contribute to facility quality and service behavior; the Enchanter system must not duplicate Workshop infrastructure.

Independent/general providers may offer weaker/narrower enchanting service than a dedicated specialist.

Intentional Curse work is not a normal certified Enchanter baseline.

World authoring may make genuine occult/curse specialists more likely in Backstreets or hidden markets, while more comfortable districts may contain expensive but less authentic/less capable occult providers. This is world-generation/service flavor, not permission to bypass the same canonical validation.

## 19. DM authoring

DM tools must keep the system general enough to author custom magical services without exposing raw debug UI to Players.

DM configuration should support:

- provider identity/portrait;
- services offered;
- known Enchantments;
- Compendium knowledge/source;
- maximum Rank up to III;
- resonance/affinity specialties;
- equipment specialties;
- reliability/controlled-result profile;
- delivery-time profile;
- material-supply policy;
- labor/price modifier;
- linked Workshop/Shop/NPC;
- Bind availability;
- Curse availability;
- custom authored Enchantment/Curse combinations that still pass the canonical schema.

DM-authored combinations must use validated effect payloads rather than arbitrary executable code.

## 20. Player-facing Item knowledge

Loot presentation is knowledge-dependent.

A Player may recover an Item that:

- appears completely mundane except for visible runes;
- is obviously enchanted but unidentified;
- has a known shop/provider label such as `Flamebound Longsword`;
- has ordinary Enchantment details identified but Curse details hidden;
- has depleted magical runes that no longer glow.

The Player does not automatically receive hidden Enchantment name, Rank, Magical Durability, recipe or Curse drawback because the canonical Item Instance contains them.

Player-facing visibility is resolved from Arcana/Identify/Curse knowledge.

## 21. Magic Loot handoff

Enemy magical-equipment generation is **not implemented in Part C**.

The following world-balance intent is recorded for the future Magic Loot Update:

- ordinary enemies may have enchanted equipment in roughly the 5-10% range;
- spellcasters/magic-using enemies may have much higher magical-equipment rates, roughly 50-75%;
- exact rates must remain encounter/creature/content balance data.

Part C only guarantees that generated enchanted equipment can be represented, identified, depleted, repaired and serviced correctly.

## 22. Part C implementation tasks

### Service runtime

- [ ] Create canonical Enchanter Service runtime on top of the existing Shop/Workshop service architecture.
- [ ] Implement the full service list: Enchant, Strengthen, Remove/Rewrite, Identify, Curse analysis, Magical Repair/Recharge, Bind, Curse, Mount Gem and Extract Gem.
- [ ] Keep Item-side removal and Gem-Anchor destructive removal as separate service operations.
- [ ] Support Player-supplied, mixed-supply and provider-supplied material quotes.
- [ ] Return unused/recoverable Player materials without refunding ritual-consumed materials.
- [ ] Implement delivery-time state so Items can remain in service for hours/days instead of resolving every service instantly.

### Provider profile

- [ ] Add max reproducible Rank with hard cap III.
- [ ] Add known Enchantments / Compendium knowledge.
- [ ] Add resonance and equipment specializations.
- [ ] Add controlled-result reliability profile instead of NPC crafting Checks.
- [ ] Modify reliability/time when the provider works outside known recipe/specialization.
- [ ] Add Bind/Curse capability flags.
- [ ] Link Enchanter provider profiles to existing Shop/Workshop/NPC identities.
- [ ] Consume existing Workshop Tier/specialization/reputation/quality rather than duplicating Workshop state.

### Relics / Compendium

- [ ] Block Player/NPC reproduction of Rank IV/V.
- [ ] Add Relic Enchantment metadata and lower-rank derivation/knowledge seam.
- [ ] Add Enchantment Compendium entries with source/provenance.
- [ ] Add readable recipe books/manuals/tablets with language-aware obfuscation.
- [ ] Keep recipe discovery separate from execution mastery.

### Player Arcana knowledge

- [ ] Implement Passive Arcana = 10 + Arcana Mod for automatic information tiers.
- [ ] Implement repeatable active Arcana study attempts costing 1 SP each.
- [ ] Gate difficulty, percentage, effect preview and Magical Durability details by knowledge tier.
- [ ] Render unread fields as magical runes rather than hidden debug placeholders.
- [ ] Add blue Enchantment and purple/red Curse inscription presentation.

### Identify / Curse

- [ ] Make Identify reveal normal Enchantment identity/effects.
- [ ] Make Identify able to flag that an Item is Cursed without revealing the Curse drawback.
- [ ] Add dedicated Curse-reading resolution that reveals hidden Curse information.
- [ ] Keep Curse detail state separate from ordinary identified state.
- [ ] Add regression coverage so Identify never leaks the hidden Curse drawback.

### Magical outcome resolution

- [ ] Replace binary NPC success/failure with controlled/altered magical outcome resolution.
- [ ] Support authored unexpected/abstract outcomes.
- [ ] Support accidental Bind and Curse outcomes.
- [ ] Support Anchor crack/depletion/loss outcomes.
- [ ] Ensure provider specialization/reliability changes outcome distribution.
- [ ] Ensure an unknown recipe does not become guaranteed merely because the Player supplies instructions.

### Magical Durability / maintenance

- [ ] Replace the obsolete 50/50 Physical/Magical Durability split with separate full Physical Durability + Magical Durability resources.
- [ ] Add use/passive-wear hooks for Magical Durability.
- [ ] Make Gem-Anchored Enchantments generally support more Magical Durability than direct/pure Enchantments.
- [ ] Make depleted Enchantments inactive but repairable/rechargeable instead of permanently erased.
- [ ] Make depleted rune visuals stop glowing.
- [ ] Resolve magical wear before physical wear where the Enchantment is the protective/consumed layer.
- [ ] Exempt Bound Enchantments from normal magical discharge.
- [ ] Add Magical Repair/Recharge pricing contract.
- [ ] Keep physical repair and magical repair authoritative to their respective resources.

### Gem Socket service rules

- [ ] Implement explicit Enchantment Gem Sockets separately from Base Enchantment Slots.
- [ ] Enforce max 3 Enchantment Gem Sockets.
- [ ] Support up to three Rank II Gem-Anchored Enchantments where valid.
- [ ] Enforce only one Rank III Gem-Anchored Enchantment per Item.
- [ ] Finalize/test Rank III Gem coexistence with lower-rank Gem Anchors.
- [ ] Block/warn normal fourth-gem installation.
- [ ] Implement catastrophic fourth-gem forced outcome: Item and prior Gem Anchors destroyed, last inserted gem survives.
- [ ] Destroy the Item 100% when removing a Bound Gem Anchor.
- [ ] Support safe extraction of removable/non-Bound Gem Anchors.
- [ ] Implement gem magical-quality/rarity degradation after safe de-enchant/rewrite.
- [ ] Implement destructive Anchor-side Enchantment removal that can destroy the gem while preserving the Item.

### Economy / time

- [ ] Apply material discounts only for valid Player-supplied requirements.
- [ ] Keep labor/facility cost separate from provider-supplied materials.
- [ ] Do not double-apply normal Shop retail markup to service labor.
- [ ] Implement Rank I hours / Rank II 1-3 days / Rank III one-week-plus baseline durations.
- [ ] Add Enchantment rarity as a provider knowledge/time/availability/economy input.
- [ ] Support provider/facility speed-versus-reliability profiles without exposing debug controls.

### DM / Player UX

- [ ] Add general DM Enchanter profile authoring.
- [ ] Add validated custom Enchantment/Curse combination authoring.
- [ ] Add provider-specific services/specializations/material policies.
- [ ] Add Player service flow: select Item -> service -> valid options -> knowledge-gated preview -> materials -> price -> risk/time -> confirm.
- [ ] Prevent internal IDs/runtime arrays/raw schemas from appearing in Player UI.
- [ ] Preserve knowledge gating on loot, purchased Items and serviced Items.

### Tests / handoff

- [ ] Add NPC controlled-outcome tests with specialization differences.
- [ ] Add Compendium/language/rune tests.
- [ ] Add Passive Arcana and 1-SP active study tests.
- [ ] Add Identify vs hidden-Curse regression tests.
- [ ] Add delivery-time tests.
- [ ] Add partial-material/full-material quote tests.
- [ ] Add Magical Durability depletion/recharge/Bind tests.
- [ ] Add Gem Socket capacity and catastrophic fourth-gem tests.
- [ ] Add Bound Gem removal destroys-Item test.
- [ ] Add Rank IV/V reproduction rejection tests.
- [ ] Preserve Magic Loot generation rates as deferred handoff data, not Enchanter Service behavior.
