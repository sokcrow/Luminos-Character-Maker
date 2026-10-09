(function(global){
"use strict";
// Volume IV: damage specialization and turn event triggers; review only, never registered in gameplay.
const BASE=global.LuminousEnchantmentDesignReview;
if(!BASE||BASE.gameplayEnabled!==false||BASE.ENCHANTMENTS.length!==104)throw new Error("Review Volume III must load before Volume IV");
const ADDITIONS=[
  {
    "id": "sundering_script",
    "name": "Sundering Script",
    "school": "Martial",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "greatsword",
      "scimitar",
      "battleaxe",
      "greataxe",
      "halberd"
    ],
    "exampleItem": "Sundering Script Longsword",
    "lore": "The edge is engraved with every fault its maker ever found in steel.",
    "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon deals Slash damage, increase that Slash damage by {percent}%.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "Damage",
      "Slash",
      "On Hit"
    ],
    "limits": "Only Slash damage; no bonus for Pierce, Blunt or unrelated Skills. Charge one Magic Durability point per qualifying property use; multi-Coin accounting awaits engine review.",
    "damageBonus": {
      "scope": "physical",
      "type": "slash",
      "priority": "specialized"
    },
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "percent": 5
      },
      "II": {
        "percent": 8
      },
      "III": {
        "percent": 13
      }
    },
    "tiers": {
      "I": "When a damaging Attack Skill sourced from this equipped weapon deals Slash damage, increase that Slash damage by 5%.",
      "II": "When a damaging Attack Skill sourced from this equipped weapon deals Slash damage, increase that Slash damage by 8%.",
      "III": "When a damaging Attack Skill sourced from this equipped weapon deals Slash damage, increase that Slash damage by 13%."
    },
    "statuses": "Damage; Slash; On Hit",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "needlefall",
    "name": "Needlefall",
    "school": "Martial",
    "kind": "weapon",
    "allowedChassisIds": [
      "dagger",
      "rapier",
      "shortsword",
      "spear",
      "pike",
      "lance",
      "longbow",
      "shortbow",
      "heavy_crossbow",
      "hand_crossbow",
      "light_crossbow",
      "war_pick"
    ],
    "exampleItem": "Needlefall Rapier",
    "lore": "Each etched needle in the fuller seeks a weakness too narrow to be seen.",
    "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon deals Pierce damage, increase that Pierce damage by {percent}%.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "Damage",
      "Pierce",
      "On Hit"
    ],
    "limits": "Only Pierce damage; actual resolved physical type must match. A single damage type does not imply a matching SIN bonus.",
    "damageBonus": {
      "scope": "physical",
      "type": "pierce",
      "priority": "specialized"
    },
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "percent": 5
      },
      "II": {
        "percent": 8
      },
      "III": {
        "percent": 13
      }
    },
    "tiers": {
      "I": "When a damaging Attack Skill sourced from this equipped weapon deals Pierce damage, increase that Pierce damage by 5%.",
      "II": "When a damaging Attack Skill sourced from this equipped weapon deals Pierce damage, increase that Pierce damage by 8%.",
      "III": "When a damaging Attack Skill sourced from this equipped weapon deals Pierce damage, increase that Pierce damage by 13%."
    },
    "statuses": "Damage; Pierce; On Hit",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "colossus_echo",
    "name": "Colossus Echo",
    "school": "Martial",
    "kind": "weapon",
    "allowedChassisIds": [
      "warhammer",
      "maul",
      "mace",
      "greatclub",
      "club",
      "flail",
      "morningstar",
      "light_hammer",
      "quarterstaff"
    ],
    "exampleItem": "Colossus Echo Warhammer",
    "lore": "When it strikes, the weapon repeats the weight of mountains forgotten by the gods.",
    "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon deals Blunt damage, increase that Blunt damage by {percent}%.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "Damage",
      "Blunt",
      "On Hit"
    ],
    "limits": "Only Blunt damage. Fixed damage, Rupture and other unrelated damage do not gain extra amplification.",
    "damageBonus": {
      "scope": "physical",
      "type": "blunt",
      "priority": "specialized"
    },
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "percent": 5
      },
      "II": {
        "percent": 8
      },
      "III": {
        "percent": 13
      }
    },
    "tiers": {
      "I": "When a damaging Attack Skill sourced from this equipped weapon deals Blunt damage, increase that Blunt damage by 5%.",
      "II": "When a damaging Attack Skill sourced from this equipped weapon deals Blunt damage, increase that Blunt damage by 8%.",
      "III": "When a damaging Attack Skill sourced from this equipped weapon deals Blunt damage, increase that Blunt damage by 13%."
    },
    "statuses": "Damage; Blunt; On Hit",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "wrathflare",
    "name": "Wrathflare",
    "school": "Resonant",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "greatsword",
      "greataxe",
      "scimitar",
      "warhammer"
    ],
    "exampleItem": "Wrathflare Longsword",
    "lore": "A scarlet seal ignites when anger finds a name worth striking.",
    "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon has Wrath SIN affinity, increase that Skill's eligible direct damage by {percent}%.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "Damage",
      "Wrath",
      "SIN"
    ],
    "limits": "Only Wrath-affinity Skills linked to the equipped Item Instance qualify; does not boost all Fire by default.",
    "damageBonus": {
      "scope": "sin",
      "type": "wrath",
      "priority": "specialized"
    },
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "percent": 5
      },
      "II": {
        "percent": 8
      },
      "III": {
        "percent": 13
      }
    },
    "tiers": {
      "I": "When a damaging Attack Skill sourced from this equipped weapon has Wrath SIN affinity, increase that Skill's eligible direct damage by 5%.",
      "II": "When a damaging Attack Skill sourced from this equipped weapon has Wrath SIN affinity, increase that Skill's eligible direct damage by 8%.",
      "III": "When a damaging Attack Skill sourced from this equipped weapon has Wrath SIN affinity, increase that Skill's eligible direct damage by 13%."
    },
    "statuses": "Damage; Wrath; SIN",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "velvet_vice",
    "name": "Velvet Vice",
    "school": "Resonant",
    "kind": "weapon",
    "allowedChassisIds": [
      "rapier",
      "dagger",
      "shortsword",
      "scimitar"
    ],
    "exampleItem": "Velvet Vice Rapier",
    "lore": "The inscription sings of wants so sweet that an enemy mistakes pain for consent.",
    "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon has Lust SIN affinity, increase that Skill's eligible direct damage by {percent}%.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "Damage",
      "Lust",
      "SIN"
    ],
    "limits": "Only Lust-affinity Skills from this weapon. Does not grant Charmed, seduction or universal psychic damage.",
    "damageBonus": {
      "scope": "sin",
      "type": "lust",
      "priority": "specialized"
    },
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "percent": 5
      },
      "II": {
        "percent": 8
      },
      "III": {
        "percent": 13
      }
    },
    "tiers": {
      "I": "When a damaging Attack Skill sourced from this equipped weapon has Lust SIN affinity, increase that Skill's eligible direct damage by 5%.",
      "II": "When a damaging Attack Skill sourced from this equipped weapon has Lust SIN affinity, increase that Skill's eligible direct damage by 8%.",
      "III": "When a damaging Attack Skill sourced from this equipped weapon has Lust SIN affinity, increase that Skill's eligible direct damage by 13%."
    },
    "statuses": "Damage; Lust; SIN",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "stillhour_edge",
    "name": "Stillhour Edge",
    "school": "Resonant",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "warhammer",
      "maul",
      "spear"
    ],
    "exampleItem": "Stillhour Edge Longsword",
    "lore": "Time thickens around the blade as the weight of a forgotten hour returns.",
    "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon has Sloth SIN affinity, increase that Skill's eligible direct damage by {percent}%.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "Damage",
      "Sloth",
      "SIN"
    ],
    "limits": "Only Sloth-affinity attack damage; does not multiply Slow/Bind or remove enemy Actions.",
    "damageBonus": {
      "scope": "sin",
      "type": "sloth",
      "priority": "specialized"
    },
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "percent": 5
      },
      "II": {
        "percent": 8
      },
      "III": {
        "percent": 13
      }
    },
    "tiers": {
      "I": "When a damaging Attack Skill sourced from this equipped weapon has Sloth SIN affinity, increase that Skill's eligible direct damage by 5%.",
      "II": "When a damaging Attack Skill sourced from this equipped weapon has Sloth SIN affinity, increase that Skill's eligible direct damage by 8%.",
      "III": "When a damaging Attack Skill sourced from this equipped weapon has Sloth SIN affinity, increase that Skill's eligible direct damage by 13%."
    },
    "statuses": "Damage; Sloth; SIN",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "devourer_s_sigil",
    "name": "Devourer's Sigil",
    "school": "Resonant",
    "kind": "weapon",
    "allowedChassisIds": [
      "spear",
      "pike",
      "trident",
      "dagger",
      "rapier"
    ],
    "exampleItem": "Devourer's Sigil Spear",
    "lore": "The glyph is an open mouth carved into the tip, always hungry but never sated.",
    "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon has Gluttony SIN affinity, increase that Skill's eligible direct damage by {percent}%.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "Damage",
      "Gluttony",
      "SIN"
    ],
    "limits": "Only Gluttony-affinity direct damage; does not automatically multiply Poison or Corrosion damage-over-time.",
    "damageBonus": {
      "scope": "sin",
      "type": "gluttony",
      "priority": "specialized"
    },
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "percent": 5
      },
      "II": {
        "percent": 8
      },
      "III": {
        "percent": 13
      }
    },
    "tiers": {
      "I": "When a damaging Attack Skill sourced from this equipped weapon has Gluttony SIN affinity, increase that Skill's eligible direct damage by 5%.",
      "II": "When a damaging Attack Skill sourced from this equipped weapon has Gluttony SIN affinity, increase that Skill's eligible direct damage by 8%.",
      "III": "When a damaging Attack Skill sourced from this equipped weapon has Gluttony SIN affinity, increase that Skill's eligible direct damage by 13%."
    },
    "statuses": "Damage; Gluttony; SIN",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "duskshard",
    "name": "Duskshard",
    "school": "Resonant",
    "kind": "weapon",
    "allowedChassisIds": [
      "dagger",
      "scimitar",
      "sickle",
      "glaive"
    ],
    "exampleItem": "Duskshard Dagger",
    "lore": "Night settles in each cut as if the wound itself had forgotten where the sun went.",
    "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon has Gloom SIN affinity, increase that Skill's eligible direct damage by {percent}%.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "Damage",
      "Gloom",
      "SIN"
    ],
    "limits": "Only Gloom-affinity direct damage; no separate bonus to Sinking SP damage from Status resolution.",
    "damageBonus": {
      "scope": "sin",
      "type": "gloom",
      "priority": "specialized"
    },
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "percent": 5
      },
      "II": {
        "percent": 8
      },
      "III": {
        "percent": 13
      }
    },
    "tiers": {
      "I": "When a damaging Attack Skill sourced from this equipped weapon has Gloom SIN affinity, increase that Skill's eligible direct damage by 5%.",
      "II": "When a damaging Attack Skill sourced from this equipped weapon has Gloom SIN affinity, increase that Skill's eligible direct damage by 8%.",
      "III": "When a damaging Attack Skill sourced from this equipped weapon has Gloom SIN affinity, increase that Skill's eligible direct damage by 13%."
    },
    "statuses": "Damage; Gloom; SIN",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "crownbreaker",
    "name": "Crownbreaker",
    "school": "Resonant",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "greatsword",
      "rapier",
      "halberd"
    ],
    "exampleItem": "Crownbreaker Greatsword",
    "lore": "The gold runes cut through boasts before they ever reach the enemy.",
    "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon has Pride SIN affinity, increase that Skill's eligible direct damage by {percent}%.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "Damage",
      "Pride",
      "SIN"
    ],
    "limits": "Only Pride-affinity Skills. Cannot boost all Radiance or overwrite the attack's SIN type.",
    "damageBonus": {
      "scope": "sin",
      "type": "pride",
      "priority": "specialized"
    },
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "percent": 5
      },
      "II": {
        "percent": 8
      },
      "III": {
        "percent": 13
      }
    },
    "tiers": {
      "I": "When a damaging Attack Skill sourced from this equipped weapon has Pride SIN affinity, increase that Skill's eligible direct damage by 5%.",
      "II": "When a damaging Attack Skill sourced from this equipped weapon has Pride SIN affinity, increase that Skill's eligible direct damage by 8%.",
      "III": "When a damaging Attack Skill sourced from this equipped weapon has Pride SIN affinity, increase that Skill's eligible direct damage by 13%."
    },
    "statuses": "Damage; Pride; SIN",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "storm_of_envy",
    "name": "Storm of Envy",
    "school": "Resonant",
    "kind": "weapon",
    "allowedChassisIds": [
      "scimitar",
      "shortsword",
      "rapier",
      "warhammer"
    ],
    "exampleItem": "Storm of Envy Scimitar",
    "lore": "The veins of silver glow every time lightning answers a name other than the wielder's.",
    "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon has Envy SIN affinity, increase that Skill's eligible direct damage by {percent}%.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "Damage",
      "Envy",
      "SIN"
    ],
    "limits": "Only Envy-affinity direct attacks linked to this weapon; Shock Status ticks are not included.",
    "damageBonus": {
      "scope": "sin",
      "type": "envy",
      "priority": "specialized"
    },
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "percent": 5
      },
      "II": {
        "percent": 8
      },
      "III": {
        "percent": 13
      }
    },
    "tiers": {
      "I": "When a damaging Attack Skill sourced from this equipped weapon has Envy SIN affinity, increase that Skill's eligible direct damage by 5%.",
      "II": "When a damaging Attack Skill sourced from this equipped weapon has Envy SIN affinity, increase that Skill's eligible direct damage by 8%.",
      "III": "When a damaging Attack Skill sourced from this equipped weapon has Envy SIN affinity, increase that Skill's eligible direct damage by 13%."
    },
    "statuses": "Damage; Envy; SIN",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "first_dawn_covenant",
    "name": "First Dawn Covenant",
    "school": "Runic",
    "kind": "accessory",
    "allowedChassisIds": [
      "pendant",
      "brooch",
      "ring"
    ],
    "exampleItem": "First Dawn Covenant Pendant",
    "lore": "A dawn sealed in a gemstone breaks open the instant a new battle begins.",
    "baseEffect": "At Encounter Start, grant {shield} temporary Shield to the wearer, lasting until the end of the first Turn.",
    "baseMagnitudes": {
      "shield": 5
    },
    "axes": [
      "Encounter Start",
      "Shield",
      "Before Hit"
    ],
    "limits": "One property activation per Encounter; 1 Magic Durability is spent when the Shield is granted. Cannot stack from reconnects/repeated Encounter Start events.",
    "event": "encounter_start",
    "items": [
      "Accessory"
    ],
    "rankMagnitudes": {
      "I": {
        "shield": 5
      },
      "II": {
        "shield": 8
      },
      "III": {
        "shield": 13
      }
    },
    "tiers": {
      "I": "At Encounter Start, grant 5 temporary Shield to the wearer, lasting until the end of the first Turn.",
      "II": "At Encounter Start, grant 8 temporary Shield to the wearer, lasting until the end of the first Turn.",
      "III": "At Encounter Start, grant 13 temporary Shield to the wearer, lasting until the end of the first Turn."
    },
    "statuses": "Encounter Start; Shield; Before Hit",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "pulsekeeper",
    "name": "Pulsekeeper",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "pendant",
      "necklace"
    ],
    "exampleItem": "Pulsekeeper Ring",
    "lore": "The ring listens for the pulse the world cannot hear, and answers only when it grows faint.",
    "baseEffect": "At Turn Start, if the wearer has less than 50% of Max HP, grant {shield} temporary Shield until the next Turn Start.",
    "baseMagnitudes": {
      "shield": 4
    },
    "axes": [
      "Turn Start",
      "Shield",
      "HP"
    ],
    "limits": "The 50% threshold is fixed; each activation spends 1 Magic Durability. No bonus if the wearer is at 0 HP or cannot receive a Shield.",
    "event": "turn_start",
    "items": [
      "Accessory"
    ],
    "rankMagnitudes": {
      "I": {
        "shield": 4
      },
      "II": {
        "shield": 6
      },
      "III": {
        "shield": 10
      }
    },
    "tiers": {
      "I": "At Turn Start, if the wearer has less than 50% of Max HP, grant 4 temporary Shield until the next Turn Start.",
      "II": "At Turn Start, if the wearer has less than 50% of Max HP, grant 6 temporary Shield until the next Turn Start.",
      "III": "At Turn Start, if the wearer has less than 50% of Max HP, grant 10 temporary Shield until the next Turn Start."
    },
    "statuses": "Turn Start; Shield; HP",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "arterial_hex",
    "name": "Arterial Hex",
    "school": "Sanguine",
    "kind": "weapon",
    "allowedChassisIds": [
      "dagger",
      "rapier",
      "shortsword"
    ],
    "exampleItem": "Arterial Hex Dagger",
    "lore": "The writing along the blade tightens when the victim is more dangerous than the hand that holds it.",
    "baseEffect": "Once per Turn, when a Hit from this weapon damages an enemy whose Offensive Level exceeds the wielder's, inflict {fragile} Fragile Count on that enemy.",
    "baseMagnitudes": {
      "fragile": 1
    },
    "axes": [
      "On Hit",
      "Fragile",
      "Offensive Level"
    ],
    "limits": "Requires a real weapon-linked Hit and valid Level comparison. Each activation costs 1 Magic Durability; canonical Fragile caps apply.",
    "event": "on_hit",
    "items": [
      "Weapon"
    ],
    "rankMagnitudes": {
      "I": {
        "fragile": 1
      },
      "II": {
        "fragile": 2
      },
      "III": {
        "fragile": 3
      }
    },
    "tiers": {
      "I": "Once per Turn, when a Hit from this weapon damages an enemy whose Offensive Level exceeds the wielder's, inflict 1 Fragile Count on that enemy.",
      "II": "Once per Turn, when a Hit from this weapon damages an enemy whose Offensive Level exceeds the wielder's, inflict 2 Fragile Count on that enemy.",
      "III": "Once per Turn, when a Hit from this weapon damages an enemy whose Offensive Level exceeds the wielder's, inflict 3 Fragile Count on that enemy."
    },
    "statuses": "On Hit; Fragile; Offensive Level",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  },
  {
    "id": "threshold_aegis",
    "name": "Threshold Aegis",
    "school": "Warding",
    "kind": "armor",
    "allowedChassisIds": [
      "breastplate",
      "half_plate",
      "plate_armor",
      "chain_mail"
    ],
    "exampleItem": "Threshold Aegis Breastplate",
    "lore": "A pale barrier only becomes visible in the smallest interval before the wound.",
    "baseEffect": "Once per Turn, immediately Before Getting Hit by a direct enemy Attack Skill, gain {shield} temporary Shield which can absorb that incoming Hit.",
    "baseMagnitudes": {
      "shield": 5
    },
    "axes": [
      "Before Getting Hit",
      "Shield",
      "Defense"
    ],
    "limits": "The defensive reaction must resolve before damage; 1 Magic Durability is consumed when Shield is granted, even if the attack then misses. No triggers from status ticks or self-harm.",
    "event": "before_getting_hit",
    "items": [
      "Armor"
    ],
    "rankMagnitudes": {
      "I": {
        "shield": 5
      },
      "II": {
        "shield": 8
      },
      "III": {
        "shield": 13
      }
    },
    "tiers": {
      "I": "Once per Turn, immediately Before Getting Hit by a direct enemy Attack Skill, gain 5 temporary Shield which can absorb that incoming Hit.",
      "II": "Once per Turn, immediately Before Getting Hit by a direct enemy Attack Skill, gain 8 temporary Shield which can absorb that incoming Hit.",
      "III": "Once per Turn, immediately Before Getting Hit by a direct enemy Attack Skill, gain 13 temporary Shield which can absorb that incoming Hit."
    },
    "statuses": "Before Getting Hit; Shield; Defense",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "magicDurabilityRequired": true
  }
];

ADDITIONS.push({
  "id": "sovereign_impact",
  "name": "Sovereign Impact",
  "school": "Resonant",
  "kind": "weapon",
  "allowedChassisIds": [
    "longsword",
    "greatsword",
    "greataxe",
    "warhammer",
    "rapier",
    "spear",
    "longbow",
    "heavy_crossbow",
    "scimitar",
    "maul"
  ],
  "exampleItem": "Sovereign Impact Greatsword",
  "lore": "No element, no creed, no singular wound can hold the inscription; every honest strike answers the same command.",
  "baseEffect": "When a damaging Attack Skill sourced from this equipped weapon deals direct damage, increase that eligible direct damage by {percent}%, regardless of its physical Damage Type or SIN affinity.",
  "baseMagnitudes": {
    "percent": 5
  },
  "axes": [
    "Damage",
    "Universal",
    "On Hit"
  ],
  "limits": "Premium economic category above all specialist +5% boosters. Same 5% base is an editorial proposal pending explicit approval. Applies to direct Skill damage, not Status ticks, post-hit Fixed Damage, or attacks from another Item Instance. One Magic Durability per qualifying property use; multi-Coin frequency needs approval.",
  "damageBonus": {
    "scope": "universal",
    "type": "all_eligible_direct",
    "priority": "premium",
    "baseMagnitudeApproval": "pending"
  },
  "items": [
    "Weapon"
  ],
  "rankMagnitudes": {
    "I": {
      "percent": 5
    },
    "II": {
      "percent": 8
    },
    "III": {
      "percent": 13
    }
  },
  "tiers": {
    "I": "When a damaging Attack Skill sourced from this equipped weapon deals direct damage, increase that eligible direct damage by 5%, regardless of its physical Damage Type or SIN affinity.",
    "II": "When a damaging Attack Skill sourced from this equipped weapon deals direct damage, increase that eligible direct damage by 8%, regardless of its physical Damage Type or SIN affinity.",
    "III": "When a damaging Attack Skill sourced from this equipped weapon deals direct damage, increase that eligible direct damage by 13%, regardless of its physical Damage Type or SIN affinity."
  },
  "statuses": "Damage; Universal; On Hit",
  "scaling": "ceil(baseMagnitude * rankMultiplier)",
  "reviewStatus": "proposed",
  "implementation": "design_only",
  "requiresEngine": true,
  "magicDurabilityRequired": true
});
const ENCHANTMENTS=Object.freeze([...BASE.ENCHANTMENTS,...ADDITIONS]);
const SCHOOLS=Object.freeze([...BASE.SCHOOLS,...new Set(ADDITIONS.map(e=>e.school).filter(s=>!BASE.SCHOOLS.includes(s)))]);
const normalize=(v)=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const eligible=(id,item)=>{const e=ENCHANTMENTS.find(x=>x.id===normalize(id));if(!e||!item)return false;const kind=normalize(item.itemType||item.equipment?.kind||item.kind||item.category);const chassis=normalize(item.chassisId||item.weaponId||item.baseWeaponId||item.definitionId);return kind===e.kind&&!!chassis&&e.allowedChassisIds.includes(chassis);};
const API=Object.freeze({version:"review-v6",approved:false,gameplayEnabled:false,RANK_MULTIPLIERS:BASE.RANK_MULTIPLIERS,ENCHANTMENTS,SCHOOLS,scale:BASE.scale,eligible,BASE_COUNT:104,EXPANSION_COUNT:ADDITIONS.length});
global.LuminousEnchantmentDesignReview=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
