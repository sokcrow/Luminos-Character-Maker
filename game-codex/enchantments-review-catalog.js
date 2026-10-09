(function(global){
"use strict";
// Design-only review catalog. No gameplay registration, no enchanting API hooks.
const ENCHANTMENTS=[
  {
    "id": "flamebound",
    "name": "Flamebound",
    "school": "Infernal",
    "items": [
      "Weapon"
    ],
    "lore": "The blade remembers every flame that failed to consume it. When drawn, the embers trapped beneath its edge begin searching for something new to burn.",
    "tiers": {
      "I": "Kindle the Wound — Once per Turn, a weapon-linked hit against an enemy with Burn consumes 1 of its Burn Count to deal Fixed Damage equal to half its Burn Potency (floor), capped at 6.",
      "II": "Backdraft — Once per Turn, after winning a Clash with this weapon, inflict 3 Burn Potency and 2 Burn Count on the opponent after the Clash has resolved.",
      "III": "Crown of Cinders — Once per Encounter, killing a target with at least 6 Burn Potency using this weapon transfers 3 Burn Potency and 2 Burn Count to up to two other enemies within effect range."
    },
    "limits": "Ranks cumulative. Only the equipped source weapon triggers it; status immunity applies. Crown requires the weapon itself to deliver the killing hit.",
    "statuses": "Burn; fixed damage; Clash Win; On Kill",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "ashwake",
    "name": "Ashwake",
    "school": "Infernal",
    "items": [
      "Shield",
      "Armor"
    ],
    "lore": "A black furnace sleeps behind the plating, opening its vents only when its bearer stands against the tide.",
    "tiers": {
      "I": "Furnace Guard — Once per Turn, after taking damage while guarding, inflict 2 Burn Potency and 2 Count on the attacker.",
      "II": "Coal Armor — If that attacker already has Burn, gain a temporary Shield equal to the Burn Potency applied this Turn, capped at 8 Shield.",
      "III": "Ashen Riposte — Once per Encounter, when the gained Shield is broken by an Attack Skill, scatter Burn 2 Potency / 1 Count to the attacker and one adjacent foe."
    },
    "limits": "Requires a successful Guard; never triggers from self-damage, damage-over-time, or the reflected Burn. One shield generation per Turn.",
    "statuses": "Burn; Guard; Shield break",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "cinder_requiem",
    "name": "Cinder Requiem",
    "school": "Infernal",
    "items": [
      "Weapon"
    ],
    "lore": "Every life claimed by the weapon leaves one unspoken verse smoldering along its fuller.",
    "tiers": {
      "I": "Funeral Spark — Your first hit each Turn against a target already carrying Burn extends that target's Burn Count by 1, to the normal cap.",
      "II": "Dirge of Ash — When that target loses Burn Count to Turn End damage, mark it Requiem-bound until the next Turn End; only one mark can exist.",
      "III": "Last Verse — Once per Encounter, when a Requiem-bound target is killed by a weapon-linked Skill, transfer up to half its remaining Burn Potency (cap 5) as Burn with 1 Count to another target."
    },
    "limits": "Marks do not stack or persist beyond one Turn. No chain reactions from transferred Burn and no trigger on unrelated kills.",
    "statuses": "Burn; Turn End; On Kill; temporary mark",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "emberheart",
    "name": "Emberheart",
    "school": "Infernal",
    "items": [
      "Armor",
      "Accessory"
    ],
    "lore": "There is no warmth in the gem until the wearer has suffered for someone else.",
    "tiers": {
      "I": "Pain to Cinder — Once per Turn, after losing HP from an enemy attack, gain Ember (1 charge, max 2) instead of an immediate bonus.",
      "II": "Smoldering Resolve — At the next Turn Start, spend 1 Ember to gain 1 Protection for that Turn; unused charges expire at Encounter End.",
      "III": "Phoenix Thread — Once per Encounter, when HP falls below 25% from a direct attack, consume all Ember to gain a Shield equal to 6 per charge and inflict Burn 2 Potency / 2 Count on the attacker."
    },
    "limits": "Does not trigger from status damage, self-inflicted costs, or allied attacks; not a resurrection or death prevention below 0 HP.",
    "statuses": "Protection; Shield; Burn; damage taken; resource",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "scorchweave",
    "name": "Scorchweave",
    "school": "Infernal",
    "items": [
      "Accessory",
      "Valuable"
    ],
    "lore": "The cloth weighs nothing, yet smoke coils behind every motion its owner refuses to finish.",
    "tiers": {
      "I": "Smoke Step — Once per Turn after an Evade succeeds, mark the attacker as Exposed to Cinders until Turn End.",
      "II": "Ember Pursuit — The next weapon-linked hit against the marked target before the mark expires inflicts Burn 2 Potency / 2 Count.",
      "III": "Blind Furnace — Once per Encounter, after two successful Evades in one Turn, inflict 1 temporary Blinded on one attacker who missed; that attacker may resist using the normal Save rule."
    },
    "limits": "A mark cannot trigger itself; failed Evades give nothing. Blinded must use a bounded duration and successful Save; no permanent loss of actions.",
    "statuses": "Evade; Burn; Blinded; condition tag",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "pyrelash",
    "name": "Pyrelash",
    "school": "Infernal",
    "items": [
      "Weapon"
    ],
    "lore": "The lash draws fire from unfinished strikes, collecting the heat of blows that almost landed.",
    "tiers": {
      "I": "Temper — Once per Turn, when a weapon Skill fails to deal damage after an enemy wins the Clash, store one Spark (max 2).",
      "II": "Retaliation — On the next hit from this weapon, consume one Spark to inflict Burn 3 Potency / 1 Count.",
      "III": "Firestorm — Once per Encounter, if two Sparks are stored, spend both after a weapon-linked hit to inflict Burn 2 Potency / 2 Count on the primary target and one secondary valid target."
    },
    "limits": "Sparks vanish at Encounter End; a Miss and a lost Clash cannot each grant a Spark for the same Skill. Never re-triggers from Burn ticks.",
    "statuses": "Burn; Clash Lose; On Hit; charges",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "frostwrought",
    "name": "Frostwrought",
    "school": "Glacial",
    "items": [
      "Weapon"
    ],
    "lore": "The edge is not cold; it steals the moment in which the victim expected to move.",
    "tiers": {
      "I": "Rime Cut — Once per Turn, on the first weapon-linked hit, inflict 2 Chill Count.",
      "II": "Brittle Momentum — If the target had Chill before being hit, extend its Chill by 2 Count and inflict 1 Bind for its next Turn.",
      "III": "Winter's Seal — Once per Encounter, after landing three hits on the same chilled target in one Encounter, inflict Frozen 1 if the target passes the normal Chill threshold check; otherwise inflict 3 Chill."
    },
    "limits": "Frozen never bypasses Cold Immunity or the size-based Chill threshold. Frozen from this enchant is capped at 1 and cannot chain to annihilation.",
    "statuses": "Chill; Bind; Frozen; repeated-hit tracking",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "whiteout",
    "name": "Whiteout",
    "school": "Glacial",
    "items": [
      "Armor"
    ],
    "lore": "The ward sheds snow that is never there, concealing the bearer in the instant before impact.",
    "tiers": {
      "I": "Hoarfrost — Once per Turn, when a direct attack misses you, inflict 2 Chill on the attacker.",
      "II": "Snowblind — If the attacker already had at least 6 Chill before missing, inflict 1 temporary Blinded until the next Turn End, subject to its normal Save.",
      "III": "Fading Figure — Once per Encounter, after a successful Evade against a blinded enemy, gain 1 Protection for the next Turn and clear that enemy's Blinded from this item."
    },
    "limits": "No automatic evasion or guaranteed misses; Blinded is limited and saves are respected. Does not work against Cold-immune targets for Chill.",
    "statuses": "Chill; Blinded; Evade; Protection",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "permafrost",
    "name": "Permafrost",
    "school": "Glacial",
    "items": [
      "Armor",
      "Shield"
    ],
    "lore": "A sealed glacier is layered into the metal; what it cannot stop it refuses to release.",
    "tiers": {
      "I": "Cold Vault — Once per Turn after a Guard reduces damage, store the amount prevented, capped at 6.",
      "II": "Icebound Return — At your next Turn Start, convert stored prevented damage into an equal temporary Shield, capped at 6; stored value then resets.",
      "III": "Fracture Memory — Once per Encounter, when that temporary Shield breaks, inflict Chill Count equal to half the stored value (floor), capped at 3, on the breaker."
    },
    "limits": "No amplification of full incoming damage; only validated prevented damage counts. No triggering from status damage or self-inflicted damage.",
    "statuses": "Guard; Shield; Chill; prevented-damage counter",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "rimeglass",
    "name": "Rimeglass",
    "school": "Glacial",
    "items": [
      "Weapon"
    ],
    "lore": "Cracks along the glass edge spread inward rather than outward; each wound becomes a map of winter.",
    "tiers": {
      "I": "Crystal Score — First hit per Turn against a target with Chill marks it Fractured for one Turn.",
      "II": "Split Reflection — The next hit against that Fractured target inflicts 2 Rupture Potency / 2 Count and removes the mark.",
      "III": "Shardfall — Once per Encounter, a weapon-linked Critical Hit against a Fractured target triggers Tremor Burst if the target has Tremor, then removes Fractured."
    },
    "limits": "Fractured expires and never stacks; Shardfall is not free Stagger and only bursts existing Tremor. No duplicate triggers from the same Hit.",
    "statuses": "Chill; Rupture; Tremor Burst; critical hit",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "winter_s_grasp",
    "name": "Winter's Grasp",
    "school": "Glacial",
    "items": [
      "Weapon",
      "Accessory"
    ],
    "lore": "The runes do not bind flesh. They slow the decision that precedes escape.",
    "tiers": {
      "I": "Cold Pursuit — After striking a faster target, once per Turn, apply 1 Bind for its next Turn.",
      "II": "Fettered Prey — Against a target already affected by Bind, weapon-linked hits inflict 2 Chill; once per Turn.",
      "III": "Closing Frost — Once per Encounter, when a Bound and Chilled target loses a Clash against you, it must make a normal resistance Save or gain 1 Restrained for one Turn."
    },
    "limits": "Restrained cannot persist beyond one Turn from this item; no repeated saves on a single Clash, and no bonus to Clash Power is granted.",
    "statuses": "Bind; Chill; Restrained; resistance Save",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "black_ice",
    "name": "Black Ice",
    "school": "Glacial",
    "items": [
      "Accessory"
    ],
    "lore": "Each step leaves a shadow of ice a heartbeat behind the foot that made it.",
    "tiers": {
      "I": "Slipstream — After a successful Evade, gain 1 Haste for your next Turn; once per Turn.",
      "II": "Ice Trail — When you Evade an enemy suffering Chill, add 2 Chill Count to that enemy.",
      "III": "Last Step — Once per Encounter, when an attack would cause you to cross a Stagger Threshold, you may consume your Haste to reduce that attack's Stagger damage contribution by up to 6; HP damage is unchanged."
    },
    "limits": "Does not prevent the HP loss or negate other stagger sources. The Stagger timing hook needs explicit implementation and review.",
    "statuses": "Evade; Chill; Haste; Stagger Threshold",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "stormwake",
    "name": "Stormwake",
    "school": "Tempest",
    "items": [
      "Weapon"
    ],
    "lore": "The weapon calls lightning only when the wielder dares to finish the exchange.",
    "tiers": {
      "I": "Static Scar — Once per Turn, the first weapon-linked hit on a target inflicts 2 Shock Count.",
      "II": "Arc Step — If the target converts Shock into Paralysis at Turn Start, gain one Charge (max 1) on this weapon for the next Turn.",
      "III": "Thunder's Due — Once per Encounter, spend that Charge after a weapon-linked hit to chain 2 Shock Count to one other visible, valid enemy."
    },
    "limits": "Shock and Paralysis retain canonical conversion. No automatic target selection outside valid range; charges expire after one Turn.",
    "statuses": "Shock; Paralysis conversion; single-use charge",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "thundercall",
    "name": "Thundercall",
    "school": "Tempest",
    "items": [
      "Weapon"
    ],
    "lore": "The hammer announces its arrival long after the blow, when every bone remembers the thunder.",
    "tiers": {
      "I": "First Peal — A weapon-linked hit against a target with at least 3 Shock Count inflicts 1 Paralysis; once per Turn.",
      "II": "Rolling Thunder — After winning a Clash against a Shocked target, shift 1 Shock Count from it to a second valid enemy, if any.",
      "III": "Thunderhead — Once per Encounter, when a target's Shock converts to Paralysis, the next hit from this weapon against that target inflicts Tremor 2 Potency / 1 Count."
    },
    "limits": "Does not bypass existing Paralysis caps; transferred Shock is removed from the first target and cannot cascade.",
    "statuses": "Shock; Paralysis; Tremor; Clash Win",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "stormcage",
    "name": "Stormcage",
    "school": "Tempest",
    "items": [
      "Shield"
    ],
    "lore": "Copper veins across the shield pulse whenever an enemy mistakes its silence for safety.",
    "tiers": {
      "I": "Conductive Guard — Once per Turn, after a Guard reduces direct damage, inflict 1 Shock Count on the attacker.",
      "II": "Cage Circuit — If the attacker already has Shock, add 2 more Shock Count and mark it Conductive until Turn End.",
      "III": "Judgment Coil — Once per Encounter, when a Conductive attacker triggers its canonical Shock-to-Paralysis conversion, grant the bearer a temporary Shield of 8."
    },
    "limits": "Conductive is a mark, not an unrestricted new status. Reflections cannot loop; Shield value does not scale with party size.",
    "statuses": "Guard; Shock; Paralysis; Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "static_veil",
    "name": "Static Veil",
    "school": "Tempest",
    "items": [
      "Armor",
      "Accessory"
    ],
    "lore": "The air catches against the armor, holding every missed strike like a debt unpaid.",
    "tiers": {
      "I": "Residual Current — Once per Turn, after an enemy misses you, apply 2 Shock to that enemy.",
      "II": "Insulated Thread — If that enemy already has Shock, gain 1 Protection until Turn End after the miss.",
      "III": "Grounding Burst — Once per Encounter, when an attacker with 6 or more Shock hits you, consume 3 Shock Count from it to grant you a Shield of 10."
    },
    "limits": "No effect on ranged or environmental damage without a valid attacker; the Shield does not cancel the hit that triggered it.",
    "statuses": "Shock; Protection; Shield; damage taken",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "galeheart",
    "name": "Galeheart",
    "school": "Tempest",
    "items": [
      "Accessory"
    ],
    "lore": "A trapped storm beats against the wearer's pulse whenever the battlefield changes direction.",
    "tiers": {
      "I": "Tailwind — Once per Turn on successful Evade, gain 1 Haste for the next Turn.",
      "II": "Slip of Fate — If you begin a Turn with Haste from this enchant, the first enemy who misses you suffers 1 Bind for the next Turn.",
      "III": "Eye of the Storm — Once per Encounter, after two enemies miss you in the same Turn, grant one ally 1 Haste on its next Turn."
    },
    "limits": "Haste is never permanent and cannot grant extra Action Slots; requires two distinct enemy attacks for Rank III.",
    "statuses": "Haste; Bind; Evade; ally targeting",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "skybreaker",
    "name": "Skybreaker",
    "school": "Tempest",
    "items": [
      "Weapon"
    ],
    "lore": "The spear never chases the sky. It waits for the sky to fall onto its point.",
    "tiers": {
      "I": "Thunderpoint — Weapon-linked hits against targets bearing a Shield inflict 2 Shock Count.",
      "II": "Crack the Canopy — Once per Turn after hitting a Shielded target, the next weapon-linked hit against the same target deals up to 5 additional damage to its Shield only.",
      "III": "Fallen Star — Once per Encounter, breaking a target's Shield with this weapon triggers Tremor Burst if that target already has Tremor."
    },
    "limits": "Does not increase damage against HP, does not create Tremor, and the Shield-specific effect cannot overflow into HP.",
    "statuses": "Shock; Shields; Tremor Burst; shield-break event",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "bloodthorn",
    "name": "Bloodthorn",
    "school": "Sanguine",
    "items": [
      "Weapon"
    ],
    "lore": "Its crimson barbs bloom only where a living heartbeat answers the thrust.",
    "tiers": {
      "I": "Thorned Cut — Once per Turn, the first Critical Hit with this weapon inflicts Bleed 2 Potency / 2 Count.",
      "II": "Open Vein — Your next weapon-linked hit against that same Bleeding target increases its Bleed Potency by 2, once per Turn.",
      "III": "Red Bloom — Once per Encounter, on a weapon-linked Critical Hit against a target with at least 5 Bleed Potency, convert 2 of its Bleed Count into 2 Rupture Potency / 2 Count."
    },
    "limits": "Consumes, not copies, the original Bleed Count. No triggers from Bleed self-damage and no guaranteed Critical Hits.",
    "statuses": "Bleed; Poise/Critical; Rupture",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "crimson_oath",
    "name": "Crimson Oath",
    "school": "Sanguine",
    "items": [
      "Weapon"
    ],
    "lore": "Each vow carved into the blade is paid for twice: once in blood, once in what remains.",
    "tiers": {
      "I": "Blood Price — At Turn Start, you may spend 3 HP to mark the weapon Sated until Turn End. The next weapon-linked hit inflicts Bleed 2 Potency / 2 Count.",
      "II": "Pact of Thorns — If the wielder was below 50% HP when paying, that hit also inflicts 1 Rupture Potency / 1 Count.",
      "III": "Last Oath — Once per Encounter, when the wielder pays the Blood Price below 25% HP, the next linked hit transfers half its inflicted Bleed Potency (cap 3) to a second valid foe."
    },
    "limits": "Cannot pay if the HP cost would reduce the wielder to 0 or below. Paid HP is real and not refunded if the attack misses.",
    "statuses": "Bleed; Rupture; resource expenditure; target sharing",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "hollow_fang",
    "name": "Hollow Fang",
    "school": "Sanguine",
    "items": [
      "Weapon"
    ],
    "lore": "The fang drinks only what its prey can still afford to lose.",
    "tiers": {
      "I": "Feast — Once per Turn, when the weapon hits a Bleeding enemy, recover 2 HP after damage.",
      "II": "Deep Hunger — If the hit consumed Bleed Count from the target, recover 2 additional HP, capped at 4 total per Turn.",
      "III": "Starving King — Once per Encounter, a Critical Hit against a Bleeding target gives the wielder a temporary Shield equal to the HP actually recovered this Turn, capped at 8."
    },
    "limits": "Healing never exceeds missing HP; damage-over-time does not trigger Feast. Cannot lifesteal from invalid or immune targets.",
    "statuses": "Bleed; healing; Shield; Critical",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "ruptureloom",
    "name": "Ruptureloom",
    "school": "Sanguine",
    "items": [
      "Weapon"
    ],
    "lore": "Fine cracks in the spearhead widen only when the target attempts to continue fighting.",
    "tiers": {
      "I": "Seam — The first weapon-linked hit each Turn inflicts Rupture 2 Potency / 2 Count.",
      "II": "Unravel — If the target already had Rupture, the next weapon-linked hit in the same Turn extends Rupture Count by 1, once per Turn.",
      "III": "Threadbreaker — Once per Encounter, after three weapon-linked hits on one target, trigger that target's existing Rupture once without removing its full stack, then clear the hit counter."
    },
    "limits": "The extra Rupture trigger consumes its normal Count; cannot trigger from any Rupture damage tick. Three hits must be from this equipped Instance.",
    "statuses": "Rupture; multiple-hit tracking; On Hit",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "butcher_s_hymn",
    "name": "Butcher's Hymn",
    "school": "Sanguine",
    "items": [
      "Armor"
    ],
    "lore": "The plates hum louder with every wound their owner survives, refusing the comfort of silence.",
    "tiers": {
      "I": "Grim Rhythm — Once per Turn, after losing HP to a direct attack, gain Poise 2 Potency / 2 Count.",
      "II": "Bloody Cadence — On your next Critical Hit, inflict Bleed 2 Potency / 1 Count on that hit's target.",
      "III": "Final Chorus — Once per Encounter, when reduced below 30% HP by direct enemy damage, gain 1 Protection until the next Turn End and refresh no Poise already lost."
    },
    "limits": "Critical must come from a normal attack resolution. No Poise from self-damage, poison, Burn, or status ticks.",
    "statuses": "Poise; Bleed; Protection; damage taken",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "heartseeker",
    "name": "Heartseeker",
    "school": "Sanguine",
    "items": [
      "Weapon"
    ],
    "lore": "The bowstring tightens around the sound of a failing pulse, not the shape of a target.",
    "tiers": {
      "I": "Pulse Mark — First weapon-linked hit per Turn marks one target until the next Turn End.",
      "II": "Follow the Beat — A second hit against that same marked enemy inflicts Bleed 2 Potency / 2 Count and clears the mark.",
      "III": "Final Pulse — Once per Encounter, when a marked enemy falls below 25% HP due to this weapon, inflict Rupture 3 Potency / 2 Count and clear the mark."
    },
    "limits": "No execute, instant kill, or bypass of damage mitigation. The threshold must be crossed by a legitimate hit from this weapon.",
    "statuses": "Bleed; Rupture; HP threshold; marked target",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "gravewhisper",
    "name": "Gravewhisper",
    "school": "Umbral",
    "items": [
      "Weapon"
    ],
    "lore": "Its edge carries the last thought of those who never found the strength to scream.",
    "tiers": {
      "I": "Quiet Cut — First weapon-linked hit each Turn inflicts Sinking 2 Potency / 2 Count.",
      "II": "Afterthought — Hitting a target that already had Sinking this Turn extends its Sinking Count by 1, once per Turn.",
      "III": "Last Word — Once per Encounter, after a hit drains the final positive SP from a target via Sinking, gain 1 Poise Potency / 2 Count and mark that target for one Turn."
    },
    "limits": "Does not reduce SP past engine bounds; a target with no valid SP cannot award the Last Word bonus repeatedly.",
    "statuses": "Sinking; SP; Poise; per-target mark",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "drownsong",
    "name": "Drownsong",
    "school": "Umbral",
    "items": [
      "Accessory",
      "Valuable"
    ],
    "lore": "The ring sings beneath running water, but only the wearer hears the drowned choir.",
    "tiers": {
      "I": "Undertow — After an enemy damages your SP directly, once per Turn, apply Sinking 2 Potency / 1 Count to that attacker.",
      "II": "Low Tide — If that attacker was already Sinking, recover 2 SP after the attack resolves.",
      "III": "Abyssal Chorus — Once per Encounter, when two different enemies damage your SP in one Turn, inflict Sinking 2 Potency / 2 Count on one valid attacker of your choice."
    },
    "limits": "Requires actual SP loss, not blocked or absorbed SP damage; never triggers from the wearer's own Sinking.",
    "statuses": "Sinking; SP healing; damage taken; chosen target",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "nightfall",
    "name": "Nightfall",
    "school": "Umbral",
    "items": [
      "Armor",
      "Accessory"
    ],
    "lore": "No torch can settle on its silhouette; every witness remembers a different outline.",
    "tiers": {
      "I": "Second Shadow — On a successful Evade, mark yourself Veiled until Turn End; once per Turn.",
      "II": "Vanishing Point — If you evade two attacks in one Turn, gain Invisible until the next Turn Start, provided its canonical detection rules are met.",
      "III": "Starless Return — Once per Encounter, after Invisible ends, your next hit on an already Sinking target inflicts 2 additional Sinking Count."
    },
    "limits": "Invisible is detection-dependent, never guaranteed untargetability. The item grants no free attacks and cannot trigger from an invalid Evade.",
    "statuses": "Evade; Invisible; Sinking; detection",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "void_anchor",
    "name": "Void Anchor",
    "school": "Umbral",
    "items": [
      "Shield"
    ],
    "lore": "The sigil weighs nothing until the moment something tries to escape its reach.",
    "tiers": {
      "I": "Grasp — Once per Turn, after a successful Guard against a melee attacker, inflict 1 Bind for its next Turn.",
      "II": "Held Horizon — When a Bound enemy hits you, once per Turn, gain a temporary Shield of 5 after the damage resolves.",
      "III": "Black Gravity — Once per Encounter, when the Bound enemy loses a Clash against you, it must Save or suffer 1 Restrained for one Turn."
    },
    "limits": "Does not move enemies or erase Action Slots; Restrained can be resisted and expires after one Turn.",
    "statuses": "Bind; Restrained; Guard; Shield; Save",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "eclipsed_crown",
    "name": "Eclipsed Crown",
    "school": "Umbral",
    "items": [
      "Accessory",
      "Valuable"
    ],
    "lore": "The crown turns whispers into debts, and demands a memory every time it answers.",
    "tiers": {
      "I": "Borrowed Thought — At Turn Start, optionally spend 4 SP to mark one visible enemy for one Turn.",
      "II": "Mental Debt — Your next successful hit against the marked enemy inflicts Sinking 3 Potency / 2 Count, then clears the mark.",
      "III": "Eclipse — Once per Encounter, when a marked enemy reaches 0 SP due to your attack, recover up to 4 SP and inflict 1 Bind on that enemy for its next Turn."
    },
    "limits": "SP must be available to pay; marks expire without refund and cannot be placed on non-targetable enemies.",
    "statuses": "Sinking; SP resource; Bind; HP/SP gate",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "spectral_covenant",
    "name": "Spectral Covenant",
    "school": "Umbral",
    "items": [
      "Weapon"
    ],
    "lore": "A half-forgotten oath follows the weapon from the sheath, waiting for an ally's last stand.",
    "tiers": {
      "I": "Witness — Once per Turn when an ally crosses a Stagger Threshold, gain one Vow charge (max 2).",
      "II": "Answer — After your next weapon-linked hit, consume 1 Vow to inflict Sinking 2 Potency / 2 Count.",
      "III": "Unbroken Circle — Once per Encounter, spend 2 Vow after a weapon-linked hit to grant that Staggered ally a temporary Shield of 8 if it remains targetable."
    },
    "limits": "Only ally Stagger events award Vow, not self-triggered manipulation. Vows expire at Encounter End.",
    "statuses": "Stagger; Sinking; Shield; charges",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "dawnbound",
    "name": "Dawnbound",
    "school": "Sanctified",
    "items": [
      "Weapon"
    ],
    "lore": "Light gathers along the blade only where its bearer refuses to strike an already beaten foe.",
    "tiers": {
      "I": "First Light — Once per Turn, after a weapon-linked hit against a Shielded enemy, inflict 2 Radiance Count.",
      "II": "Unmask — After breaking a Shield with this weapon, transfer 1 Radiance Count to its owner if it has none.",
      "III": "Daybreak — Once per Encounter, when a Radiant target damages an ally, gain 1 Protection until your next Turn End and mark the attacker for your next hit."
    },
    "limits": "No doubling of raw damage; Radiance follows its canonical interaction with Shields and cannot overflow HP on its own.",
    "statuses": "Radiance; Shields; Protection; marked attacker",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "halo_of_ash",
    "name": "Halo of Ash",
    "school": "Sanctified",
    "items": [
      "Armor"
    ],
    "lore": "Its halo shines only after the armor has failed to keep another from pain.",
    "tiers": {
      "I": "Guardian Ember — Once per Turn, after taking damage while shielding an ally, gain 1 Protection for the next Turn.",
      "II": "Sootbound Mercy — If that ally is below half HP, give the ally a temporary Shield of 5 after the intercepted hit.",
      "III": "Witness of Dawn — Once per Encounter, after saving an ally from crossing a Stagger Threshold through interception, clear 1 nonpermanent negative Status Count from that ally."
    },
    "limits": "Ally interception must be a supported action and actually prevent damage. Does not resurrect or erase persistent curses.",
    "statuses": "Protection; Shield; Status cleansing; interception",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "mercy_s_last_light",
    "name": "Mercy's Last Light",
    "school": "Sanctified",
    "items": [
      "Accessory"
    ],
    "lore": "The glass lantern brightens in proportion to how much its owner cannot bear to lose.",
    "tiers": {
      "I": "Keep the Flame — Once per Turn, when an ally falls below 30% HP due to direct damage, you may spend 4 SP to give that ally a Shield of 6.",
      "II": "Shared Light — If that Shield survives until the ally's next Turn Start, restore 3 HP to the ally and remove the Shield.",
      "III": "Beacon — Once per Encounter, if the guarded ally survives a hit that would otherwise bring it to 0 HP, the lantern may reduce that hit's damage by up to 5 instead of creating the Shield."
    },
    "limits": "Damage reduction is capped, not invulnerability. Does not intercept instant narrative death or revive characters already at 0 HP.",
    "statuses": "SP cost; Shield; HP healing; lethal-hit window",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "oathkeeper",
    "name": "Oathkeeper",
    "school": "Sanctified",
    "items": [
      "Shield"
    ],
    "lore": "Every name carved into the shield is an oath that outlived its author.",
    "tiers": {
      "I": "Sworn Ward — At Encounter Start choose one ally; once per Turn, while guarding, you may intercept one incoming Attack Skill aimed at that ally.",
      "II": "Steadfast — After successfully intercepting, gain 1 Protection for the rest of the Turn.",
      "III": "Endless Watch — Once per Encounter, if the intercepted hit would cross that ally's Stagger Threshold, the bearer gains a temporary Shield of 10 before taking the intercepted damage."
    },
    "limits": "Needs an explicit legal reaction/Guard action and valid range. One protected ally at a time; no unlimited reactive blocks.",
    "statuses": "interception; Guard; Protection; Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "sunpiercer",
    "name": "Sunpiercer",
    "school": "Sanctified",
    "items": [
      "Weapon"
    ],
    "lore": "Its point does not chase shadows; it makes them confess their shape.",
    "tiers": {
      "I": "Reveal — On a weapon-linked hit against an enemy with Invisible, cancel one temporary concealment from that source, once per Turn.",
      "II": "Scorch the Veil — On the first hit each Turn against a target with a Shield, inflict 2 Radiance Count.",
      "III": "Open Sky — Once per Encounter, breaking a Shield from this weapon clears one temporary Invisible effect from that target and adds 2 Radiance Count."
    },
    "limits": "Invisible remains subject to canonical detection; cannot bypass legal targeting to hit an unseen foe without a successful detection.",
    "statuses": "Invisible; Radiance; Shield break; target detection",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "radiant_bastion",
    "name": "Radiant Bastion",
    "school": "Sanctified",
    "items": [
      "Armor",
      "Shield"
    ],
    "lore": "The fortress engraved inside the metal is not a place. It is a promise the bearer must keep.",
    "tiers": {
      "I": "Shelter — After successfully guarding a direct attack, once per Turn, grant the lowest-HP nearby ally a temporary Shield of 4.",
      "II": "Consecration — If the ally's Shield persists to Turn Start, grant that ally 1 Protection until Turn End.",
      "III": "Citadel — Once per Encounter, after three successful Guards in the same Encounter, distribute a total Shield value of 12 among up to three allies."
    },
    "limits": "Guard count resets at Encounter End; no aura without successful Guards, and granted Shields never stack beyond per-target limits.",
    "statuses": "Guard; Shield; Protection; ally selection",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "gravemark",
    "name": "Gravemark",
    "school": "Anomalous",
    "items": [
      "Weapon"
    ],
    "lore": "Each blow leaves the memory of a second impact that has not happened yet.",
    "tiers": {
      "I": "Pressure Fracture — Once per Turn, a weapon-linked hit inflicts Tremor 3 Potency / 2 Count.",
      "II": "Compression — When a target with Tremor loses a Clash against this weapon, extend Tremor Count by 1, once per Turn.",
      "III": "Collapse — Once per Encounter, after three successful hits on one target, trigger Tremor Burst if Tremor is present, then clear the counter."
    },
    "limits": "Tremor Burst modifies Stagger Thresholds; it is not direct HP damage. No burst without existing Tremor.",
    "statuses": "Tremor; Tremor Burst; multiple hits",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "mirrorheart",
    "name": "Mirrorheart",
    "school": "Anomalous",
    "items": [
      "Accessory",
      "Valuable"
    ],
    "lore": "The surface reflects the wounds it sees rather than the face that wears it.",
    "tiers": {
      "I": "Witness — Once per Turn after a direct hit, record one qualifying negative Status from the hit (Burn, Bleed, or Sinking) at up to 2 Potency / 1 Count.",
      "II": "Reflection — Your next successful Attack Skill inflicts the stored Status on its target, then empties the mirror.",
      "III": "Shattered Truth — Once per Encounter, after reflection, remove 1 Count of that same Status from yourself."
    },
    "limits": "Only listed statuses can be copied; no copying Frozen, Paralysis, curses, or permanent conditions. Reflection does not trigger itself.",
    "statuses": "Burn/Bleed/Sinking; status copy whitelist; remove Status Count",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "chains_of_ruin",
    "name": "Chains of Ruin",
    "school": "Anomalous",
    "items": [
      "Weapon"
    ],
    "lore": "The links have no length until their victim tries to move away.",
    "tiers": {
      "I": "Hook — First weapon-linked hit each Turn inflicts 1 Bind for the next Turn.",
      "II": "Holdfast — When a target with Bind attacks someone other than the wielder, inflict 2 Rupture Potency / 1 Count on that target, once per Turn.",
      "III": "Unbroken Chain — Once per Encounter, after winning a Clash against a Bound target, you may apply 1 Restrained for one Turn if the target fails a Save."
    },
    "limits": "No forced movement or aggro override. A target can Save against Restrained; no chain activation from self-damage.",
    "statuses": "Bind; Rupture; Restrained; Save",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "chronolock",
    "name": "Chronolock",
    "school": "Anomalous",
    "items": [
      "Accessory"
    ],
    "lore": "The watch has thirteen hands. The thirteenth moves only when the wearer has made a choice it cannot undo.",
    "tiers": {
      "I": "Borrowed Second — Once per Encounter, before your Turn's actions resolve, borrow one Quick Action if the action economy permits it.",
      "II": "Temporal Debt — At the beginning of your next Turn, lose one Quick Action; the debt applies even if the borrowed action was unused.",
      "III": "Broken Hour — Rank III lets you instead lend that borrowed Quick Action to a willing ally, who incurs the same debt next Turn."
    },
    "limits": "Cannot generate Action Slots, Skill Coins, or extra full Actions. Cannot borrow while in Action debt; must be implemented through action-economy authority.",
    "statuses": "Quick Action; debt; action economy",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "requiem_coil",
    "name": "Requiem Coil",
    "school": "Anomalous",
    "items": [
      "Armor"
    ],
    "lore": "The coil listens to blows. When it speaks, it repeats only what the bearer survived.",
    "tiers": {
      "I": "Absorb — Once per Turn, store up to 4 damage actually prevented by a Guard (Memory, maximum 8).",
      "II": "Retort — The next weapon-linked hit consumes Memory to deal Fixed Damage equal to the consumed amount, capped at 8.",
      "III": "Echo Chamber — Once per Encounter, after Retort, gain a temporary Shield equal to half the consumed Memory, rounded down."
    },
    "limits": "Only prevented damage counts, not HP lost. Does not reflect status ticks, bypass resistance, or chain from Retort damage.",
    "statuses": "Guard; stored prevention; Fixed Damage; Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "nullwake",
    "name": "Nullwake",
    "school": "Anomalous",
    "items": [
      "Weapon",
      "Accessory"
    ],
    "lore": "Everything near the relic becomes momentarily uncertain of the rules that hold it together.",
    "tiers": {
      "I": "Interruption — Once per Turn, after hitting a target with a removable positive Status, mark that Status for disruption.",
      "II": "Unweaving — On the next weapon-linked hit against that target, remove 1 Count of the marked positive Status and clear the mark.",
      "III": "Stillness — Once per Encounter, if the removed Status was Protection or Haste, prevent that same source from reapplying it until the next Turn Start."
    },
    "limits": "Whitelist removable temporary statuses only; no stripping class Traits, permanent effects, attunement, or equipment. No global magic suppression.",
    "statuses": "temporary beneficial statuses; dispel whitelist; source tracking",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  }
];
const SCHOOLS=["Infernal","Glacial","Tempest","Sanguine","Umbral","Sanctified","Anomalous"];
const API=Object.freeze({version:"review-v2",approved:false,gameplayEnabled:false,ENCHANTMENTS:Object.freeze(ENCHANTMENTS),SCHOOLS:Object.freeze(SCHOOLS)});
global.LuminousEnchantmentDesignReview=API;
if(typeof module!=="undefined"&&module.exports) module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
