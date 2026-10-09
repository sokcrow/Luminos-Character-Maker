# Enchantment Compendium — English Design Review

> **DRAFT / NOT APPROVED / NOT PLAYABLE.** These are candidate designs, not enabled combat effects, not new Item definitions, and not canon. None of these may be published to the real Enchanter Studio or gameplay without individual review.

## Design premise

- **An enchantment is not a flat modifier.** No generic +Base Power, +Final Power, +Clash Power, or +Offense Level templates. Identity comes from combat triggers, meaningful decisions, Status interactions, escalation, and opportunity cost.
- **English player-facing names and tooltips.** Examples: a *Flamebound Longsword* has an *Flamebound III* inscription, not *Longsword +3*.
- **Rank I–III proposals are cumulative unless revised during review.** A new rank may add behavior rather than multiply a number.
- **Stay within real Limbus concepts.** Burn, Bleed, Rupture, Tremor, Sinking, Poise, Chill, Shock, Paralysis, Bind, Haste, Protection, Invisible and Radiance have actual project definitions. Specialized counters, target selection, Stagger interception and action debt require engineering design.
- **Source authority.** Weapon enchantments must only activate on Skills bound to that exact equipped Item Instance. An Armor/Accessory must be equipped; Attunement requirements still apply.
- **No runaway loops.** Each entry defines caps or once-per-turn/encounter restrictions. No instant kill, permanent stun, recursive procs, free extra actions or unbounded status copying.
- **Do not accept arbitrary costs by default.** AHN recipes and materials added in Enchanter V1.1 are an *unreviewed economic placeholder*, not canon pricing for these proposed signatures. Unique crafting costs, rarity, availability and attunement come after design approval.

**Draft coverage:** 42 named enchantments across 7 disciplines (Infernal 6; Glacial 6; Tempest 6; Sanguine 6; Umbral 6; Sanctified 6; Anomalous 6).

## Inscriptions for review

### Infernal

#### Flamebound III

**Example item:** Flamebound Longsword  
**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Burn; fixed damage; Clash Win; On Kill

> The blade remembers every flame that failed to consume it. When drawn, the embers trapped beneath its edge begin searching for something new to burn.

**Rank I —** Kindle the Wound — Once per Turn, a weapon-linked hit against an enemy with Burn consumes 1 of its Burn Count to deal Fixed Damage equal to half its Burn Potency (floor), capped at 6.

**Rank II —** Backdraft — Once per Turn, after winning a Clash with this weapon, inflict 3 Burn Potency and 2 Burn Count on the opponent after the Clash has resolved.

**Rank III —** Crown of Cinders — Once per Encounter, killing a target with at least 6 Burn Potency using this weapon transfers 3 Burn Potency and 2 Burn Count to up to two other enemies within effect range.

**Counterplay / safety —** Ranks cumulative. Only the equipped source weapon triggers it; status immunity applies. Crown requires the weapon itself to deliver the killing hit.

---

#### Ashwake III

**Allowed on:** Shield, Armor  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Burn; Guard; Shield break

> A black furnace sleeps behind the plating, opening its vents only when its bearer stands against the tide.

**Rank I —** Furnace Guard — Once per Turn, after taking damage while guarding, inflict 2 Burn Potency and 2 Count on the attacker.

**Rank II —** Coal Armor — If that attacker already has Burn, gain a temporary Shield equal to the Burn Potency applied this Turn, capped at 8 Shield.

**Rank III —** Ashen Riposte — Once per Encounter, when the gained Shield is broken by an Attack Skill, scatter Burn 2 Potency / 1 Count to the attacker and one adjacent foe.

**Counterplay / safety —** Requires a successful Guard; never triggers from self-damage, damage-over-time, or the reflected Burn. One shield generation per Turn.

---

#### Cinder Requiem III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Burn; Turn End; On Kill; temporary mark

> Every life claimed by the weapon leaves one unspoken verse smoldering along its fuller.

**Rank I —** Funeral Spark — Your first hit each Turn against a target already carrying Burn extends that target's Burn Count by 1, to the normal cap.

**Rank II —** Dirge of Ash — When that target loses Burn Count to Turn End damage, mark it Requiem-bound until the next Turn End; only one mark can exist.

**Rank III —** Last Verse — Once per Encounter, when a Requiem-bound target is killed by a weapon-linked Skill, transfer up to half its remaining Burn Potency (cap 5) as Burn with 1 Count to another target.

**Counterplay / safety —** Marks do not stack or persist beyond one Turn. No chain reactions from transferred Burn and no trigger on unrelated kills.

---

#### Emberheart III

**Allowed on:** Armor, Accessory  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Protection; Shield; Burn; damage taken; resource

> There is no warmth in the gem until the wearer has suffered for someone else.

**Rank I —** Pain to Cinder — Once per Turn, after losing HP from an enemy attack, gain Ember (1 charge, max 2) instead of an immediate bonus.

**Rank II —** Smoldering Resolve — At the next Turn Start, spend 1 Ember to gain 1 Protection for that Turn; unused charges expire at Encounter End.

**Rank III —** Phoenix Thread — Once per Encounter, when HP falls below 25% from a direct attack, consume all Ember to gain a Shield equal to 6 per charge and inflict Burn 2 Potency / 2 Count on the attacker.

**Counterplay / safety —** Does not trigger from status damage, self-inflicted costs, or allied attacks; not a resurrection or death prevention below 0 HP.

---

#### Scorchweave III

**Allowed on:** Accessory, Valuable  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Evade; Burn; Blinded; condition tag

> The cloth weighs nothing, yet smoke coils behind every motion its owner refuses to finish.

**Rank I —** Smoke Step — Once per Turn after an Evade succeeds, mark the attacker as Exposed to Cinders until Turn End.

**Rank II —** Ember Pursuit — The next weapon-linked hit against the marked target before the mark expires inflicts Burn 2 Potency / 2 Count.

**Rank III —** Blind Furnace — Once per Encounter, after two successful Evades in one Turn, inflict 1 temporary Blinded on one attacker who missed; that attacker may resist using the normal Save rule.

**Counterplay / safety —** A mark cannot trigger itself; failed Evades give nothing. Blinded must use a bounded duration and successful Save; no permanent loss of actions.

---

#### Pyrelash III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Burn; Clash Lose; On Hit; charges

> The lash draws fire from unfinished strikes, collecting the heat of blows that almost landed.

**Rank I —** Temper — Once per Turn, when a weapon Skill fails to deal damage after an enemy wins the Clash, store one Spark (max 2).

**Rank II —** Retaliation — On the next hit from this weapon, consume one Spark to inflict Burn 3 Potency / 1 Count.

**Rank III —** Firestorm — Once per Encounter, if two Sparks are stored, spend both after a weapon-linked hit to inflict Burn 2 Potency / 2 Count on the primary target and one secondary valid target.

**Counterplay / safety —** Sparks vanish at Encounter End; a Miss and a lost Clash cannot each grant a Spark for the same Skill. Never re-triggers from Burn ticks.

---

### Glacial

#### Frostwrought III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Chill; Bind; Frozen; repeated-hit tracking

> The edge is not cold; it steals the moment in which the victim expected to move.

**Rank I —** Rime Cut — Once per Turn, on the first weapon-linked hit, inflict 2 Chill Count.

**Rank II —** Brittle Momentum — If the target had Chill before being hit, extend its Chill by 2 Count and inflict 1 Bind for its next Turn.

**Rank III —** Winter's Seal — Once per Encounter, after landing three hits on the same chilled target in one Encounter, inflict Frozen 1 if the target passes the normal Chill threshold check; otherwise inflict 3 Chill.

**Counterplay / safety —** Frozen never bypasses Cold Immunity or the size-based Chill threshold. Frozen from this enchant is capped at 1 and cannot chain to annihilation.

---

#### Whiteout III

**Allowed on:** Armor  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Chill; Blinded; Evade; Protection

> The ward sheds snow that is never there, concealing the bearer in the instant before impact.

**Rank I —** Hoarfrost — Once per Turn, when a direct attack misses you, inflict 2 Chill on the attacker.

**Rank II —** Snowblind — If the attacker already had at least 6 Chill before missing, inflict 1 temporary Blinded until the next Turn End, subject to its normal Save.

**Rank III —** Fading Figure — Once per Encounter, after a successful Evade against a blinded enemy, gain 1 Protection for the next Turn and clear that enemy's Blinded from this item.

**Counterplay / safety —** No automatic evasion or guaranteed misses; Blinded is limited and saves are respected. Does not work against Cold-immune targets for Chill.

---

#### Permafrost III

**Allowed on:** Armor, Shield  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Guard; Shield; Chill; prevented-damage counter

> A sealed glacier is layered into the metal; what it cannot stop it refuses to release.

**Rank I —** Cold Vault — Once per Turn after a Guard reduces damage, store the amount prevented, capped at 6.

**Rank II —** Icebound Return — At your next Turn Start, convert stored prevented damage into an equal temporary Shield, capped at 6; stored value then resets.

**Rank III —** Fracture Memory — Once per Encounter, when that temporary Shield breaks, inflict Chill Count equal to half the stored value (floor), capped at 3, on the breaker.

**Counterplay / safety —** No amplification of full incoming damage; only validated prevented damage counts. No triggering from status damage or self-inflicted damage.

---

#### Rimeglass III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Chill; Rupture; Tremor Burst; critical hit

> Cracks along the glass edge spread inward rather than outward; each wound becomes a map of winter.

**Rank I —** Crystal Score — First hit per Turn against a target with Chill marks it Fractured for one Turn.

**Rank II —** Split Reflection — The next hit against that Fractured target inflicts 2 Rupture Potency / 2 Count and removes the mark.

**Rank III —** Shardfall — Once per Encounter, a weapon-linked Critical Hit against a Fractured target triggers Tremor Burst if the target has Tremor, then removes Fractured.

**Counterplay / safety —** Fractured expires and never stacks; Shardfall is not free Stagger and only bursts existing Tremor. No duplicate triggers from the same Hit.

---

#### Winter's Grasp III

**Allowed on:** Weapon, Accessory  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Bind; Chill; Restrained; resistance Save

> The runes do not bind flesh. They slow the decision that precedes escape.

**Rank I —** Cold Pursuit — After striking a faster target, once per Turn, apply 1 Bind for its next Turn.

**Rank II —** Fettered Prey — Against a target already affected by Bind, weapon-linked hits inflict 2 Chill; once per Turn.

**Rank III —** Closing Frost — Once per Encounter, when a Bound and Chilled target loses a Clash against you, it must make a normal resistance Save or gain 1 Restrained for one Turn.

**Counterplay / safety —** Restrained cannot persist beyond one Turn from this item; no repeated saves on a single Clash, and no bonus to Clash Power is granted.

---

#### Black Ice III

**Allowed on:** Accessory  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Evade; Chill; Haste; Stagger Threshold

> Each step leaves a shadow of ice a heartbeat behind the foot that made it.

**Rank I —** Slipstream — After a successful Evade, gain 1 Haste for your next Turn; once per Turn.

**Rank II —** Ice Trail — When you Evade an enemy suffering Chill, add 2 Chill Count to that enemy.

**Rank III —** Last Step — Once per Encounter, when an attack would cause you to cross a Stagger Threshold, you may consume your Haste to reduce that attack's Stagger damage contribution by up to 6; HP damage is unchanged.

**Counterplay / safety —** Does not prevent the HP loss or negate other stagger sources. The Stagger timing hook needs explicit implementation and review.

---

### Tempest

#### Stormwake III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Shock; Paralysis conversion; single-use charge

> The weapon calls lightning only when the wielder dares to finish the exchange.

**Rank I —** Static Scar — Once per Turn, the first weapon-linked hit on a target inflicts 2 Shock Count.

**Rank II —** Arc Step — If the target converts Shock into Paralysis at Turn Start, gain one Charge (max 1) on this weapon for the next Turn.

**Rank III —** Thunder's Due — Once per Encounter, spend that Charge after a weapon-linked hit to chain 2 Shock Count to one other visible, valid enemy.

**Counterplay / safety —** Shock and Paralysis retain canonical conversion. No automatic target selection outside valid range; charges expire after one Turn.

---

#### Thundercall III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Shock; Paralysis; Tremor; Clash Win

> The hammer announces its arrival long after the blow, when every bone remembers the thunder.

**Rank I —** First Peal — A weapon-linked hit against a target with at least 3 Shock Count inflicts 1 Paralysis; once per Turn.

**Rank II —** Rolling Thunder — After winning a Clash against a Shocked target, shift 1 Shock Count from it to a second valid enemy, if any.

**Rank III —** Thunderhead — Once per Encounter, when a target's Shock converts to Paralysis, the next hit from this weapon against that target inflicts Tremor 2 Potency / 1 Count.

**Counterplay / safety —** Does not bypass existing Paralysis caps; transferred Shock is removed from the first target and cannot cascade.

---

#### Stormcage III

**Allowed on:** Shield  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Guard; Shock; Paralysis; Shield

> Copper veins across the shield pulse whenever an enemy mistakes its silence for safety.

**Rank I —** Conductive Guard — Once per Turn, after a Guard reduces direct damage, inflict 1 Shock Count on the attacker.

**Rank II —** Cage Circuit — If the attacker already has Shock, add 2 more Shock Count and mark it Conductive until Turn End.

**Rank III —** Judgment Coil — Once per Encounter, when a Conductive attacker triggers its canonical Shock-to-Paralysis conversion, grant the bearer a temporary Shield of 8.

**Counterplay / safety —** Conductive is a mark, not an unrestricted new status. Reflections cannot loop; Shield value does not scale with party size.

---

#### Static Veil III

**Allowed on:** Armor, Accessory  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Shock; Protection; Shield; damage taken

> The air catches against the armor, holding every missed strike like a debt unpaid.

**Rank I —** Residual Current — Once per Turn, after an enemy misses you, apply 2 Shock to that enemy.

**Rank II —** Insulated Thread — If that enemy already has Shock, gain 1 Protection until Turn End after the miss.

**Rank III —** Grounding Burst — Once per Encounter, when an attacker with 6 or more Shock hits you, consume 3 Shock Count from it to grant you a Shield of 10.

**Counterplay / safety —** No effect on ranged or environmental damage without a valid attacker; the Shield does not cancel the hit that triggered it.

---

#### Galeheart III

**Allowed on:** Accessory  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Haste; Bind; Evade; ally targeting

> A trapped storm beats against the wearer's pulse whenever the battlefield changes direction.

**Rank I —** Tailwind — Once per Turn on successful Evade, gain 1 Haste for the next Turn.

**Rank II —** Slip of Fate — If you begin a Turn with Haste from this enchant, the first enemy who misses you suffers 1 Bind for the next Turn.

**Rank III —** Eye of the Storm — Once per Encounter, after two enemies miss you in the same Turn, grant one ally 1 Haste on its next Turn.

**Counterplay / safety —** Haste is never permanent and cannot grant extra Action Slots; requires two distinct enemy attacks for Rank III.

---

#### Skybreaker III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Shock; Shields; Tremor Burst; shield-break event

> The spear never chases the sky. It waits for the sky to fall onto its point.

**Rank I —** Thunderpoint — Weapon-linked hits against targets bearing a Shield inflict 2 Shock Count.

**Rank II —** Crack the Canopy — Once per Turn after hitting a Shielded target, the next weapon-linked hit against the same target deals up to 5 additional damage to its Shield only.

**Rank III —** Fallen Star — Once per Encounter, breaking a target's Shield with this weapon triggers Tremor Burst if that target already has Tremor.

**Counterplay / safety —** Does not increase damage against HP, does not create Tremor, and the Shield-specific effect cannot overflow into HP.

---

### Sanguine

#### Bloodthorn III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Bleed; Poise/Critical; Rupture

> Its crimson barbs bloom only where a living heartbeat answers the thrust.

**Rank I —** Thorned Cut — Once per Turn, the first Critical Hit with this weapon inflicts Bleed 2 Potency / 2 Count.

**Rank II —** Open Vein — Your next weapon-linked hit against that same Bleeding target increases its Bleed Potency by 2, once per Turn.

**Rank III —** Red Bloom — Once per Encounter, on a weapon-linked Critical Hit against a target with at least 5 Bleed Potency, convert 2 of its Bleed Count into 2 Rupture Potency / 2 Count.

**Counterplay / safety —** Consumes, not copies, the original Bleed Count. No triggers from Bleed self-damage and no guaranteed Critical Hits.

---

#### Crimson Oath III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Bleed; Rupture; resource expenditure; target sharing

> Each vow carved into the blade is paid for twice: once in blood, once in what remains.

**Rank I —** Blood Price — At Turn Start, you may spend 3 HP to mark the weapon Sated until Turn End. The next weapon-linked hit inflicts Bleed 2 Potency / 2 Count.

**Rank II —** Pact of Thorns — If the wielder was below 50% HP when paying, that hit also inflicts 1 Rupture Potency / 1 Count.

**Rank III —** Last Oath — Once per Encounter, when the wielder pays the Blood Price below 25% HP, the next linked hit transfers half its inflicted Bleed Potency (cap 3) to a second valid foe.

**Counterplay / safety —** Cannot pay if the HP cost would reduce the wielder to 0 or below. Paid HP is real and not refunded if the attack misses.

---

#### Hollow Fang III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Bleed; healing; Shield; Critical

> The fang drinks only what its prey can still afford to lose.

**Rank I —** Feast — Once per Turn, when the weapon hits a Bleeding enemy, recover 2 HP after damage.

**Rank II —** Deep Hunger — If the hit consumed Bleed Count from the target, recover 2 additional HP, capped at 4 total per Turn.

**Rank III —** Starving King — Once per Encounter, a Critical Hit against a Bleeding target gives the wielder a temporary Shield equal to the HP actually recovered this Turn, capped at 8.

**Counterplay / safety —** Healing never exceeds missing HP; damage-over-time does not trigger Feast. Cannot lifesteal from invalid or immune targets.

---

#### Ruptureloom III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Rupture; multiple-hit tracking; On Hit

> Fine cracks in the spearhead widen only when the target attempts to continue fighting.

**Rank I —** Seam — The first weapon-linked hit each Turn inflicts Rupture 2 Potency / 2 Count.

**Rank II —** Unravel — If the target already had Rupture, the next weapon-linked hit in the same Turn extends Rupture Count by 1, once per Turn.

**Rank III —** Threadbreaker — Once per Encounter, after three weapon-linked hits on one target, trigger that target's existing Rupture once without removing its full stack, then clear the hit counter.

**Counterplay / safety —** The extra Rupture trigger consumes its normal Count; cannot trigger from any Rupture damage tick. Three hits must be from this equipped Instance.

---

#### Butcher's Hymn III

**Allowed on:** Armor  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Poise; Bleed; Protection; damage taken

> The plates hum louder with every wound their owner survives, refusing the comfort of silence.

**Rank I —** Grim Rhythm — Once per Turn, after losing HP to a direct attack, gain Poise 2 Potency / 2 Count.

**Rank II —** Bloody Cadence — On your next Critical Hit, inflict Bleed 2 Potency / 1 Count on that hit's target.

**Rank III —** Final Chorus — Once per Encounter, when reduced below 30% HP by direct enemy damage, gain 1 Protection until the next Turn End and refresh no Poise already lost.

**Counterplay / safety —** Critical must come from a normal attack resolution. No Poise from self-damage, poison, Burn, or status ticks.

---

#### Heartseeker III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Bleed; Rupture; HP threshold; marked target

> The bowstring tightens around the sound of a failing pulse, not the shape of a target.

**Rank I —** Pulse Mark — First weapon-linked hit per Turn marks one target until the next Turn End.

**Rank II —** Follow the Beat — A second hit against that same marked enemy inflicts Bleed 2 Potency / 2 Count and clears the mark.

**Rank III —** Final Pulse — Once per Encounter, when a marked enemy falls below 25% HP due to this weapon, inflict Rupture 3 Potency / 2 Count and clear the mark.

**Counterplay / safety —** No execute, instant kill, or bypass of damage mitigation. The threshold must be crossed by a legitimate hit from this weapon.

---

### Umbral

#### Gravewhisper III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Sinking; SP; Poise; per-target mark

> Its edge carries the last thought of those who never found the strength to scream.

**Rank I —** Quiet Cut — First weapon-linked hit each Turn inflicts Sinking 2 Potency / 2 Count.

**Rank II —** Afterthought — Hitting a target that already had Sinking this Turn extends its Sinking Count by 1, once per Turn.

**Rank III —** Last Word — Once per Encounter, after a hit drains the final positive SP from a target via Sinking, gain 1 Poise Potency / 2 Count and mark that target for one Turn.

**Counterplay / safety —** Does not reduce SP past engine bounds; a target with no valid SP cannot award the Last Word bonus repeatedly.

---

#### Drownsong III

**Allowed on:** Accessory, Valuable  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Sinking; SP healing; damage taken; chosen target

> The ring sings beneath running water, but only the wearer hears the drowned choir.

**Rank I —** Undertow — After an enemy damages your SP directly, once per Turn, apply Sinking 2 Potency / 1 Count to that attacker.

**Rank II —** Low Tide — If that attacker was already Sinking, recover 2 SP after the attack resolves.

**Rank III —** Abyssal Chorus — Once per Encounter, when two different enemies damage your SP in one Turn, inflict Sinking 2 Potency / 2 Count on one valid attacker of your choice.

**Counterplay / safety —** Requires actual SP loss, not blocked or absorbed SP damage; never triggers from the wearer's own Sinking.

---

#### Nightfall III

**Allowed on:** Armor, Accessory  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Evade; Invisible; Sinking; detection

> No torch can settle on its silhouette; every witness remembers a different outline.

**Rank I —** Second Shadow — On a successful Evade, mark yourself Veiled until Turn End; once per Turn.

**Rank II —** Vanishing Point — If you evade two attacks in one Turn, gain Invisible until the next Turn Start, provided its canonical detection rules are met.

**Rank III —** Starless Return — Once per Encounter, after Invisible ends, your next hit on an already Sinking target inflicts 2 additional Sinking Count.

**Counterplay / safety —** Invisible is detection-dependent, never guaranteed untargetability. The item grants no free attacks and cannot trigger from an invalid Evade.

---

#### Void Anchor III

**Allowed on:** Shield  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Bind; Restrained; Guard; Shield; Save

> The sigil weighs nothing until the moment something tries to escape its reach.

**Rank I —** Grasp — Once per Turn, after a successful Guard against a melee attacker, inflict 1 Bind for its next Turn.

**Rank II —** Held Horizon — When a Bound enemy hits you, once per Turn, gain a temporary Shield of 5 after the damage resolves.

**Rank III —** Black Gravity — Once per Encounter, when the Bound enemy loses a Clash against you, it must Save or suffer 1 Restrained for one Turn.

**Counterplay / safety —** Does not move enemies or erase Action Slots; Restrained can be resisted and expires after one Turn.

---

#### Eclipsed Crown III

**Allowed on:** Accessory, Valuable  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Sinking; SP resource; Bind; HP/SP gate

> The crown turns whispers into debts, and demands a memory every time it answers.

**Rank I —** Borrowed Thought — At Turn Start, optionally spend 4 SP to mark one visible enemy for one Turn.

**Rank II —** Mental Debt — Your next successful hit against the marked enemy inflicts Sinking 3 Potency / 2 Count, then clears the mark.

**Rank III —** Eclipse — Once per Encounter, when a marked enemy reaches 0 SP due to your attack, recover up to 4 SP and inflict 1 Bind on that enemy for its next Turn.

**Counterplay / safety —** SP must be available to pay; marks expire without refund and cannot be placed on non-targetable enemies.

---

#### Spectral Covenant III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Stagger; Sinking; Shield; charges

> A half-forgotten oath follows the weapon from the sheath, waiting for an ally's last stand.

**Rank I —** Witness — Once per Turn when an ally crosses a Stagger Threshold, gain one Vow charge (max 2).

**Rank II —** Answer — After your next weapon-linked hit, consume 1 Vow to inflict Sinking 2 Potency / 2 Count.

**Rank III —** Unbroken Circle — Once per Encounter, spend 2 Vow after a weapon-linked hit to grant that Staggered ally a temporary Shield of 8 if it remains targetable.

**Counterplay / safety —** Only ally Stagger events award Vow, not self-triggered manipulation. Vows expire at Encounter End.

---

### Sanctified

#### Dawnbound III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Radiance; Shields; Protection; marked attacker

> Light gathers along the blade only where its bearer refuses to strike an already beaten foe.

**Rank I —** First Light — Once per Turn, after a weapon-linked hit against a Shielded enemy, inflict 2 Radiance Count.

**Rank II —** Unmask — After breaking a Shield with this weapon, transfer 1 Radiance Count to its owner if it has none.

**Rank III —** Daybreak — Once per Encounter, when a Radiant target damages an ally, gain 1 Protection until your next Turn End and mark the attacker for your next hit.

**Counterplay / safety —** No doubling of raw damage; Radiance follows its canonical interaction with Shields and cannot overflow HP on its own.

---

#### Halo of Ash III

**Allowed on:** Armor  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Protection; Shield; Status cleansing; interception

> Its halo shines only after the armor has failed to keep another from pain.

**Rank I —** Guardian Ember — Once per Turn, after taking damage while shielding an ally, gain 1 Protection for the next Turn.

**Rank II —** Sootbound Mercy — If that ally is below half HP, give the ally a temporary Shield of 5 after the intercepted hit.

**Rank III —** Witness of Dawn — Once per Encounter, after saving an ally from crossing a Stagger Threshold through interception, clear 1 nonpermanent negative Status Count from that ally.

**Counterplay / safety —** Ally interception must be a supported action and actually prevent damage. Does not resurrect or erase persistent curses.

---

#### Mercy's Last Light III

**Allowed on:** Accessory  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** SP cost; Shield; HP healing; lethal-hit window

> The glass lantern brightens in proportion to how much its owner cannot bear to lose.

**Rank I —** Keep the Flame — Once per Turn, when an ally falls below 30% HP due to direct damage, you may spend 4 SP to give that ally a Shield of 6.

**Rank II —** Shared Light — If that Shield survives until the ally's next Turn Start, restore 3 HP to the ally and remove the Shield.

**Rank III —** Beacon — Once per Encounter, if the guarded ally survives a hit that would otherwise bring it to 0 HP, the lantern may reduce that hit's damage by up to 5 instead of creating the Shield.

**Counterplay / safety —** Damage reduction is capped, not invulnerability. Does not intercept instant narrative death or revive characters already at 0 HP.

---

#### Oathkeeper III

**Allowed on:** Shield  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** interception; Guard; Protection; Shield

> Every name carved into the shield is an oath that outlived its author.

**Rank I —** Sworn Ward — At Encounter Start choose one ally; once per Turn, while guarding, you may intercept one incoming Attack Skill aimed at that ally.

**Rank II —** Steadfast — After successfully intercepting, gain 1 Protection for the rest of the Turn.

**Rank III —** Endless Watch — Once per Encounter, if the intercepted hit would cross that ally's Stagger Threshold, the bearer gains a temporary Shield of 10 before taking the intercepted damage.

**Counterplay / safety —** Needs an explicit legal reaction/Guard action and valid range. One protected ally at a time; no unlimited reactive blocks.

---

#### Sunpiercer III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Invisible; Radiance; Shield break; target detection

> Its point does not chase shadows; it makes them confess their shape.

**Rank I —** Reveal — On a weapon-linked hit against an enemy with Invisible, cancel one temporary concealment from that source, once per Turn.

**Rank II —** Scorch the Veil — On the first hit each Turn against a target with a Shield, inflict 2 Radiance Count.

**Rank III —** Open Sky — Once per Encounter, breaking a Shield from this weapon clears one temporary Invisible effect from that target and adds 2 Radiance Count.

**Counterplay / safety —** Invisible remains subject to canonical detection; cannot bypass legal targeting to hit an unseen foe without a successful detection.

---

#### Radiant Bastion III

**Allowed on:** Armor, Shield  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Guard; Shield; Protection; ally selection

> The fortress engraved inside the metal is not a place. It is a promise the bearer must keep.

**Rank I —** Shelter — After successfully guarding a direct attack, once per Turn, grant the lowest-HP nearby ally a temporary Shield of 4.

**Rank II —** Consecration — If the ally's Shield persists to Turn Start, grant that ally 1 Protection until Turn End.

**Rank III —** Citadel — Once per Encounter, after three successful Guards in the same Encounter, distribute a total Shield value of 12 among up to three allies.

**Counterplay / safety —** Guard count resets at Encounter End; no aura without successful Guards, and granted Shields never stack beyond per-target limits.

---

### Anomalous

#### Gravemark III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Tremor; Tremor Burst; multiple hits

> Each blow leaves the memory of a second impact that has not happened yet.

**Rank I —** Pressure Fracture — Once per Turn, a weapon-linked hit inflicts Tremor 3 Potency / 2 Count.

**Rank II —** Compression — When a target with Tremor loses a Clash against this weapon, extend Tremor Count by 1, once per Turn.

**Rank III —** Collapse — Once per Encounter, after three successful hits on one target, trigger Tremor Burst if Tremor is present, then clear the counter.

**Counterplay / safety —** Tremor Burst modifies Stagger Thresholds; it is not direct HP damage. No burst without existing Tremor.

---

#### Mirrorheart III

**Allowed on:** Accessory, Valuable  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Burn/Bleed/Sinking; status copy whitelist; remove Status Count

> The surface reflects the wounds it sees rather than the face that wears it.

**Rank I —** Witness — Once per Turn after a direct hit, record one qualifying negative Status from the hit (Burn, Bleed, or Sinking) at up to 2 Potency / 1 Count.

**Rank II —** Reflection — Your next successful Attack Skill inflicts the stored Status on its target, then empties the mirror.

**Rank III —** Shattered Truth — Once per Encounter, after reflection, remove 1 Count of that same Status from yourself.

**Counterplay / safety —** Only listed statuses can be copied; no copying Frozen, Paralysis, curses, or permanent conditions. Reflection does not trigger itself.

---

#### Chains of Ruin III

**Allowed on:** Weapon  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Bind; Rupture; Restrained; Save

> The links have no length until their victim tries to move away.

**Rank I —** Hook — First weapon-linked hit each Turn inflicts 1 Bind for the next Turn.

**Rank II —** Holdfast — When a target with Bind attacks someone other than the wielder, inflict 2 Rupture Potency / 1 Count on that target, once per Turn.

**Rank III —** Unbroken Chain — Once per Encounter, after winning a Clash against a Bound target, you may apply 1 Restrained for one Turn if the target fails a Save.

**Counterplay / safety —** No forced movement or aggro override. A target can Save against Restrained; no chain activation from self-damage.

---

#### Chronolock III

**Allowed on:** Accessory  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Quick Action; debt; action economy

> The watch has thirteen hands. The thirteenth moves only when the wearer has made a choice it cannot undo.

**Rank I —** Borrowed Second — Once per Encounter, before your Turn's actions resolve, borrow one Quick Action if the action economy permits it.

**Rank II —** Temporal Debt — At the beginning of your next Turn, lose one Quick Action; the debt applies even if the borrowed action was unused.

**Rank III —** Broken Hour — Rank III lets you instead lend that borrowed Quick Action to a willing ally, who incurs the same debt next Turn.

**Counterplay / safety —** Cannot generate Action Slots, Skill Coins, or extra full Actions. Cannot borrow while in Action debt; must be implemented through action-economy authority.

---

#### Requiem Coil III

**Allowed on:** Armor  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** Guard; stored prevention; Fixed Damage; Shield

> The coil listens to blows. When it speaks, it repeats only what the bearer survived.

**Rank I —** Absorb — Once per Turn, store up to 4 damage actually prevented by a Guard (Memory, maximum 8).

**Rank II —** Retort — The next weapon-linked hit consumes Memory to deal Fixed Damage equal to the consumed amount, capped at 8.

**Rank III —** Echo Chamber — Once per Encounter, after Retort, gain a temporary Shield equal to half the consumed Memory, rounded down.

**Counterplay / safety —** Only prevented damage counts, not HP lost. Does not reflect status ticks, bypass resistance, or chain from Retort damage.

---

#### Nullwake III

**Allowed on:** Weapon, Accessory  
**Status:** PROPOSED / NOT IMPLEMENTED  
**Tags:** temporary beneficial statuses; dispel whitelist; source tracking

> Everything near the relic becomes momentarily uncertain of the rules that hold it together.

**Rank I —** Interruption — Once per Turn, after hitting a target with a removable positive Status, mark that Status for disruption.

**Rank II —** Unweaving — On the next weapon-linked hit against that target, remove 1 Count of the marked positive Status and clear the mark.

**Rank III —** Stillness — Once per Encounter, if the removed Status was Protection or Haste, prevent that same source from reapplying it until the next Turn Start.

**Counterplay / safety —** Whitelist removable temporary statuses only; no stripping class Traits, permanent effects, attunement, or equipment. No global magic suppression.

---

## Approval checklist

- [ ] Naming and item display composition are accepted.
- [ ] Lore matches Limbus tone and the item's source.
- [ ] Trigger timing is unambiguous (On Hit, Clash Win, Turn Start, status conversion, etc.).
- [ ] Rank I / II / III progression changes the gameplay, not only the numeric value.
- [ ] Status stacking, Potency/Count, cap, immunity and removals respect canonical rules.
- [ ] Source Item Instance, equip slot and Attunement gating are specified.
- [ ] Cooldowns, once-per-Turn caps, target selection and anti-recursion are specified.
- [ ] The exact hook exists or the required runtime extension is documented.
- [ ] Rarity, special materials and AHN pricing receive separate approval.
- [ ] All tooltips remain readable in the inventory / Battle Viewer without dumping engine debug values.

**Implementation gate:** Until reviewed, the `game-codex/enchantments-review-catalog.js` file is read-only design data; it does not register Traits, Status effects, Item enchantments or recipes, and must not be loaded by active gameplay.
