(function(global){
"use strict";
// Editorial volume II only; no registered Item or Combat effects.
const BASE=global.LuminousEnchantmentDesignReview;
if(!BASE||BASE.gameplayEnabled!==false||BASE.ENCHANTMENTS.length!==42)throw new Error("Enchantment review base unavailable");
const ADDITIONS=[
  {
    "id": "hellbrand",
    "name": "Hellbrand",
    "school": "Infernal",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "greatsword",
      "scimitar"
    ],
    "exampleItem": "Hellbrand Longsword",
    "lore": "The steel eats its master's breath so the world may choke on its smoke.",
    "baseEffect": "Once per Turn at Turn Start, pay 3 SP to prime this weapon until Turn End. The next weapon-linked Hit inflicts {potency} Burn Potency / {count} Count, then clears the priming.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 2
    },
    "axes": [
      "Fire",
      "SP",
      "Status"
    ],
    "limits": "The 3 SP payment is fixed, not multiplied; miss forfeits the priming. No free damage, SP debt cannot go below zero.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn at Turn Start, pay 3 SP to prime this weapon until Turn End. The next weapon-linked Hit inflicts 2 Burn Potency / 2 Count, then clears the priming.",
      "II": "Once per Turn at Turn Start, pay 3 SP to prime this weapon until Turn End. The next weapon-linked Hit inflicts 3 Burn Potency / 3 Count, then clears the priming.",
      "III": "Once per Turn at Turn Start, pay 3 SP to prime this weapon until Turn End. The next weapon-linked Hit inflicts 5 Burn Potency / 5 Count, then clears the priming."
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 2
      },
      "II": {
        "potency": 3,
        "count": 3
      },
      "III": {
        "potency": 5,
        "count": 5
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Burn; SP"
  },
  {
    "id": "phoenix_tether",
    "name": "Phoenix Tether",
    "school": "Infernal",
    "kind": "armor",
    "allowedChassisIds": [
      "breastplate",
      "half_plate",
      "plate_armor"
    ],
    "exampleItem": "Phoenix Tether Breastplate",
    "lore": "Each seam is tied with an ember saved from a funeral pyre; when the body falters, the thread begins to burn.",
    "baseEffect": "Once per Encounter, after direct enemy damage drops you below 25% HP but leaves you alive, recover {healing} HP at the next Turn Start and suffer 1 Burn Count (1 Potency) as a fixed backlash.",
    "baseMagnitudes": {
      "healing": 5
    },
    "axes": [
      "Fire",
      "HP",
      "Survival"
    ],
    "limits": "The 25% threshold and self-Burn backlash stay fixed. Healing cannot resurrect, prevent the triggering hit, or exceed missing HP.",
    "items": [
      "Armor"
    ],
    "tiers": {
      "I": "Once per Encounter, after direct enemy damage drops you below 25% HP but leaves you alive, recover 5 HP at the next Turn Start and suffer 1 Burn Count (1 Potency) as a fixed backlash.",
      "II": "Once per Encounter, after direct enemy damage drops you below 25% HP but leaves you alive, recover 8 HP at the next Turn Start and suffer 1 Burn Count (1 Potency) as a fixed backlash.",
      "III": "Once per Encounter, after direct enemy damage drops you below 25% HP but leaves you alive, recover 13 HP at the next Turn Start and suffer 1 Burn Count (1 Potency) as a fixed backlash."
    },
    "rankMagnitudes": {
      "I": {
        "healing": 5
      },
      "II": {
        "healing": 8
      },
      "III": {
        "healing": 13
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Burn; HP"
  },
  {
    "id": "everfrost_seal",
    "name": "Everfrost Seal",
    "school": "Glacial",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "pendant",
      "necklace"
    ],
    "exampleItem": "Everfrost Seal Pendant",
    "lore": "A drop of glacial silence is suspended inside the jewel, waiting to drink back the cold.",
    "baseEffect": "Once per Turn at Turn Start, if you have Chill, remove exactly 1 Chill Count and restore {sp} SP.",
    "baseMagnitudes": {
      "sp": 3
    },
    "axes": [
      "Cold",
      "SP",
      "Status"
    ],
    "limits": "Chill expenditure remains one across Ranks. No SP restoration without actual Chill, and no extension of Chill or immunity bypass.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Turn at Turn Start, if you have Chill, remove exactly 1 Chill Count and restore 3 SP.",
      "II": "Once per Turn at Turn Start, if you have Chill, remove exactly 1 Chill Count and restore 5 SP.",
      "III": "Once per Turn at Turn Start, if you have Chill, remove exactly 1 Chill Count and restore 8 SP."
    },
    "rankMagnitudes": {
      "I": {
        "sp": 3
      },
      "II": {
        "sp": 5
      },
      "III": {
        "sp": 8
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Chill; SP"
  },
  {
    "id": "icevein_bulwark",
    "name": "Icevein Bulwark",
    "school": "Glacial",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_heater",
      "shield_tower",
      "shield_round"
    ],
    "exampleItem": "Icevein Bulwark Heater Shield",
    "lore": "The shield's heart is colder than the air around it, hardening when a winter-marked hand strikes.",
    "baseEffect": "Once per Turn, when a Guard with this shield prevents direct damage from an attacker already affected by Chill, gain {defense} Defensive Level Up for your next Turn.",
    "baseMagnitudes": {
      "defense": 1
    },
    "axes": [
      "Cold",
      "Defensive Level",
      "Status"
    ],
    "limits": "Requires attacker to already have Chill before the Guard. Never changes the current Guard's result retroactively.",
    "items": [
      "Shield"
    ],
    "tiers": {
      "I": "Once per Turn, when a Guard with this shield prevents direct damage from an attacker already affected by Chill, gain 1 Defensive Level Up for your next Turn.",
      "II": "Once per Turn, when a Guard with this shield prevents direct damage from an attacker already affected by Chill, gain 2 Defensive Level Up for your next Turn.",
      "III": "Once per Turn, when a Guard with this shield prevents direct damage from an attacker already affected by Chill, gain 3 Defensive Level Up for your next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "defense": 1
      },
      "II": {
        "defense": 2
      },
      "III": {
        "defense": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Chill; Defensive Level"
  },
  {
    "id": "thunderstride",
    "name": "Thunderstride",
    "school": "Tempest",
    "kind": "accessory",
    "allowedChassisIds": [
      "anklet",
      "bracelet"
    ],
    "exampleItem": "Thunderstride Anklet",
    "lore": "Lightning jumps from every step; the wearer learns to move before thunder chooses a direction.",
    "baseEffect": "Once per Turn, when your own Attack Skill inflicts Shock on a target, gain {haste} Haste for your next Turn.",
    "baseMagnitudes": {
      "haste": 1
    },
    "axes": [
      "Lightning",
      "Speed",
      "Status"
    ],
    "limits": "Haste follows canonical duration and cannot generate new Action Slots. A single Skill inflicting multiple Shock packets triggers once.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Turn, when your own Attack Skill inflicts Shock on a target, gain 1 Haste for your next Turn.",
      "II": "Once per Turn, when your own Attack Skill inflicts Shock on a target, gain 2 Haste for your next Turn.",
      "III": "Once per Turn, when your own Attack Skill inflicts Shock on a target, gain 3 Haste for your next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "haste": 1
      },
      "II": {
        "haste": 2
      },
      "III": {
        "haste": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Shock; Haste"
  },
  {
    "id": "tempest_crown",
    "name": "Tempest Crown",
    "school": "Tempest",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "scimitar",
      "rapier"
    ],
    "exampleItem": "Tempest Crown Scimitar",
    "lore": "Every successful discharge leaves the wielder one heartbeat ahead of the storm.",
    "baseEffect": "Once per Turn, after a weapon-linked Hit against an enemy already carrying Shock, gain {offense} Offensive Level Up on the next weapon-linked Skill this Turn.",
    "baseMagnitudes": {
      "offense": 1
    },
    "axes": [
      "Lightning",
      "Offensive Level",
      "Status"
    ],
    "limits": "Does not increase Base Power or Clash Power directly. The buff expires unused at Turn End and cannot increase the Hit that triggered it.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, after a weapon-linked Hit against an enemy already carrying Shock, gain 1 Offensive Level Up on the next weapon-linked Skill this Turn.",
      "II": "Once per Turn, after a weapon-linked Hit against an enemy already carrying Shock, gain 2 Offensive Level Up on the next weapon-linked Skill this Turn.",
      "III": "Once per Turn, after a weapon-linked Hit against an enemy already carrying Shock, gain 3 Offensive Level Up on the next weapon-linked Skill this Turn."
    },
    "rankMagnitudes": {
      "I": {
        "offense": 1
      },
      "II": {
        "offense": 2
      },
      "III": {
        "offense": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Shock; Offensive Level"
  },
  {
    "id": "acidwake",
    "name": "Acidwake",
    "school": "Corrosive",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "scimitar",
      "shortsword"
    ],
    "exampleItem": "Acidwake Longsword",
    "lore": "The edge carries a hunger for metal; the cleaner the guard, the sweeter the ruin.",
    "baseEffect": "Once per Turn, a weapon-linked Hit against an enemy currently protected by a Shield inflicts {corrosion} Corrosion Count and deals {shieldDamage} additional damage to its Shield only.",
    "baseMagnitudes": {
      "corrosion": 2,
      "shieldDamage": 3
    },
    "axes": [
      "Acid",
      "Corrosion",
      "Shield"
    ],
    "limits": "Does not overflow damage into HP. Corrosion is canonical and does not destroy Item Instances or equipment without an explicit damage system.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, a weapon-linked Hit against an enemy currently protected by a Shield inflicts 2 Corrosion Count and deals 3 additional damage to its Shield only.",
      "II": "Once per Turn, a weapon-linked Hit against an enemy currently protected by a Shield inflicts 3 Corrosion Count and deals 5 additional damage to its Shield only.",
      "III": "Once per Turn, a weapon-linked Hit against an enemy currently protected by a Shield inflicts 5 Corrosion Count and deals 8 additional damage to its Shield only."
    },
    "rankMagnitudes": {
      "I": {
        "corrosion": 2,
        "shieldDamage": 3
      },
      "II": {
        "corrosion": 3,
        "shieldDamage": 5
      },
      "III": {
        "corrosion": 5,
        "shieldDamage": 8
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Corrosion; Shield"
  },
  {
    "id": "rustthorn",
    "name": "Rustthorn",
    "school": "Corrosive",
    "kind": "weapon",
    "allowedChassisIds": [
      "dagger",
      "rapier",
      "shortsword"
    ],
    "exampleItem": "Rustthorn Dagger",
    "lore": "Its point leaves no visible hole, only a sudden doubt in the enemy's ability to hold their ground.",
    "baseEffect": "Once per Turn, a Hit from this weapon against an enemy already carrying Corrosion inflicts {offenseDown} Offensive Level Down until the end of its next Turn.",
    "baseMagnitudes": {
      "offenseDown": 1
    },
    "axes": [
      "Acid",
      "Corrosion",
      "Offensive Level"
    ],
    "limits": "Requires pre-existing Corrosion. Temporary level debuffs are not equipment damage and cannot permanently reduce character progression.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, a Hit from this weapon against an enemy already carrying Corrosion inflicts 1 Offensive Level Down until the end of its next Turn.",
      "II": "Once per Turn, a Hit from this weapon against an enemy already carrying Corrosion inflicts 2 Offensive Level Down until the end of its next Turn.",
      "III": "Once per Turn, a Hit from this weapon against an enemy already carrying Corrosion inflicts 3 Offensive Level Down until the end of its next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "offenseDown": 1
      },
      "II": {
        "offenseDown": 2
      },
      "III": {
        "offenseDown": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Corrosion; Offensive Level"
  },
  {
    "id": "vitriol_reaver",
    "name": "Vitriol Reaver",
    "school": "Corrosive",
    "kind": "weapon",
    "allowedChassisIds": [
      "warhammer",
      "maul",
      "war_pick"
    ],
    "exampleItem": "Vitriol Reaver Warhammer",
    "lore": "The hammer's song is the sound of a fortress remembering it was once only ore.",
    "baseEffect": "Once per Turn, when this weapon breaks an enemy Shield, inflict {corrosion} Corrosion Count and {defenseDown} Defensive Level Down on its owner for the next Turn.",
    "baseMagnitudes": {
      "corrosion": 2,
      "defenseDown": 1
    },
    "axes": [
      "Acid",
      "Corrosion",
      "Defensive Level"
    ],
    "limits": "Requires an actual Shield break by this exact weapon. No bonus damage against unshielded HP and no repeated breaks of the same Shield.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, when this weapon breaks an enemy Shield, inflict 2 Corrosion Count and 1 Defensive Level Down on its owner for the next Turn.",
      "II": "Once per Turn, when this weapon breaks an enemy Shield, inflict 3 Corrosion Count and 2 Defensive Level Down on its owner for the next Turn.",
      "III": "Once per Turn, when this weapon breaks an enemy Shield, inflict 5 Corrosion Count and 3 Defensive Level Down on its owner for the next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "corrosion": 2,
        "defenseDown": 1
      },
      "II": {
        "corrosion": 3,
        "defenseDown": 2
      },
      "III": {
        "corrosion": 5,
        "defenseDown": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Corrosion; Shield; Defensive Level"
  },
  {
    "id": "acidblood_mantle",
    "name": "Acidblood Mantle",
    "school": "Corrosive",
    "kind": "armor",
    "allowedChassisIds": [
      "leather_armor",
      "hide_armor",
      "scale_mail"
    ],
    "exampleItem": "Acidblood Mantle Leather Armor",
    "lore": "The lining is harmless while untouched. The first hostile wound wakes the venomous lacquer.",
    "baseEffect": "Once per Turn, after a direct enemy Attack Skill actually damages the wearer's HP, inflict {corrosion} Corrosion Count on the attacker and gain {defense} Defensive Level Up for the next Turn.",
    "baseMagnitudes": {
      "corrosion": 2,
      "defense": 1
    },
    "axes": [
      "Acid",
      "Corrosion",
      "Defensive Level",
      "HP"
    ],
    "limits": "Not triggered by self-damage, Burn, Poison ticks, or a fully absorbed Hit. The buff cannot retroactively prevent damage.",
    "items": [
      "Armor"
    ],
    "tiers": {
      "I": "Once per Turn, after a direct enemy Attack Skill actually damages the wearer's HP, inflict 2 Corrosion Count on the attacker and gain 1 Defensive Level Up for the next Turn.",
      "II": "Once per Turn, after a direct enemy Attack Skill actually damages the wearer's HP, inflict 3 Corrosion Count on the attacker and gain 2 Defensive Level Up for the next Turn.",
      "III": "Once per Turn, after a direct enemy Attack Skill actually damages the wearer's HP, inflict 5 Corrosion Count on the attacker and gain 3 Defensive Level Up for the next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "corrosion": 2,
        "defense": 1
      },
      "II": {
        "corrosion": 3,
        "defense": 2
      },
      "III": {
        "corrosion": 5,
        "defense": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Corrosion; HP; Defensive Level"
  },
  {
    "id": "caustic_parapet",
    "name": "Caustic Parapet",
    "school": "Corrosive",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_heater",
      "shield_tower",
      "shield_round"
    ],
    "exampleItem": "Caustic Parapet Heater Shield",
    "lore": "A pale foam blossoms across the rim, eating at every blade forced against it.",
    "baseEffect": "Once per Turn, after a Guard with this shield prevents direct melee damage, inflict {corrosion} Corrosion Count on the melee attacker.",
    "baseMagnitudes": {
      "corrosion": 2
    },
    "axes": [
      "Acid",
      "Corrosion",
      "Guard"
    ],
    "limits": "Only a real Guard with this source shield qualifies. The corrosion affects the attacker, not the attacker's physical gear.",
    "items": [
      "Shield"
    ],
    "tiers": {
      "I": "Once per Turn, after a Guard with this shield prevents direct melee damage, inflict 2 Corrosion Count on the melee attacker.",
      "II": "Once per Turn, after a Guard with this shield prevents direct melee damage, inflict 3 Corrosion Count on the melee attacker.",
      "III": "Once per Turn, after a Guard with this shield prevents direct melee damage, inflict 5 Corrosion Count on the melee attacker."
    },
    "rankMagnitudes": {
      "I": {
        "corrosion": 2
      },
      "II": {
        "corrosion": 3
      },
      "III": {
        "corrosion": 5
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Corrosion"
  },
  {
    "id": "alkahest_charm",
    "name": "Alkahest Charm",
    "school": "Corrosive",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "pendant",
      "brooch"
    ],
    "exampleItem": "Alkahest Charm Pendant",
    "lore": "Every poison has an antidote somewhere; this charm demands that it be brewed inside the wearer's own blood.",
    "baseEffect": "Once per Turn at Turn Start, if you are affected by Corrosion, remove exactly 1 Corrosion Count and recover {hp} HP.",
    "baseMagnitudes": {
      "hp": 3
    },
    "axes": [
      "Acid",
      "Corrosion",
      "HP"
    ],
    "limits": "The removal cost remains 1 Count. No healing without Corrosion and no HP gained above Max HP.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Turn at Turn Start, if you are affected by Corrosion, remove exactly 1 Corrosion Count and recover 3 HP.",
      "II": "Once per Turn at Turn Start, if you are affected by Corrosion, remove exactly 1 Corrosion Count and recover 5 HP.",
      "III": "Once per Turn at Turn Start, if you are affected by Corrosion, remove exactly 1 Corrosion Count and recover 8 HP."
    },
    "rankMagnitudes": {
      "I": {
        "hp": 3
      },
      "II": {
        "hp": 5
      },
      "III": {
        "hp": 8
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Corrosion; HP"
  },
  {
    "id": "viper_s_mercy",
    "name": "Viper's Mercy",
    "school": "Venomous",
    "kind": "weapon",
    "allowedChassisIds": [
      "dagger",
      "shortsword",
      "rapier"
    ],
    "exampleItem": "Viper's Mercy Dagger",
    "lore": "The serpent engraved upon the blade opens its eyes only when blood first touches the edge.",
    "baseEffect": "Once per Turn, the first Critical Hit from this weapon inflicts {potency} Poison Potency / {count} Count.",
    "baseMagnitudes": {
      "potency": 1,
      "count": 3
    },
    "axes": [
      "Poison",
      "Status",
      "Critical"
    ],
    "limits": "A real Critical Hit is required. Does not modify critical chance, and Poison's unusual Potency/Count formula stays canonical.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, the first Critical Hit from this weapon inflicts 1 Poison Potency / 3 Count.",
      "II": "Once per Turn, the first Critical Hit from this weapon inflicts 2 Poison Potency / 5 Count.",
      "III": "Once per Turn, the first Critical Hit from this weapon inflicts 3 Poison Potency / 8 Count."
    },
    "rankMagnitudes": {
      "I": {
        "potency": 1,
        "count": 3
      },
      "II": {
        "potency": 2,
        "count": 5
      },
      "III": {
        "potency": 3,
        "count": 8
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Poison"
  },
  {
    "id": "widowmaker_s_kiss",
    "name": "Widowmaker's Kiss",
    "school": "Venomous",
    "kind": "weapon",
    "allowedChassisIds": [
      "longbow",
      "shortbow",
      "hand_crossbow"
    ],
    "exampleItem": "Widowmaker's Kiss Longbow",
    "lore": "The arrows bear no venom in the quiver. It blossoms only inside a prey that has already been poisoned.",
    "baseEffect": "Once per Turn, a weapon-linked Hit against an enemy already affected by Poison inflicts {count} additional Poison Count and {bind} Bind for its next Turn.",
    "baseMagnitudes": {
      "count": 3,
      "bind": 1
    },
    "axes": [
      "Poison",
      "Speed",
      "Status"
    ],
    "limits": "Poison must exist before the Hit. Bind affects Speed using canonical rules; does not immobilize or remove Action Slots.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, a weapon-linked Hit against an enemy already affected by Poison inflicts 3 additional Poison Count and 1 Bind for its next Turn.",
      "II": "Once per Turn, a weapon-linked Hit against an enemy already affected by Poison inflicts 5 additional Poison Count and 2 Bind for its next Turn.",
      "III": "Once per Turn, a weapon-linked Hit against an enemy already affected by Poison inflicts 8 additional Poison Count and 3 Bind for its next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "count": 3,
        "bind": 1
      },
      "II": {
        "count": 5,
        "bind": 2
      },
      "III": {
        "count": 8,
        "bind": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Poison; Bind"
  },
  {
    "id": "plaguecarapace",
    "name": "Plaguecarapace",
    "school": "Venomous",
    "kind": "armor",
    "allowedChassisIds": [
      "hide_armor",
      "scale_mail",
      "chain_mail"
    ],
    "exampleItem": "Plaguecarapace Scale Mail",
    "lore": "A colony of dormant creatures lives between its plates, feeding on the suffering of anything that approaches.",
    "baseEffect": "Once per Turn, when a Poisoned enemy's direct Attack Skill damages your HP, restore {hp} HP after the Hit resolves.",
    "baseMagnitudes": {
      "hp": 3
    },
    "axes": [
      "Poison",
      "HP",
      "Survival"
    ],
    "limits": "The attack must first deal real HP damage; no zero-damage heal farming. Recovery cannot exceed missing HP.",
    "items": [
      "Armor"
    ],
    "tiers": {
      "I": "Once per Turn, when a Poisoned enemy's direct Attack Skill damages your HP, restore 3 HP after the Hit resolves.",
      "II": "Once per Turn, when a Poisoned enemy's direct Attack Skill damages your HP, restore 5 HP after the Hit resolves.",
      "III": "Once per Turn, when a Poisoned enemy's direct Attack Skill damages your HP, restore 8 HP after the Hit resolves."
    },
    "rankMagnitudes": {
      "I": {
        "hp": 3
      },
      "II": {
        "hp": 5
      },
      "III": {
        "hp": 8
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Poison; HP"
  },
  {
    "id": "serpentglass",
    "name": "Serpentglass",
    "school": "Venomous",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "pendant",
      "brooch"
    ],
    "exampleItem": "Serpentglass Ring",
    "lore": "Through its green glass the wearer sees each toxin as a thread that can be cut and spun into thought.",
    "baseEffect": "Once per Turn at Turn Start, while you carry Poison, remove exactly 1 Poison Count and recover {sp} SP.",
    "baseMagnitudes": {
      "sp": 3
    },
    "axes": [
      "Poison",
      "SP",
      "Status"
    ],
    "limits": "The Count expenditure is fixed. Does not remove Poison Potency for free or prevent future Poison applications.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Turn at Turn Start, while you carry Poison, remove exactly 1 Poison Count and recover 3 SP.",
      "II": "Once per Turn at Turn Start, while you carry Poison, remove exactly 1 Poison Count and recover 5 SP.",
      "III": "Once per Turn at Turn Start, while you carry Poison, remove exactly 1 Poison Count and recover 8 SP."
    },
    "rankMagnitudes": {
      "I": {
        "sp": 3
      },
      "II": {
        "sp": 5
      },
      "III": {
        "sp": 8
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Poison; SP"
  },
  {
    "id": "basilisk_shell",
    "name": "Basilisk Shell",
    "school": "Venomous",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_buckler",
      "shield_round",
      "shield_heater"
    ],
    "exampleItem": "Basilisk Shell Round Shield",
    "lore": "The carved eye in the shield never blinks, even when the bearer does.",
    "baseEffect": "Once per Turn, after guarding a direct melee attack with this shield, inflict {potency} Poison Potency / {count} Count on the attacker.",
    "baseMagnitudes": {
      "potency": 1,
      "count": 2
    },
    "axes": [
      "Poison",
      "Guard",
      "Status"
    ],
    "limits": "Guard with the actual shield must be valid. The ward does not petrify enemies and cannot trigger from poison damage itself.",
    "items": [
      "Shield"
    ],
    "tiers": {
      "I": "Once per Turn, after guarding a direct melee attack with this shield, inflict 1 Poison Potency / 2 Count on the attacker.",
      "II": "Once per Turn, after guarding a direct melee attack with this shield, inflict 2 Poison Potency / 3 Count on the attacker.",
      "III": "Once per Turn, after guarding a direct melee attack with this shield, inflict 3 Poison Potency / 5 Count on the attacker."
    },
    "rankMagnitudes": {
      "I": {
        "potency": 1,
        "count": 2
      },
      "II": {
        "potency": 2,
        "count": 3
      },
      "III": {
        "potency": 3,
        "count": 5
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Poison"
  },
  {
    "id": "noxious_oath",
    "name": "Noxious Oath",
    "school": "Venomous",
    "kind": "weapon",
    "allowedChassisIds": [
      "spear",
      "trident",
      "pike"
    ],
    "exampleItem": "Noxious Oath Spear",
    "lore": "The spearhead bears the oath of a physician who promised that no wound should end quickly.",
    "baseEffect": "At Turn Start, pay 3 SP to prime this weapon for that Turn; the next weapon-linked Hit inflicts {potency} Poison Potency / {count} Count, then consumes the prime. Once per Turn.",
    "baseMagnitudes": {
      "potency": 1,
      "count": 3
    },
    "axes": [
      "Poison",
      "SP",
      "Status"
    ],
    "limits": "SP payment remains 3 across all Ranks. A miss loses the prime, and the wielder cannot go into negative SP debt.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "At Turn Start, pay 3 SP to prime this weapon for that Turn; the next weapon-linked Hit inflicts 1 Poison Potency / 3 Count, then consumes the prime. Once per Turn.",
      "II": "At Turn Start, pay 3 SP to prime this weapon for that Turn; the next weapon-linked Hit inflicts 2 Poison Potency / 5 Count, then consumes the prime. Once per Turn.",
      "III": "At Turn Start, pay 3 SP to prime this weapon for that Turn; the next weapon-linked Hit inflicts 3 Poison Potency / 8 Count, then consumes the prime. Once per Turn."
    },
    "rankMagnitudes": {
      "I": {
        "potency": 1,
        "count": 3
      },
      "II": {
        "potency": 2,
        "count": 5
      },
      "III": {
        "potency": 3,
        "count": 8
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Poison; SP"
  },
  {
    "id": "undertide",
    "name": "Undertide",
    "school": "Tidal",
    "kind": "weapon",
    "allowedChassisIds": [
      "trident",
      "spear",
      "glaive"
    ],
    "exampleItem": "Undertide Trident",
    "lore": "The weapon drags the silence from the bottom of the sea into every fresh wound.",
    "baseEffect": "Once per Turn, the first Hit with this weapon inflicts {potency} Sinking Potency / {count} Count.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 2
    },
    "axes": [
      "Water",
      "Sinking",
      "SP"
    ],
    "limits": "Water is flavor, not a newly registered Wet status. Sinking uses the existing canonical SP interaction.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, the first Hit with this weapon inflicts 2 Sinking Potency / 2 Count.",
      "II": "Once per Turn, the first Hit with this weapon inflicts 3 Sinking Potency / 3 Count.",
      "III": "Once per Turn, the first Hit with this weapon inflicts 5 Sinking Potency / 5 Count."
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 2
      },
      "II": {
        "potency": 3,
        "count": 3
      },
      "III": {
        "potency": 5,
        "count": 5
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Sinking; SP"
  },
  {
    "id": "ripcurrent",
    "name": "Ripcurrent",
    "school": "Tidal",
    "kind": "weapon",
    "allowedChassisIds": [
      "spear",
      "pike",
      "trident"
    ],
    "exampleItem": "Ripcurrent Spear",
    "lore": "Currents never chase the strongest swimmer; they pull the one who believed they could outrun them.",
    "baseEffect": "Once per Turn, a weapon-linked Hit against a target faster than the wielder inflicts {bind} Bind for its next Turn and {sinking} Sinking Count.",
    "baseMagnitudes": {
      "bind": 1,
      "sinking": 2
    },
    "axes": [
      "Water",
      "Speed",
      "Sinking"
    ],
    "limits": "Requires a valid Speed comparison; does not forcibly move, knock prone or immobilize the target.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, a weapon-linked Hit against a target faster than the wielder inflicts 1 Bind for its next Turn and 2 Sinking Count.",
      "II": "Once per Turn, a weapon-linked Hit against a target faster than the wielder inflicts 2 Bind for its next Turn and 3 Sinking Count.",
      "III": "Once per Turn, a weapon-linked Hit against a target faster than the wielder inflicts 3 Bind for its next Turn and 5 Sinking Count."
    },
    "rankMagnitudes": {
      "I": {
        "bind": 1,
        "sinking": 2
      },
      "II": {
        "bind": 2,
        "sinking": 3
      },
      "III": {
        "bind": 3,
        "sinking": 5
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Sinking; Bind"
  },
  {
    "id": "drowned_regalia",
    "name": "Drowned Regalia",
    "school": "Tidal",
    "kind": "armor",
    "allowedChassisIds": [
      "chain_shirt",
      "scale_mail",
      "half_plate"
    ],
    "exampleItem": "Drowned Regalia Chain Shirt",
    "lore": "The links drip with seawater that refuses to touch the ground, gathering where thought has been wounded.",
    "baseEffect": "Once per Turn, after an enemy directly damages your SP, gain {shield} temporary Shield after the SP loss resolves.",
    "baseMagnitudes": {
      "shield": 4
    },
    "axes": [
      "Water",
      "SP",
      "Shield"
    ],
    "limits": "No Shield from voluntarily spent SP, status ticks, or completely blocked SP damage. It does not retroactively prevent SP loss.",
    "items": [
      "Armor"
    ],
    "tiers": {
      "I": "Once per Turn, after an enemy directly damages your SP, gain 4 temporary Shield after the SP loss resolves.",
      "II": "Once per Turn, after an enemy directly damages your SP, gain 6 temporary Shield after the SP loss resolves.",
      "III": "Once per Turn, after an enemy directly damages your SP, gain 10 temporary Shield after the SP loss resolves."
    },
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
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "SP; Shield"
  },
  {
    "id": "tideguard",
    "name": "Tideguard",
    "school": "Tidal",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_round",
      "shield_heater",
      "shield_tower"
    ],
    "exampleItem": "Tideguard Round Shield",
    "lore": "The waves caught inside the shield remember each life they carried to shore.",
    "baseEffect": "Once per Turn, after a Guard with this shield actually prevents direct enemy damage, restore {sp} SP to its wearer.",
    "baseMagnitudes": {
      "sp": 2
    },
    "axes": [
      "Water",
      "SP",
      "Guard"
    ],
    "limits": "Cannot recover beyond Max SP. A Guard preventing zero damage does not count.",
    "items": [
      "Shield"
    ],
    "tiers": {
      "I": "Once per Turn, after a Guard with this shield actually prevents direct enemy damage, restore 2 SP to its wearer.",
      "II": "Once per Turn, after a Guard with this shield actually prevents direct enemy damage, restore 3 SP to its wearer.",
      "III": "Once per Turn, after a Guard with this shield actually prevents direct enemy damage, restore 5 SP to its wearer."
    },
    "rankMagnitudes": {
      "I": {
        "sp": 2
      },
      "II": {
        "sp": 3
      },
      "III": {
        "sp": 5
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "SP"
  },
  {
    "id": "brineglass",
    "name": "Brineglass",
    "school": "Tidal",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "pendant",
      "necklace"
    ],
    "exampleItem": "Brineglass Ring",
    "lore": "A strand of deep-sea glass rings softly when a troubled mind finds another to anchor itself against.",
    "baseEffect": "Once per Turn, after your Attack Skill successfully Hits an enemy who already had Sinking, recover {sp} SP.",
    "baseMagnitudes": {
      "sp": 2
    },
    "axes": [
      "Water",
      "Sinking",
      "SP"
    ],
    "limits": "The enemy needs Sinking before the Hit. No recovery from missed attacks, status ticks, or targets without valid SP.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Turn, after your Attack Skill successfully Hits an enemy who already had Sinking, recover 2 SP.",
      "II": "Once per Turn, after your Attack Skill successfully Hits an enemy who already had Sinking, recover 3 SP.",
      "III": "Once per Turn, after your Attack Skill successfully Hits an enemy who already had Sinking, recover 5 SP."
    },
    "rankMagnitudes": {
      "I": {
        "sp": 2
      },
      "II": {
        "sp": 3
      },
      "III": {
        "sp": 5
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Sinking; SP"
  },
  {
    "id": "currentstep",
    "name": "Currentstep",
    "school": "Tidal",
    "kind": "accessory",
    "allowedChassisIds": [
      "anklet",
      "bracelet"
    ],
    "exampleItem": "Currentstep Anklet",
    "lore": "The wearer steps through the echo of an incoming strike as if the battlefield were running water.",
    "baseEffect": "Once per Turn, after a successful Evade, gain {haste} Haste for your next Turn and recover {sp} SP.",
    "baseMagnitudes": {
      "haste": 1,
      "sp": 2
    },
    "axes": [
      "Water",
      "Speed",
      "SP"
    ],
    "limits": "A single Evade triggers once. No free Action Slots, and SP recovery cannot exceed Max SP.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Turn, after a successful Evade, gain 1 Haste for your next Turn and recover 2 SP.",
      "II": "Once per Turn, after a successful Evade, gain 2 Haste for your next Turn and recover 3 SP.",
      "III": "Once per Turn, after a successful Evade, gain 3 Haste for your next Turn and recover 5 SP."
    },
    "rankMagnitudes": {
      "I": {
        "haste": 1,
        "sp": 2
      },
      "II": {
        "haste": 2,
        "sp": 3
      },
      "III": {
        "haste": 3,
        "sp": 5
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Haste; SP"
  },
  {
    "id": "faultforge",
    "name": "Faultforge",
    "school": "Geomantic",
    "kind": "weapon",
    "allowedChassisIds": [
      "maul",
      "warhammer",
      "mace"
    ],
    "exampleItem": "Faultforge Maul",
    "lore": "Every blow sketches a new fault beneath the enemy's feet, even on a battlefield of polished stone.",
    "baseEffect": "Once per Turn, the first Hit with this weapon inflicts {potency} Tremor Potency / {count} Count.",
    "baseMagnitudes": {
      "potency": 3,
      "count": 2
    },
    "axes": [
      "Earth",
      "Tremor",
      "Stagger"
    ],
    "limits": "Tremor modifies Stagger mechanics through its existing Burst rule; this effect does not itself cause HP damage.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, the first Hit with this weapon inflicts 3 Tremor Potency / 2 Count.",
      "II": "Once per Turn, the first Hit with this weapon inflicts 5 Tremor Potency / 3 Count.",
      "III": "Once per Turn, the first Hit with this weapon inflicts 8 Tremor Potency / 5 Count."
    },
    "rankMagnitudes": {
      "I": {
        "potency": 3,
        "count": 2
      },
      "II": {
        "potency": 5,
        "count": 3
      },
      "III": {
        "potency": 8,
        "count": 5
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Tremor"
  },
  {
    "id": "stoneheart",
    "name": "Stoneheart",
    "school": "Geomantic",
    "kind": "armor",
    "allowedChassisIds": [
      "breastplate",
      "half_plate",
      "plate_armor"
    ],
    "exampleItem": "Stoneheart Breastplate",
    "lore": "The cuirass lends the wearer the patience of mountains, but only after pain has proved their resolve.",
    "baseEffect": "Once per Turn, after a direct enemy Hit removes at least 25% of your current Max HP, gain {score} temporary CON Score until the end of your next Turn.",
    "baseMagnitudes": {
      "score": 1
    },
    "axes": [
      "Earth",
      "HP",
      "CON Score"
    ],
    "limits": "The 25% damage threshold is fixed. Temporary scores never permanently alter Max HP or heal HP; Score-derived effects need authoritative recomputation.",
    "items": [
      "Armor"
    ],
    "tiers": {
      "I": "Once per Turn, after a direct enemy Hit removes at least 25% of your current Max HP, gain 1 temporary CON Score until the end of your next Turn.",
      "II": "Once per Turn, after a direct enemy Hit removes at least 25% of your current Max HP, gain 2 temporary CON Score until the end of your next Turn.",
      "III": "Once per Turn, after a direct enemy Hit removes at least 25% of your current Max HP, gain 3 temporary CON Score until the end of your next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "score": 1
      },
      "II": {
        "score": 2
      },
      "III": {
        "score": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "HP; CON"
  },
  {
    "id": "bedrock_aegis",
    "name": "Bedrock Aegis",
    "school": "Geomantic",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_heater",
      "shield_tower"
    ],
    "exampleItem": "Bedrock Aegis Tower Shield",
    "lore": "At every impact, the shield becomes heavier with the memory of all the earth beneath it.",
    "baseEffect": "Once per Turn, after a Guard with this shield prevents at least 5 direct damage, gain {defense} Defensive Level Up for your next Turn.",
    "baseMagnitudes": {
      "defense": 1
    },
    "axes": [
      "Earth",
      "Defensive Level",
      "Guard"
    ],
    "limits": "The 5 damage requirement is fixed. Does not apply to the Guard that generated it and cannot stack from multiple Guard hits in the same Turn.",
    "items": [
      "Shield"
    ],
    "tiers": {
      "I": "Once per Turn, after a Guard with this shield prevents at least 5 direct damage, gain 1 Defensive Level Up for your next Turn.",
      "II": "Once per Turn, after a Guard with this shield prevents at least 5 direct damage, gain 2 Defensive Level Up for your next Turn.",
      "III": "Once per Turn, after a Guard with this shield prevents at least 5 direct damage, gain 3 Defensive Level Up for your next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "defense": 1
      },
      "II": {
        "defense": 2
      },
      "III": {
        "defense": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Defensive Level"
  },
  {
    "id": "gravity_s_hold",
    "name": "Gravity's Hold",
    "school": "Geomantic",
    "kind": "weapon",
    "allowedChassisIds": [
      "halberd",
      "pike",
      "glaive"
    ],
    "exampleItem": "Gravity's Hold Halberd",
    "lore": "The blade does not strike faster enemies. It makes the distance between their decisions weigh more.",
    "baseEffect": "Once per Turn, a weapon-linked Hit against an enemy with greater Speed inflicts {bind} Bind and {offenseDown} Offensive Level Down for its next Turn.",
    "baseMagnitudes": {
      "bind": 1,
      "offenseDown": 1
    },
    "axes": [
      "Earth",
      "Speed",
      "Offensive Level"
    ],
    "limits": "Requires the target to be faster before the Hit. No arbitrary position changes or Action Slot deletion.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, a weapon-linked Hit against an enemy with greater Speed inflicts 1 Bind and 1 Offensive Level Down for its next Turn.",
      "II": "Once per Turn, a weapon-linked Hit against an enemy with greater Speed inflicts 2 Bind and 2 Offensive Level Down for its next Turn.",
      "III": "Once per Turn, a weapon-linked Hit against an enemy with greater Speed inflicts 3 Bind and 3 Offensive Level Down for its next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "bind": 1,
        "offenseDown": 1
      },
      "II": {
        "bind": 2,
        "offenseDown": 2
      },
      "III": {
        "bind": 3,
        "offenseDown": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Bind; Offensive Level"
  },
  {
    "id": "bastion_root",
    "name": "Bastion Root",
    "school": "Geomantic",
    "kind": "armor",
    "allowedChassisIds": [
      "splint_armor",
      "chain_mail",
      "plate_armor"
    ],
    "exampleItem": "Bastion Root Plate Armor",
    "lore": "Vines of stone blossom around those who choose to stand and endure rather than flee.",
    "baseEffect": "At Turn End, if you used no Evade and moved no distance this Turn, gain {defense} Defensive Level Up during your next Turn. Once per Turn.",
    "baseMagnitudes": {
      "defense": 1
    },
    "axes": [
      "Earth",
      "Defensive Level",
      "Position"
    ],
    "limits": "The condition cannot be met by an Incapacitated wearer. Movement legality and post-Turn buff cleanup require the combat movement hook.",
    "items": [
      "Armor"
    ],
    "tiers": {
      "I": "At Turn End, if you used no Evade and moved no distance this Turn, gain 1 Defensive Level Up during your next Turn. Once per Turn.",
      "II": "At Turn End, if you used no Evade and moved no distance this Turn, gain 2 Defensive Level Up during your next Turn. Once per Turn.",
      "III": "At Turn End, if you used no Evade and moved no distance this Turn, gain 3 Defensive Level Up during your next Turn. Once per Turn."
    },
    "rankMagnitudes": {
      "I": {
        "defense": 1
      },
      "II": {
        "defense": 2
      },
      "III": {
        "defense": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Defensive Level"
  },
  {
    "id": "seismic_lens",
    "name": "Seismic Lens",
    "school": "Geomantic",
    "kind": "accessory",
    "allowedChassisIds": [
      "pendant",
      "brooch",
      "ring"
    ],
    "exampleItem": "Seismic Lens Pendant",
    "lore": "The crystal catches vibrations no ear can hear, returning them as fragments of clarity.",
    "baseEffect": "Once per Turn, after you or an ally triggers Tremor Burst on an enemy within valid range, recover {sp} SP.",
    "baseMagnitudes": {
      "sp": 2
    },
    "axes": [
      "Earth",
      "Tremor",
      "SP"
    ],
    "limits": "Requires an actual Tremor Burst and an authorized target source; multiple Bursts in one Skill do not stack recovery.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Turn, after you or an ally triggers Tremor Burst on an enemy within valid range, recover 2 SP.",
      "II": "Once per Turn, after you or an ally triggers Tremor Burst on an enemy within valid range, recover 3 SP.",
      "III": "Once per Turn, after you or an ally triggers Tremor Burst on an enemy within valid range, recover 5 SP."
    },
    "rankMagnitudes": {
      "I": {
        "sp": 2
      },
      "II": {
        "sp": 3
      },
      "III": {
        "sp": 5
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Tremor; SP"
  },
  {
    "id": "lifewoven_grace",
    "name": "Lifewoven Grace",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "pendant",
      "necklace",
      "brooch"
    ],
    "exampleItem": "Lifewoven Grace Pendant",
    "lore": "Every thread of the charm is a promise that the heart will not be asked to beat alone.",
    "baseEffect": "Once per Turn at Turn Start, if you are below 50% HP, you may spend 3 SP to restore {hp} HP.",
    "baseMagnitudes": {
      "hp": 4
    },
    "axes": [
      "HP",
      "SP",
      "Healing"
    ],
    "limits": "Both the 50% trigger and 3 SP cost are fixed. Cannot heal a wearer at 0 HP or exceed Max HP.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Turn at Turn Start, if you are below 50% HP, you may spend 3 SP to restore 4 HP.",
      "II": "Once per Turn at Turn Start, if you are below 50% HP, you may spend 3 SP to restore 6 HP.",
      "III": "Once per Turn at Turn Start, if you are below 50% HP, you may spend 3 SP to restore 10 HP."
    },
    "rankMagnitudes": {
      "I": {
        "hp": 4
      },
      "II": {
        "hp": 6
      },
      "III": {
        "hp": 10
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "HP; SP"
  },
  {
    "id": "soulkindle",
    "name": "Soulkindle",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "bracelet",
      "pendant"
    ],
    "exampleItem": "Soulkindle Ring",
    "lore": "The ring burns with stolen courage whenever its bearer spends more spirit than they can afford.",
    "baseEffect": "Once per Turn, if you begin an Attack Skill below 50% SP and that Skill Hits an enemy, recover {sp} SP after the Skill resolves.",
    "baseMagnitudes": {
      "sp": 3
    },
    "axes": [
      "SP",
      "Attack",
      "Recovery"
    ],
    "limits": "An actual Skill Hit is required. The threshold is checked before Skill resolution and stays fixed across Ranks.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Turn, if you begin an Attack Skill below 50% SP and that Skill Hits an enemy, recover 3 SP after the Skill resolves.",
      "II": "Once per Turn, if you begin an Attack Skill below 50% SP and that Skill Hits an enemy, recover 5 SP after the Skill resolves.",
      "III": "Once per Turn, if you begin an Attack Skill below 50% SP and that Skill Hits an enemy, recover 8 SP after the Skill resolves."
    },
    "rankMagnitudes": {
      "I": {
        "sp": 3
      },
      "II": {
        "sp": 5
      },
      "III": {
        "sp": 8
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "SP"
  },
  {
    "id": "heartforge",
    "name": "Heartforge",
    "school": "Vital",
    "kind": "armor",
    "allowedChassisIds": [
      "breastplate",
      "half_plate",
      "chain_mail"
    ],
    "exampleItem": "Heartforge Breastplate",
    "lore": "The furnace woven into the armor repays wounds slowly, refusing the seductive lie of instant immortality.",
    "baseEffect": "Once per Turn, after direct enemy damage lowers your HP, store a Heartbeat until your next Turn Start. Consume it then to recover {hp} HP.",
    "baseMagnitudes": {
      "hp": 3
    },
    "axes": [
      "HP",
      "Recovery",
      "Survival"
    ],
    "limits": "Only one Heartbeat may be stored per Turn. Cannot activate from status ticks, revive at 0 HP, or exceed Max HP.",
    "items": [
      "Armor"
    ],
    "tiers": {
      "I": "Once per Turn, after direct enemy damage lowers your HP, store a Heartbeat until your next Turn Start. Consume it then to recover 3 HP.",
      "II": "Once per Turn, after direct enemy damage lowers your HP, store a Heartbeat until your next Turn Start. Consume it then to recover 5 HP.",
      "III": "Once per Turn, after direct enemy damage lowers your HP, store a Heartbeat until your next Turn Start. Consume it then to recover 8 HP."
    },
    "rankMagnitudes": {
      "I": {
        "hp": 3
      },
      "II": {
        "hp": 5
      },
      "III": {
        "hp": 8
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "HP"
  },
  {
    "id": "redline_band",
    "name": "Redline Band",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "bracelet",
      "ring",
      "anklet"
    ],
    "exampleItem": "Redline Band Bracelet",
    "lore": "When the pulse becomes a warning rather than a rhythm, the band answers with a brutal final reserve.",
    "baseEffect": "Once per Encounter, at Turn Start while below 25% HP, gain {score} temporary STR Score until Turn End.",
    "baseMagnitudes": {
      "score": 1
    },
    "axes": [
      "HP",
      "STR Score",
      "Ability Score"
    ],
    "limits": "HP threshold is fixed. Temporary Score never permanently modifies inventory weight, Max HP or learned proficiency; requires Score override integration.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Encounter, at Turn Start while below 25% HP, gain 1 temporary STR Score until Turn End.",
      "II": "Once per Encounter, at Turn Start while below 25% HP, gain 2 temporary STR Score until Turn End.",
      "III": "Once per Encounter, at Turn Start while below 25% HP, gain 3 temporary STR Score until Turn End."
    },
    "rankMagnitudes": {
      "I": {
        "score": 1
      },
      "II": {
        "score": 2
      },
      "III": {
        "score": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "HP; STR"
  },
  {
    "id": "mindglass",
    "name": "Mindglass",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "brooch",
      "pendant",
      "ring"
    ],
    "exampleItem": "Mindglass Brooch",
    "lore": "Failures splinter within the jewel, each one leaving an idea too sharp to be forgotten.",
    "baseEffect": "Once per Encounter, after failing a WIS Save against an enemy effect, gain {score} temporary INT Score for your next INT Check in the same Encounter.",
    "baseMagnitudes": {
      "score": 1
    },
    "axes": [
      "INT Score",
      "WIS Save",
      "Ability Score"
    ],
    "limits": "No reroll or retroactive correction of the failed Save; temporary Score expires after one eligible Check or Encounter End.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Encounter, after failing a WIS Save against an enemy effect, gain 1 temporary INT Score for your next INT Check in the same Encounter.",
      "II": "Once per Encounter, after failing a WIS Save against an enemy effect, gain 2 temporary INT Score for your next INT Check in the same Encounter.",
      "III": "Once per Encounter, after failing a WIS Save against an enemy effect, gain 3 temporary INT Score for your next INT Check in the same Encounter."
    },
    "rankMagnitudes": {
      "I": {
        "score": 1
      },
      "II": {
        "score": 2
      },
      "III": {
        "score": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "INT; WIS"
  },
  {
    "id": "resolve_thread",
    "name": "Resolve Thread",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "necklace",
      "pendant",
      "brooch"
    ],
    "exampleItem": "Resolve Thread Necklace",
    "lore": "Each knot in the cord marks a night the wearer survived without speaking of it.",
    "baseEffect": "Once per Encounter, after direct enemy effects reduce your SP below 25% of Max SP, gain {score} temporary WIS Score until the end of your next Turn.",
    "baseMagnitudes": {
      "score": 1
    },
    "axes": [
      "SP",
      "WIS Score",
      "Ability Score"
    ],
    "limits": "Requires real enemy-origin SP loss across the threshold. No permanent change to class Saves or the Score itself.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Encounter, after direct enemy effects reduce your SP below 25% of Max SP, gain 1 temporary WIS Score until the end of your next Turn.",
      "II": "Once per Encounter, after direct enemy effects reduce your SP below 25% of Max SP, gain 2 temporary WIS Score until the end of your next Turn.",
      "III": "Once per Encounter, after direct enemy effects reduce your SP below 25% of Max SP, gain 3 temporary WIS Score until the end of your next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "score": 1
      },
      "II": {
        "score": 2
      },
      "III": {
        "score": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "SP; WIS"
  },
  {
    "id": "vanguard_s_script",
    "name": "Vanguard's Script",
    "school": "Runic",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "rapier",
      "spear",
      "scimitar"
    ],
    "exampleItem": "Vanguard's Script Longsword",
    "lore": "The runes brighten only when the wielder finds an opening that momentum itself failed to notice.",
    "baseEffect": "Once per Turn, after a weapon-linked Hit against an enemy with lower Speed than the wielder, gain {offense} Offensive Level Up for your next weapon-linked Skill before Turn End.",
    "baseMagnitudes": {
      "offense": 1
    },
    "axes": [
      "Offensive Level",
      "Speed",
      "Attack"
    ],
    "limits": "Only the next Skill is enhanced, never the triggering Hit. No direct Base Power, Final Power or Clash Power bonuses.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Turn, after a weapon-linked Hit against an enemy with lower Speed than the wielder, gain 1 Offensive Level Up for your next weapon-linked Skill before Turn End.",
      "II": "Once per Turn, after a weapon-linked Hit against an enemy with lower Speed than the wielder, gain 2 Offensive Level Up for your next weapon-linked Skill before Turn End.",
      "III": "Once per Turn, after a weapon-linked Hit against an enemy with lower Speed than the wielder, gain 3 Offensive Level Up for your next weapon-linked Skill before Turn End."
    },
    "rankMagnitudes": {
      "I": {
        "offense": 1
      },
      "II": {
        "offense": 2
      },
      "III": {
        "offense": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Offensive Level"
  },
  {
    "id": "sentinel_s_inscription",
    "name": "Sentinel's Inscription",
    "school": "Runic",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_round",
      "shield_heater",
      "shield_tower"
    ],
    "exampleItem": "Sentinel's Inscription Heater Shield",
    "lore": "The shield refuses to reward its wielder for hiding. It answers only a blow truly held back.",
    "baseEffect": "Once per Turn, after a Guard with this shield prevents direct enemy damage, gain {defense} Defensive Level Up during your next Turn.",
    "baseMagnitudes": {
      "defense": 1
    },
    "axes": [
      "Defensive Level",
      "Guard",
      "Status"
    ],
    "limits": "The Guard must prevent positive damage. Does not retroactively improve the Guard and does not provide permanent Level progression.",
    "items": [
      "Shield"
    ],
    "tiers": {
      "I": "Once per Turn, after a Guard with this shield prevents direct enemy damage, gain 1 Defensive Level Up during your next Turn.",
      "II": "Once per Turn, after a Guard with this shield prevents direct enemy damage, gain 2 Defensive Level Up during your next Turn.",
      "III": "Once per Turn, after a Guard with this shield prevents direct enemy damage, gain 3 Defensive Level Up during your next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "defense": 1
      },
      "II": {
        "defense": 2
      },
      "III": {
        "defense": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Defensive Level"
  },
  {
    "id": "quickglyph",
    "name": "Quickglyph",
    "school": "Runic",
    "kind": "accessory",
    "allowedChassisIds": [
      "anklet",
      "bracelet",
      "earrings"
    ],
    "exampleItem": "Quickglyph Anklet",
    "lore": "The sigil writes a moment of future momentum beneath the wearer's skin.",
    "baseEffect": "Once per Turn, after your Attack Skill Hits an enemy with higher Speed than yours, gain {haste} Haste during your next Turn.",
    "baseMagnitudes": {
      "haste": 1
    },
    "axes": [
      "Speed",
      "Haste",
      "Attack"
    ],
    "limits": "The target must be faster before the Hit, and Haste cannot create new Action Slots.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Turn, after your Attack Skill Hits an enemy with higher Speed than yours, gain 1 Haste during your next Turn.",
      "II": "Once per Turn, after your Attack Skill Hits an enemy with higher Speed than yours, gain 2 Haste during your next Turn.",
      "III": "Once per Turn, after your Attack Skill Hits an enemy with higher Speed than yours, gain 3 Haste during your next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "haste": 1
      },
      "II": {
        "haste": 2
      },
      "III": {
        "haste": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "Haste"
  },
  {
    "id": "titan_s_testament",
    "name": "Titan's Testament",
    "school": "Runic",
    "kind": "weapon",
    "allowedChassisIds": [
      "maul",
      "warhammer",
      "greataxe"
    ],
    "exampleItem": "Titan's Testament Maul",
    "lore": "The weapon's name is a challenge to giants, and it begins to answer only when something stronger stands against it.",
    "baseEffect": "Once per Encounter, after winning a Clash against a target with a larger Size category, gain {score} temporary STR Score until Turn End.",
    "baseMagnitudes": {
      "score": 1
    },
    "axes": [
      "STR Score",
      "Ability Score",
      "Clash"
    ],
    "limits": "No score change if the target is not larger. Never modifies the completed Clash or applies permanently to inventory capacity.",
    "items": [
      "Weapon"
    ],
    "tiers": {
      "I": "Once per Encounter, after winning a Clash against a target with a larger Size category, gain 1 temporary STR Score until Turn End.",
      "II": "Once per Encounter, after winning a Clash against a target with a larger Size category, gain 2 temporary STR Score until Turn End.",
      "III": "Once per Encounter, after winning a Clash against a target with a larger Size category, gain 3 temporary STR Score until Turn End."
    },
    "rankMagnitudes": {
      "I": {
        "score": 1
      },
      "II": {
        "score": 2
      },
      "III": {
        "score": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "STR"
  },
  {
    "id": "foxfire_loom",
    "name": "Foxfire Loom",
    "school": "Runic",
    "kind": "armor",
    "allowedChassisIds": [
      "padded_armor",
      "leather_armor",
      "hide_armor"
    ],
    "exampleItem": "Foxfire Loom Leather Armor",
    "lore": "A hundred foxes are stitched into the lining, each waiting to borrow the wearer's skin for one flawless escape.",
    "baseEffect": "Once per Turn, after a successful Evade against a direct enemy attack, gain {score} temporary DEX Score until the end of your next Turn.",
    "baseMagnitudes": {
      "score": 1
    },
    "axes": [
      "DEX Score",
      "Ability Score",
      "Evade"
    ],
    "limits": "Cannot retroactively improve the successful Evade. Other derived stats recalculate only through an approved temporary Score pipeline.",
    "items": [
      "Armor"
    ],
    "tiers": {
      "I": "Once per Turn, after a successful Evade against a direct enemy attack, gain 1 temporary DEX Score until the end of your next Turn.",
      "II": "Once per Turn, after a successful Evade against a direct enemy attack, gain 2 temporary DEX Score until the end of your next Turn.",
      "III": "Once per Turn, after a successful Evade against a direct enemy attack, gain 3 temporary DEX Score until the end of your next Turn."
    },
    "rankMagnitudes": {
      "I": {
        "score": 1
      },
      "II": {
        "score": 2
      },
      "III": {
        "score": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "DEX"
  },
  {
    "id": "sovereign_s_echo",
    "name": "Sovereign's Echo",
    "school": "Runic",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "pendant",
      "brooch"
    ],
    "exampleItem": "Sovereign's Echo Ring",
    "lore": "The seal carries the weight of a spoken command, but listens most closely when the bearer resists another's will.",
    "baseEffect": "Once per Encounter, after successfully saving against Charmed or Frightened from an enemy, gain {score} temporary CHA Score until Encounter End or until your next CHA Check, whichever comes first.",
    "baseMagnitudes": {
      "score": 1
    },
    "axes": [
      "CHA Score",
      "Ability Score",
      "Save"
    ],
    "limits": "Does not block the triggering Status without the successful Save. No automatic social-check success or permanent score increase.",
    "items": [
      "Accessory"
    ],
    "tiers": {
      "I": "Once per Encounter, after successfully saving against Charmed or Frightened from an enemy, gain 1 temporary CHA Score until Encounter End or until your next CHA Check, whichever comes first.",
      "II": "Once per Encounter, after successfully saving against Charmed or Frightened from an enemy, gain 2 temporary CHA Score until Encounter End or until your next CHA Check, whichever comes first.",
      "III": "Once per Encounter, after successfully saving against Charmed or Frightened from an enemy, gain 3 temporary CHA Score until Encounter End or until your next CHA Check, whichever comes first."
    },
    "rankMagnitudes": {
      "I": {
        "score": 1
      },
      "II": {
        "score": 2
      },
      "III": {
        "score": 3
      }
    },
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "statuses": "CHA"
  }
];
const ENCHANTMENTS=Object.freeze([...BASE.ENCHANTMENTS,...ADDITIONS]);
const SCHOOLS=Object.freeze([...BASE.SCHOOLS,...new Set(ADDITIONS.map(e=>e.school).filter(s=>!BASE.SCHOOLS.includes(s)))]);
const normalize=(v)=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const eligible=(id,item)=>{const e=ENCHANTMENTS.find(x=>x.id===normalize(id));if(!e||!item)return false;const kind=normalize(item.itemType||item.equipment?.kind||item.kind||item.category);const chassis=normalize(item.chassisId||item.weaponId||item.baseWeaponId||item.definitionId);return kind===e.kind&&!!chassis&&e.allowedChassisIds.includes(chassis);};
const API=Object.freeze({version:"review-v4",approved:false,gameplayEnabled:false,RANK_MULTIPLIERS:BASE.RANK_MULTIPLIERS,ENCHANTMENTS,SCHOOLS,scale:BASE.scale,eligible,BASE_COUNT:BASE.ENCHANTMENTS.length,EXPANSION_COUNT:ADDITIONS.length});
global.LuminousEnchantmentDesignReview=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
