(function(global){
"use strict";
// READ-ONLY editorial draft. Part A-D of PR #931 are authoritative. Differences require review; see docs/enchanters-update-proposals-reconciliation.md. Do not register gameplay.
const RANK_MULTIPLIERS=Object.freeze({I:1,II:1.5,III:2.5});
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
      "I": "Once per Turn, when a Skill bound to this weapon hits an enemy already suffering Burn, consume 1 Burn Count to unleash 2 Fixed Damage and inflict 2 Burn Potency / 1 Count.",
      "II": "Once per Turn, when a Skill bound to this weapon hits an enemy already suffering Burn, consume 1 Burn Count to unleash 3 Fixed Damage and inflict 3 Burn Potency / 2 Count.",
      "III": "Once per Turn, when a Skill bound to this weapon hits an enemy already suffering Burn, consume 1 Burn Count to unleash 5 Fixed Damage and inflict 5 Burn Potency / 3 Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Burn; Fixed Damage",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Flamebound Longsword",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "greatsword",
      "rapier",
      "scimitar",
      "shortsword"
    ],
    "baseEffect": "Once per Turn, when a Skill bound to this weapon hits an enemy already suffering Burn, consume 1 Burn Count to unleash {damage} Fixed Damage and inflict {potency} Burn Potency / {count} Count.",
    "baseMagnitudes": {
      "damage": 2,
      "potency": 2,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "damage": 2,
        "potency": 2,
        "count": 1
      },
      "II": {
        "damage": 3,
        "potency": 3,
        "count": 2
      },
      "III": {
        "damage": 5,
        "potency": 5,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "ashwake",
    "name": "Ashwake",
    "school": "Infernal",
    "items": [
      "Shield"
    ],
    "lore": "A black furnace sleeps behind the plating, opening its vents only when its bearer stands against the tide.",
    "tiers": {
      "I": "Once per Turn, after a Guard with this shield prevents enemy damage, the attacker suffers 2 Burn Potency / 1 Count.",
      "II": "Once per Turn, after a Guard with this shield prevents enemy damage, the attacker suffers 3 Burn Potency / 2 Count.",
      "III": "Once per Turn, after a Guard with this shield prevents enemy damage, the attacker suffers 5 Burn Potency / 3 Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Burn; Shield; Guard",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Ashwake Tower Shield",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_round",
      "shield_heater",
      "shield_tower"
    ],
    "baseEffect": "Once per Turn, after a Guard with this shield prevents enemy damage, the attacker suffers {potency} Burn Potency / {count} Count.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 1
      },
      "II": {
        "potency": 3,
        "count": 2
      },
      "III": {
        "potency": 5,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, a weapon-linked Hit against a Burning enemy consumes 1 Burn Count and transfers 2 Burn Potency / 1 Count to one other enemy within valid range.",
      "II": "Once per Turn, a weapon-linked Hit against a Burning enemy consumes 1 Burn Count and transfers 3 Burn Potency / 2 Count to one other enemy within valid range.",
      "III": "Once per Turn, a weapon-linked Hit against a Burning enemy consumes 1 Burn Count and transfers 5 Burn Potency / 3 Count to one other enemy within valid range."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Burn",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Cinder Requiem Rapier",
    "kind": "weapon",
    "allowedChassisIds": [
      "rapier",
      "shortsword",
      "scimitar",
      "dagger"
    ],
    "baseEffect": "Once per Turn, a weapon-linked Hit against a Burning enemy consumes 1 Burn Count and transfers {potency} Burn Potency / {count} Count to one other enemy within valid range.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 1
      },
      "II": {
        "potency": 3,
        "count": 2
      },
      "III": {
        "potency": 5,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "emberheart",
    "name": "Emberheart",
    "school": "Infernal",
    "items": [
      "Armor"
    ],
    "lore": "There is no warmth in the gem until the wearer has suffered for someone else.",
    "tiers": {
      "I": "Once per Turn, direct enemy damage to your HP stores one Ember (maximum 2). At next Turn Start, consume the stored Ember to gain 4 temporary Shield per charge.",
      "II": "Once per Turn, direct enemy damage to your HP stores one Ember (maximum 2). At next Turn Start, consume the stored Ember to gain 6 temporary Shield per charge.",
      "III": "Once per Turn, direct enemy damage to your HP stores one Ember (maximum 2). At next Turn Start, consume the stored Ember to gain 10 temporary Shield per charge."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Emberheart Breastplate",
    "kind": "armor",
    "allowedChassisIds": [
      "breastplate",
      "half_plate",
      "chain_mail",
      "plate_armor"
    ],
    "baseEffect": "Once per Turn, direct enemy damage to your HP stores one Ember (maximum 2). At next Turn Start, consume the stored Ember to gain {shield} temporary Shield per charge.",
    "baseMagnitudes": {
      "shield": 4
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "scorchweave",
    "name": "Scorchweave",
    "school": "Infernal",
    "items": [
      "Accessory"
    ],
    "lore": "The cloth weighs nothing, yet smoke coils behind every motion its owner refuses to finish.",
    "tiers": {
      "I": "Once per Turn, a successful Evade marks the attacker until Turn End; the first Hit from one of your equipped weapons against that marked attacker inflicts 2 Burn Potency / 1 Count and consumes the mark.",
      "II": "Once per Turn, a successful Evade marks the attacker until Turn End; the first Hit from one of your equipped weapons against that marked attacker inflicts 3 Burn Potency / 2 Count and consumes the mark.",
      "III": "Once per Turn, a successful Evade marks the attacker until Turn End; the first Hit from one of your equipped weapons against that marked attacker inflicts 5 Burn Potency / 3 Count and consumes the mark."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Burn; Evade",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Scorchweave Brooch",
    "kind": "accessory",
    "allowedChassisIds": [
      "brooch",
      "bracelet",
      "anklet",
      "pendant"
    ],
    "baseEffect": "Once per Turn, a successful Evade marks the attacker until Turn End; the first Hit from one of your equipped weapons against that marked attacker inflicts {potency} Burn Potency / {count} Count and consumes the mark.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 1
      },
      "II": {
        "potency": 3,
        "count": 2
      },
      "III": {
        "potency": 5,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "After losing a Clash with this weapon, store one Spark (maximum 2). Once per Turn, your next weapon-linked Hit may consume one Spark to inflict 2 Burn Potency / 2 Count.",
      "II": "After losing a Clash with this weapon, store one Spark (maximum 2). Once per Turn, your next weapon-linked Hit may consume one Spark to inflict 3 Burn Potency / 3 Count.",
      "III": "After losing a Clash with this weapon, store one Spark (maximum 2). Once per Turn, your next weapon-linked Hit may consume one Spark to inflict 5 Burn Potency / 5 Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Burn",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Pyrelash Whip",
    "kind": "weapon",
    "allowedChassisIds": [
      "whip",
      "flail",
      "scimitar"
    ],
    "baseEffect": "After losing a Clash with this weapon, store one Spark (maximum 2). Once per Turn, your next weapon-linked Hit may consume one Spark to inflict {potency} Burn Potency / {count} Count.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 2
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, the first weapon-linked Hit inflicts 2 Chill Count; if the target already had Chill before that Hit, also inflict 1 Bind for its next Turn.",
      "II": "Once per Turn, the first weapon-linked Hit inflicts 3 Chill Count; if the target already had Chill before that Hit, also inflict 2 Bind for its next Turn.",
      "III": "Once per Turn, the first weapon-linked Hit inflicts 5 Chill Count; if the target already had Chill before that Hit, also inflict 3 Bind for its next Turn."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Chill; Bind",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Frostwrought Greatsword",
    "kind": "weapon",
    "allowedChassisIds": [
      "greatsword",
      "longsword",
      "greataxe",
      "maul"
    ],
    "baseEffect": "Once per Turn, the first weapon-linked Hit inflicts {chill} Chill Count; if the target already had Chill before that Hit, also inflict {bind} Bind for its next Turn.",
    "baseMagnitudes": {
      "chill": 2,
      "bind": 1
    },
    "rankMagnitudes": {
      "I": {
        "chill": 2,
        "bind": 1
      },
      "II": {
        "chill": 3,
        "bind": 2
      },
      "III": {
        "chill": 5,
        "bind": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 2 Chill Count on that attacker; if it had Chill before missing, gain 3 temporary Shield.",
      "II": "Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 3 Chill Count on that attacker; if it had Chill before missing, gain 5 temporary Shield.",
      "III": "Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 5 Chill Count on that attacker; if it had Chill before missing, gain 8 temporary Shield."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Chill; Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Whiteout Leather Armor",
    "kind": "armor",
    "allowedChassisIds": [
      "padded_armor",
      "leather_armor",
      "hide_armor",
      "chain_shirt"
    ],
    "baseEffect": "Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict {chill} Chill Count on that attacker; if it had Chill before missing, gain {shield} temporary Shield.",
    "baseMagnitudes": {
      "chill": 2,
      "shield": 3
    },
    "rankMagnitudes": {
      "I": {
        "chill": 2,
        "shield": 3
      },
      "II": {
        "chill": 3,
        "shield": 5
      },
      "III": {
        "chill": 5,
        "shield": 8
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "permafrost",
    "name": "Permafrost",
    "school": "Glacial",
    "items": [
      "Shield"
    ],
    "lore": "A sealed glacier is layered into the metal; what it cannot stop it refuses to release.",
    "tiers": {
      "I": "Once per Turn, after this shield successfully prevents direct damage through Guard, store up to 4 prevented damage. At next Turn Start convert the stored damage into equal temporary Shield and clear it.",
      "II": "Once per Turn, after this shield successfully prevents direct damage through Guard, store up to 6 prevented damage. At next Turn Start convert the stored damage into equal temporary Shield and clear it.",
      "III": "Once per Turn, after this shield successfully prevents direct damage through Guard, store up to 10 prevented damage. At next Turn Start convert the stored damage into equal temporary Shield and clear it."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Shield; Guard",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Permafrost Tower Shield",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_round",
      "shield_heater",
      "shield_tower"
    ],
    "baseEffect": "Once per Turn, after this shield successfully prevents direct damage through Guard, store up to {memory} prevented damage. At next Turn Start convert the stored damage into equal temporary Shield and clear it.",
    "baseMagnitudes": {
      "memory": 4
    },
    "rankMagnitudes": {
      "I": {
        "memory": 4
      },
      "II": {
        "memory": 6
      },
      "III": {
        "memory": 10
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, a weapon-linked Hit on a Chilled target consumes 1 Chill Count to inflict 2 Rupture Potency / 1 Count.",
      "II": "Once per Turn, a weapon-linked Hit on a Chilled target consumes 1 Chill Count to inflict 3 Rupture Potency / 2 Count.",
      "III": "Once per Turn, a weapon-linked Hit on a Chilled target consumes 1 Chill Count to inflict 5 Rupture Potency / 3 Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Rupture; Chill",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Rimeglass Dagger",
    "kind": "weapon",
    "allowedChassisIds": [
      "dagger",
      "rapier",
      "shortsword"
    ],
    "baseEffect": "Once per Turn, a weapon-linked Hit on a Chilled target consumes 1 Chill Count to inflict {potency} Rupture Potency / {count} Count.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 1
      },
      "II": {
        "potency": 3,
        "count": 2
      },
      "III": {
        "potency": 5,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "winter_s_grasp",
    "name": "Winter's Grasp",
    "school": "Glacial",
    "items": [
      "Weapon"
    ],
    "lore": "The runes do not bind flesh. They slow the decision that precedes escape.",
    "tiers": {
      "I": "Once per Turn, when this weapon hits an enemy with greater Speed than the wielder, inflict 1 Bind for its next Turn and 2 Chill Count.",
      "II": "Once per Turn, when this weapon hits an enemy with greater Speed than the wielder, inflict 2 Bind for its next Turn and 3 Chill Count.",
      "III": "Once per Turn, when this weapon hits an enemy with greater Speed than the wielder, inflict 3 Bind for its next Turn and 5 Chill Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Chill; Bind",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Winter's Grasp Spear",
    "kind": "weapon",
    "allowedChassisIds": [
      "spear",
      "pike",
      "lance",
      "trident"
    ],
    "baseEffect": "Once per Turn, when this weapon hits an enemy with greater Speed than the wielder, inflict {bind} Bind for its next Turn and {chill} Chill Count.",
    "baseMagnitudes": {
      "bind": 1,
      "chill": 2
    },
    "rankMagnitudes": {
      "I": {
        "bind": 1,
        "chill": 2
      },
      "II": {
        "bind": 2,
        "chill": 3
      },
      "III": {
        "bind": 3,
        "chill": 5
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, a successful Evade grants 1 Haste next Turn; if the attacker already had Chill, extend that attacker's Chill Count by 2.",
      "II": "Once per Turn, a successful Evade grants 2 Haste next Turn; if the attacker already had Chill, extend that attacker's Chill Count by 3.",
      "III": "Once per Turn, a successful Evade grants 3 Haste next Turn; if the attacker already had Chill, extend that attacker's Chill Count by 5."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Chill; Haste; Evade",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Black Ice Anklet",
    "kind": "accessory",
    "allowedChassisIds": [
      "anklet",
      "bracelet"
    ],
    "baseEffect": "Once per Turn, a successful Evade grants {haste} Haste next Turn; if the attacker already had Chill, extend that attacker's Chill Count by {chill}.",
    "baseMagnitudes": {
      "haste": 1,
      "chill": 2
    },
    "rankMagnitudes": {
      "I": {
        "haste": 1,
        "chill": 2
      },
      "II": {
        "haste": 2,
        "chill": 3
      },
      "III": {
        "haste": 3,
        "chill": 5
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, a weapon-linked Hit inflicts 2 Shock Count. If the target already had Shock before the Hit, move 1 of its Shock Count to one other valid enemy.",
      "II": "Once per Turn, a weapon-linked Hit inflicts 3 Shock Count. If the target already had Shock before the Hit, move 2 of its Shock Count to one other valid enemy.",
      "III": "Once per Turn, a weapon-linked Hit inflicts 5 Shock Count. If the target already had Shock before the Hit, move 3 of its Shock Count to one other valid enemy."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Shock",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Stormwake Scimitar",
    "kind": "weapon",
    "allowedChassisIds": [
      "scimitar",
      "shortsword",
      "longsword",
      "rapier"
    ],
    "baseEffect": "Once per Turn, a weapon-linked Hit inflicts {shock} Shock Count. If the target already had Shock before the Hit, move {transfer} of its Shock Count to one other valid enemy.",
    "baseMagnitudes": {
      "shock": 2,
      "transfer": 1
    },
    "rankMagnitudes": {
      "I": {
        "shock": 2,
        "transfer": 1
      },
      "II": {
        "shock": 3,
        "transfer": 2
      },
      "III": {
        "shock": 5,
        "transfer": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, after winning a Clash with this weapon against a Shocked enemy, the next Hit of that Skill inflicts 2 Tremor Potency / 1 Count.",
      "II": "Once per Turn, after winning a Clash with this weapon against a Shocked enemy, the next Hit of that Skill inflicts 3 Tremor Potency / 2 Count.",
      "III": "Once per Turn, after winning a Clash with this weapon against a Shocked enemy, the next Hit of that Skill inflicts 5 Tremor Potency / 3 Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Tremor",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Thundercall Warhammer",
    "kind": "weapon",
    "allowedChassisIds": [
      "warhammer",
      "maul",
      "mace",
      "morningstar"
    ],
    "baseEffect": "Once per Turn, after winning a Clash with this weapon against a Shocked enemy, the next Hit of that Skill inflicts {potency} Tremor Potency / {count} Count.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 1
      },
      "II": {
        "potency": 3,
        "count": 2
      },
      "III": {
        "potency": 5,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, a successful Guard with this shield inflicts 2 Shock Count on the attacker. When this instance's Shock converts into Paralysis, gain 4 temporary Shield.",
      "II": "Once per Turn, a successful Guard with this shield inflicts 3 Shock Count on the attacker. When this instance's Shock converts into Paralysis, gain 6 temporary Shield.",
      "III": "Once per Turn, a successful Guard with this shield inflicts 5 Shock Count on the attacker. When this instance's Shock converts into Paralysis, gain 10 temporary Shield."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Shock; Paralysis; Shield; Guard",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Stormcage Buckler",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_buckler",
      "shield_round",
      "shield_heater"
    ],
    "baseEffect": "Once per Turn, a successful Guard with this shield inflicts {shock} Shock Count on the attacker. When this instance's Shock converts into Paralysis, gain {shield} temporary Shield.",
    "baseMagnitudes": {
      "shock": 2,
      "shield": 4
    },
    "rankMagnitudes": {
      "I": {
        "shock": 2,
        "shield": 4
      },
      "II": {
        "shock": 3,
        "shield": 6
      },
      "III": {
        "shock": 5,
        "shield": 10
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "static_veil",
    "name": "Static Veil",
    "school": "Tempest",
    "items": [
      "Armor"
    ],
    "lore": "The air catches against the armor, holding every missed strike like a debt unpaid.",
    "tiers": {
      "I": "Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 2 Shock Count on the attacker. If the attacker already had Shock, gain 3 temporary Shield.",
      "II": "Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 3 Shock Count on the attacker. If the attacker already had Shock, gain 5 temporary Shield.",
      "III": "Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 5 Shock Count on the attacker. If the attacker already had Shock, gain 8 temporary Shield."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Shock; Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Static Veil Chain Mail",
    "kind": "armor",
    "allowedChassisIds": [
      "chain_shirt",
      "scale_mail",
      "ring_mail",
      "chain_mail"
    ],
    "baseEffect": "Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict {shock} Shock Count on the attacker. If the attacker already had Shock, gain {shield} temporary Shield.",
    "baseMagnitudes": {
      "shock": 2,
      "shield": 3
    },
    "rankMagnitudes": {
      "I": {
        "shock": 2,
        "shield": 3
      },
      "II": {
        "shock": 3,
        "shield": 5
      },
      "III": {
        "shock": 5,
        "shield": 8
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, after a successful Evade, gain 1 Haste next Turn. If the attacker already had Bind, extend that Bind by 1.",
      "II": "Once per Turn, after a successful Evade, gain 2 Haste next Turn. If the attacker already had Bind, extend that Bind by 2.",
      "III": "Once per Turn, after a successful Evade, gain 3 Haste next Turn. If the attacker already had Bind, extend that Bind by 3."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Bind; Haste; Evade",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Galeheart Bracelet",
    "kind": "accessory",
    "allowedChassisIds": [
      "bracelet",
      "anklet",
      "earrings"
    ],
    "baseEffect": "Once per Turn, after a successful Evade, gain {haste} Haste next Turn. If the attacker already had Bind, extend that Bind by {bind}.",
    "baseMagnitudes": {
      "haste": 1,
      "bind": 1
    },
    "rankMagnitudes": {
      "I": {
        "haste": 1,
        "bind": 1
      },
      "II": {
        "haste": 2,
        "bind": 2
      },
      "III": {
        "haste": 3,
        "bind": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, a weapon-linked Hit against an enemy protected by Shield inflicts 2 Shock Count and deals 3 additional damage to the Shield only.",
      "II": "Once per Turn, a weapon-linked Hit against an enemy protected by Shield inflicts 3 Shock Count and deals 5 additional damage to the Shield only.",
      "III": "Once per Turn, a weapon-linked Hit against an enemy protected by Shield inflicts 5 Shock Count and deals 8 additional damage to the Shield only."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Shock; Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Skybreaker Lance",
    "kind": "weapon",
    "allowedChassisIds": [
      "lance",
      "pike",
      "halberd",
      "spear"
    ],
    "baseEffect": "Once per Turn, a weapon-linked Hit against an enemy protected by Shield inflicts {shock} Shock Count and deals {shieldDamage} additional damage to the Shield only.",
    "baseMagnitudes": {
      "shock": 2,
      "shieldDamage": 3
    },
    "rankMagnitudes": {
      "I": {
        "shock": 2,
        "shieldDamage": 3
      },
      "II": {
        "shock": 3,
        "shieldDamage": 5
      },
      "III": {
        "shock": 5,
        "shieldDamage": 8
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, your first Critical Hit from this weapon inflicts 2 Bleed Potency / 2 Count.",
      "II": "Once per Turn, your first Critical Hit from this weapon inflicts 3 Bleed Potency / 3 Count.",
      "III": "Once per Turn, your first Critical Hit from this weapon inflicts 5 Bleed Potency / 5 Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Bleed; Critical Hit",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Bloodthorn Dagger",
    "kind": "weapon",
    "allowedChassisIds": [
      "dagger",
      "rapier",
      "shortsword"
    ],
    "baseEffect": "Once per Turn, your first Critical Hit from this weapon inflicts {potency} Bleed Potency / {count} Count.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 2
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "At Turn Start, optionally sacrifice 3 HP; this weapon's next Hit during the Turn inflicts 2 Bleed Potency / 2 Count. Once per Turn.",
      "II": "At Turn Start, optionally sacrifice 3 HP; this weapon's next Hit during the Turn inflicts 3 Bleed Potency / 3 Count. Once per Turn.",
      "III": "At Turn Start, optionally sacrifice 3 HP; this weapon's next Hit during the Turn inflicts 5 Bleed Potency / 5 Count. Once per Turn."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Bleed",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Crimson Oath Longsword",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "greatsword",
      "scimitar",
      "rapier"
    ],
    "baseEffect": "At Turn Start, optionally sacrifice 3 HP; this weapon's next Hit during the Turn inflicts {potency} Bleed Potency / {count} Count. Once per Turn.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 2
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, after this weapon hits an enemy already suffering Bleed, restore up to 2 HP, limited by the wearer's missing HP.",
      "II": "Once per Turn, after this weapon hits an enemy already suffering Bleed, restore up to 3 HP, limited by the wearer's missing HP.",
      "III": "Once per Turn, after this weapon hits an enemy already suffering Bleed, restore up to 5 HP, limited by the wearer's missing HP."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Bleed",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Hollow Fang Dagger",
    "kind": "weapon",
    "allowedChassisIds": [
      "dagger",
      "shortsword",
      "sickle"
    ],
    "baseEffect": "Once per Turn, after this weapon hits an enemy already suffering Bleed, restore up to {healing} HP, limited by the wearer's missing HP.",
    "baseMagnitudes": {
      "healing": 2
    },
    "rankMagnitudes": {
      "I": {
        "healing": 2
      },
      "II": {
        "healing": 3
      },
      "III": {
        "healing": 5
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, the first weapon-linked Hit inflicts 2 Rupture Potency / 2 Count. On the third Hit by this weapon against the same enemy during this Encounter, trigger existing Rupture once, consuming its normal Count.",
      "II": "Once per Turn, the first weapon-linked Hit inflicts 3 Rupture Potency / 3 Count. On the third Hit by this weapon against the same enemy during this Encounter, trigger existing Rupture once, consuming its normal Count.",
      "III": "Once per Turn, the first weapon-linked Hit inflicts 5 Rupture Potency / 5 Count. On the third Hit by this weapon against the same enemy during this Encounter, trigger existing Rupture once, consuming its normal Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Rupture",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Ruptureloom Pike",
    "kind": "weapon",
    "allowedChassisIds": [
      "pike",
      "spear",
      "lance",
      "war_pick"
    ],
    "baseEffect": "Once per Turn, the first weapon-linked Hit inflicts {potency} Rupture Potency / {count} Count. On the third Hit by this weapon against the same enemy during this Encounter, trigger existing Rupture once, consuming its normal Count.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 2
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, when direct enemy damage reduces the wearer's HP, gain 2 Poise Potency / 2 Count.",
      "II": "Once per Turn, when direct enemy damage reduces the wearer's HP, gain 3 Poise Potency / 3 Count.",
      "III": "Once per Turn, when direct enemy damage reduces the wearer's HP, gain 5 Poise Potency / 5 Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Poise",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Butcher's Hymn Breastplate",
    "kind": "armor",
    "allowedChassisIds": [
      "breastplate",
      "half_plate",
      "chain_mail",
      "plate_armor"
    ],
    "baseEffect": "Once per Turn, when direct enemy damage reduces the wearer's HP, gain {potency} Poise Potency / {count} Count.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 2
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "The first Hit each Turn by this weapon marks one target until your next Turn End; the next Hit from this same weapon against that target inflicts 2 Bleed Potency / 2 Count and clears the mark.",
      "II": "The first Hit each Turn by this weapon marks one target until your next Turn End; the next Hit from this same weapon against that target inflicts 3 Bleed Potency / 3 Count and clears the mark.",
      "III": "The first Hit each Turn by this weapon marks one target until your next Turn End; the next Hit from this same weapon against that target inflicts 5 Bleed Potency / 5 Count and clears the mark."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Bleed",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Heartseeker Longbow",
    "kind": "weapon",
    "allowedChassisIds": [
      "shortbow",
      "longbow",
      "light_crossbow",
      "heavy_crossbow",
      "hand_crossbow"
    ],
    "baseEffect": "The first Hit each Turn by this weapon marks one target until your next Turn End; the next Hit from this same weapon against that target inflicts {potency} Bleed Potency / {count} Count and clears the mark.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 2
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, the first Hit from this weapon inflicts 2 Sinking Potency / 2 Count; if that Hit drains the target's last positive SP, recover up to 2 SP.",
      "II": "Once per Turn, the first Hit from this weapon inflicts 3 Sinking Potency / 3 Count; if that Hit drains the target's last positive SP, recover up to 3 SP.",
      "III": "Once per Turn, the first Hit from this weapon inflicts 5 Sinking Potency / 5 Count; if that Hit drains the target's last positive SP, recover up to 5 SP."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Sinking; SP",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Gravewhisper Sickle",
    "kind": "weapon",
    "allowedChassisIds": [
      "sickle",
      "glaive",
      "scimitar",
      "war_pick"
    ],
    "baseEffect": "Once per Turn, the first Hit from this weapon inflicts {potency} Sinking Potency / {count} Count; if that Hit drains the target's last positive SP, recover up to {sp} SP.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 2,
      "sp": 2
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 2,
        "sp": 2
      },
      "II": {
        "potency": 3,
        "count": 3,
        "sp": 3
      },
      "III": {
        "potency": 5,
        "count": 5,
        "sp": 5
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "drownsong",
    "name": "Drownsong",
    "school": "Umbral",
    "items": [
      "Accessory"
    ],
    "lore": "The ring sings beneath running water, but only the wearer hears the drowned choir.",
    "tiers": {
      "I": "Once per Turn, after direct enemy effects lower the wearer's SP, inflict 2 Sinking Potency / 1 Count on the responsible enemy.",
      "II": "Once per Turn, after direct enemy effects lower the wearer's SP, inflict 3 Sinking Potency / 2 Count on the responsible enemy.",
      "III": "Once per Turn, after direct enemy effects lower the wearer's SP, inflict 5 Sinking Potency / 3 Count on the responsible enemy."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Sinking; SP",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Drownsong Ring",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "pendant",
      "necklace",
      "brooch"
    ],
    "baseEffect": "Once per Turn, after direct enemy effects lower the wearer's SP, inflict {potency} Sinking Potency / {count} Count on the responsible enemy.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 1
      },
      "II": {
        "potency": 3,
        "count": 2
      },
      "III": {
        "potency": 5,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "nightfall",
    "name": "Nightfall",
    "school": "Umbral",
    "items": [
      "Accessory"
    ],
    "lore": "No torch can settle on its silhouette; every witness remembers a different outline.",
    "tiers": {
      "I": "Once per Turn, after a successful Evade, become Veiled until Turn End. Your next successful Attack Skill against a valid target while Veiled inflicts 2 Sinking Potency / 1 Count and ends Veiled.",
      "II": "Once per Turn, after a successful Evade, become Veiled until Turn End. Your next successful Attack Skill against a valid target while Veiled inflicts 3 Sinking Potency / 2 Count and ends Veiled.",
      "III": "Once per Turn, after a successful Evade, become Veiled until Turn End. Your next successful Attack Skill against a valid target while Veiled inflicts 5 Sinking Potency / 3 Count and ends Veiled."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Sinking; Evade",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Nightfall Pendant",
    "kind": "accessory",
    "allowedChassisIds": [
      "pendant",
      "anklet",
      "brooch"
    ],
    "baseEffect": "Once per Turn, after a successful Evade, become Veiled until Turn End. Your next successful Attack Skill against a valid target while Veiled inflicts {potency} Sinking Potency / {count} Count and ends Veiled.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 1
      },
      "II": {
        "potency": 3,
        "count": 2
      },
      "III": {
        "potency": 5,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, after a Guard with this shield against a melee attacker, inflict 1 Bind for its next Turn. If that attacker Hits the bearer while Bound, gain 4 temporary Shield after taking the damage.",
      "II": "Once per Turn, after a Guard with this shield against a melee attacker, inflict 2 Bind for its next Turn. If that attacker Hits the bearer while Bound, gain 6 temporary Shield after taking the damage.",
      "III": "Once per Turn, after a Guard with this shield against a melee attacker, inflict 3 Bind for its next Turn. If that attacker Hits the bearer while Bound, gain 10 temporary Shield after taking the damage."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Bind; Shield; Guard",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Void Anchor Heater Shield",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_round",
      "shield_heater",
      "shield_tower"
    ],
    "baseEffect": "Once per Turn, after a Guard with this shield against a melee attacker, inflict {bind} Bind for its next Turn. If that attacker Hits the bearer while Bound, gain {shield} temporary Shield after taking the damage.",
    "baseMagnitudes": {
      "bind": 1,
      "shield": 4
    },
    "rankMagnitudes": {
      "I": {
        "bind": 1,
        "shield": 4
      },
      "II": {
        "bind": 2,
        "shield": 6
      },
      "III": {
        "bind": 3,
        "shield": 10
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "eclipsed_crown",
    "name": "Eclipsed Crown",
    "school": "Umbral",
    "items": [
      "Accessory"
    ],
    "lore": "The crown turns whispers into debts, and demands a memory every time it answers.",
    "tiers": {
      "I": "At Turn Start, pay 4 SP to mark one visible enemy until Turn End. Once per Turn, the next successful Attack Skill against that target inflicts 3 Sinking Potency / 1 Count and clears the mark.",
      "II": "At Turn Start, pay 4 SP to mark one visible enemy until Turn End. Once per Turn, the next successful Attack Skill against that target inflicts 5 Sinking Potency / 2 Count and clears the mark.",
      "III": "At Turn Start, pay 4 SP to mark one visible enemy until Turn End. Once per Turn, the next successful Attack Skill against that target inflicts 8 Sinking Potency / 3 Count and clears the mark."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Sinking; SP",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Eclipsed Crown Brooch",
    "kind": "accessory",
    "allowedChassisIds": [
      "brooch",
      "ring",
      "pendant",
      "hairpin"
    ],
    "baseEffect": "At Turn Start, pay 4 SP to mark one visible enemy until Turn End. Once per Turn, the next successful Attack Skill against that target inflicts {potency} Sinking Potency / {count} Count and clears the mark.",
    "baseMagnitudes": {
      "potency": 3,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "potency": 3,
        "count": 1
      },
      "II": {
        "potency": 5,
        "count": 2
      },
      "III": {
        "potency": 8,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "When an ally crosses a Stagger Threshold, gain one Vow (maximum 2; once per Turn). Your next Hit with this weapon may consume one Vow to inflict 2 Sinking Potency / 1 Count and grant that ally 3 temporary Shield.",
      "II": "When an ally crosses a Stagger Threshold, gain one Vow (maximum 2; once per Turn). Your next Hit with this weapon may consume one Vow to inflict 3 Sinking Potency / 2 Count and grant that ally 5 temporary Shield.",
      "III": "When an ally crosses a Stagger Threshold, gain one Vow (maximum 2; once per Turn). Your next Hit with this weapon may consume one Vow to inflict 5 Sinking Potency / 3 Count and grant that ally 8 temporary Shield."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Sinking; Shield; Stagger",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Spectral Covenant Longsword",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "greatsword",
      "rapier",
      "spear"
    ],
    "baseEffect": "When an ally crosses a Stagger Threshold, gain one Vow (maximum 2; once per Turn). Your next Hit with this weapon may consume one Vow to inflict {potency} Sinking Potency / {count} Count and grant that ally {shield} temporary Shield.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 1,
      "shield": 3
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 1,
        "shield": 3
      },
      "II": {
        "potency": 3,
        "count": 2,
        "shield": 5
      },
      "III": {
        "potency": 5,
        "count": 3,
        "shield": 8
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, a Hit from this weapon against a Shielded enemy inflicts 2 Radiance Count; if the Hit breaks that Shield, additionally inflict 1 Radiance Count.",
      "II": "Once per Turn, a Hit from this weapon against a Shielded enemy inflicts 3 Radiance Count; if the Hit breaks that Shield, additionally inflict 2 Radiance Count.",
      "III": "Once per Turn, a Hit from this weapon against a Shielded enemy inflicts 5 Radiance Count; if the Hit breaks that Shield, additionally inflict 3 Radiance Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Radiance; Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Dawnbound Longsword",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "greatsword",
      "rapier",
      "spear"
    ],
    "baseEffect": "Once per Turn, a Hit from this weapon against a Shielded enemy inflicts {radiance} Radiance Count; if the Hit breaks that Shield, additionally inflict {breakBonus} Radiance Count.",
    "baseMagnitudes": {
      "radiance": 2,
      "breakBonus": 1
    },
    "rankMagnitudes": {
      "I": {
        "radiance": 2,
        "breakBonus": 1
      },
      "II": {
        "radiance": 3,
        "breakBonus": 2
      },
      "III": {
        "radiance": 5,
        "breakBonus": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, after legally intercepting direct enemy damage intended for an ally, gain 1 Protection for the next Turn and grant that ally 4 temporary Shield.",
      "II": "Once per Turn, after legally intercepting direct enemy damage intended for an ally, gain 2 Protection for the next Turn and grant that ally 6 temporary Shield.",
      "III": "Once per Turn, after legally intercepting direct enemy damage intended for an ally, gain 3 Protection for the next Turn and grant that ally 10 temporary Shield."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Protection; Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Halo of Ash Breastplate",
    "kind": "armor",
    "allowedChassisIds": [
      "breastplate",
      "half_plate",
      "chain_mail",
      "plate_armor"
    ],
    "baseEffect": "Once per Turn, after legally intercepting direct enemy damage intended for an ally, gain {protection} Protection for the next Turn and grant that ally {shield} temporary Shield.",
    "baseMagnitudes": {
      "protection": 1,
      "shield": 4
    },
    "rankMagnitudes": {
      "I": {
        "protection": 1,
        "shield": 4
      },
      "II": {
        "protection": 2,
        "shield": 6
      },
      "III": {
        "protection": 3,
        "shield": 10
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, when a nearby ally drops below 30% HP after direct enemy damage, spend 4 SP to grant that ally 6 temporary Shield.",
      "II": "Once per Turn, when a nearby ally drops below 30% HP after direct enemy damage, spend 4 SP to grant that ally 9 temporary Shield.",
      "III": "Once per Turn, when a nearby ally drops below 30% HP after direct enemy damage, spend 4 SP to grant that ally 15 temporary Shield."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Shield; SP",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Mercy's Last Light Pendant",
    "kind": "accessory",
    "allowedChassisIds": [
      "pendant",
      "necklace",
      "brooch"
    ],
    "baseEffect": "Once per Turn, when a nearby ally drops below 30% HP after direct enemy damage, spend 4 SP to grant that ally {shield} temporary Shield.",
    "baseMagnitudes": {
      "shield": 6
    },
    "rankMagnitudes": {
      "I": {
        "shield": 6
      },
      "II": {
        "shield": 9
      },
      "III": {
        "shield": 15
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Choose one ally at Encounter Start. Once per Turn, after legally intercepting a direct attack intended for that ally with this shield, gain 4 temporary Shield before receiving the intercepted damage.",
      "II": "Choose one ally at Encounter Start. Once per Turn, after legally intercepting a direct attack intended for that ally with this shield, gain 6 temporary Shield before receiving the intercepted damage.",
      "III": "Choose one ally at Encounter Start. Once per Turn, after legally intercepting a direct attack intended for that ally with this shield, gain 10 temporary Shield before receiving the intercepted damage."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Oathkeeper Tower Shield",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_round",
      "shield_heater",
      "shield_tower"
    ],
    "baseEffect": "Choose one ally at Encounter Start. Once per Turn, after legally intercepting a direct attack intended for that ally with this shield, gain {shield} temporary Shield before receiving the intercepted damage.",
    "baseMagnitudes": {
      "shield": 4
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, when a Hit from this weapon breaks an enemy Shield, inflict 2 Radiance Count on its owner and remove up to 1 removable temporary concealment layers if any exist.",
      "II": "Once per Turn, when a Hit from this weapon breaks an enemy Shield, inflict 3 Radiance Count on its owner and remove up to 2 removable temporary concealment layers if any exist.",
      "III": "Once per Turn, when a Hit from this weapon breaks an enemy Shield, inflict 5 Radiance Count on its owner and remove up to 3 removable temporary concealment layers if any exist."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Radiance; Shield",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Sunpiercer Spear",
    "kind": "weapon",
    "allowedChassisIds": [
      "spear",
      "lance",
      "pike",
      "trident"
    ],
    "baseEffect": "Once per Turn, when a Hit from this weapon breaks an enemy Shield, inflict {radiance} Radiance Count on its owner and remove up to {concealment} removable temporary concealment layers if any exist.",
    "baseMagnitudes": {
      "radiance": 2,
      "concealment": 1
    },
    "rankMagnitudes": {
      "I": {
        "radiance": 2,
        "concealment": 1
      },
      "II": {
        "radiance": 3,
        "concealment": 2
      },
      "III": {
        "radiance": 5,
        "concealment": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "radiant_bastion",
    "name": "Radiant Bastion",
    "school": "Sanctified",
    "items": [
      "Shield"
    ],
    "lore": "The fortress engraved inside the metal is not a place. It is a promise the bearer must keep.",
    "tiers": {
      "I": "Once per Turn, when a Guard with this shield prevents enemy damage, distribute 4 total temporary Shield between up to two nearby allies.",
      "II": "Once per Turn, when a Guard with this shield prevents enemy damage, distribute 6 total temporary Shield between up to two nearby allies.",
      "III": "Once per Turn, when a Guard with this shield prevents enemy damage, distribute 10 total temporary Shield between up to two nearby allies."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Shield; Guard",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Radiant Bastion Heater Shield",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_round",
      "shield_heater",
      "shield_tower"
    ],
    "baseEffect": "Once per Turn, when a Guard with this shield prevents enemy damage, distribute {shield} total temporary Shield between up to two nearby allies.",
    "baseMagnitudes": {
      "shield": 4
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, the first Hit from this weapon inflicts 2 Tremor Potency / 2 Count. After the third Hit against the same enemy in this Encounter, trigger Tremor Burst once if it has Tremor.",
      "II": "Once per Turn, the first Hit from this weapon inflicts 3 Tremor Potency / 3 Count. After the third Hit against the same enemy in this Encounter, trigger Tremor Burst once if it has Tremor.",
      "III": "Once per Turn, the first Hit from this weapon inflicts 5 Tremor Potency / 5 Count. After the third Hit against the same enemy in this Encounter, trigger Tremor Burst once if it has Tremor."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Tremor; Tremor Burst",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Gravemark Warhammer",
    "kind": "weapon",
    "allowedChassisIds": [
      "warhammer",
      "maul",
      "mace",
      "morningstar"
    ],
    "baseEffect": "Once per Turn, the first Hit from this weapon inflicts {potency} Tremor Potency / {count} Count. After the third Hit against the same enemy in this Encounter, trigger Tremor Burst once if it has Tremor.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 2
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "mirrorheart",
    "name": "Mirrorheart",
    "school": "Anomalous",
    "items": [
      "Accessory"
    ],
    "lore": "The surface reflects the wounds it sees rather than the face that wears it.",
    "tiers": {
      "I": "Once per Turn, after an enemy directly Hits you and inflicts Burn, Bleed, or Sinking, record up to 2 Potency / 1 Count of one such Status. Your next successful Attack Skill inflicts the stored Status on its target and empties the mirror.",
      "II": "Once per Turn, after an enemy directly Hits you and inflicts Burn, Bleed, or Sinking, record up to 3 Potency / 2 Count of one such Status. Your next successful Attack Skill inflicts the stored Status on its target and empties the mirror.",
      "III": "Once per Turn, after an enemy directly Hits you and inflicts Burn, Bleed, or Sinking, record up to 5 Potency / 3 Count of one such Status. Your next successful Attack Skill inflicts the stored Status on its target and empties the mirror."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Burn; Bleed; Sinking",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Mirrorheart Pendant",
    "kind": "accessory",
    "allowedChassisIds": [
      "pendant",
      "brooch",
      "ring",
      "necklace"
    ],
    "baseEffect": "Once per Turn, after an enemy directly Hits you and inflicts Burn, Bleed, or Sinking, record up to {potency} Potency / {count} Count of one such Status. Your next successful Attack Skill inflicts the stored Status on its target and empties the mirror.",
    "baseMagnitudes": {
      "potency": 2,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "potency": 2,
        "count": 1
      },
      "II": {
        "potency": 3,
        "count": 2
      },
      "III": {
        "potency": 5,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, the first weapon-linked Hit inflicts 1 Bind for the target's next Turn. If that Bound enemy attacks an ally before Bind expires, it receives 2 Rupture Potency / 1 Count.",
      "II": "Once per Turn, the first weapon-linked Hit inflicts 2 Bind for the target's next Turn. If that Bound enemy attacks an ally before Bind expires, it receives 3 Rupture Potency / 2 Count.",
      "III": "Once per Turn, the first weapon-linked Hit inflicts 3 Bind for the target's next Turn. If that Bound enemy attacks an ally before Bind expires, it receives 5 Rupture Potency / 3 Count."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Rupture; Bind",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Chains of Ruin Whip",
    "kind": "weapon",
    "allowedChassisIds": [
      "whip",
      "flail",
      "glaive"
    ],
    "baseEffect": "Once per Turn, the first weapon-linked Hit inflicts {bind} Bind for the target's next Turn. If that Bound enemy attacks an ally before Bind expires, it receives {potency} Rupture Potency / {count} Count.",
    "baseMagnitudes": {
      "bind": 1,
      "potency": 2,
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "bind": 1,
        "potency": 2,
        "count": 1
      },
      "II": {
        "bind": 2,
        "potency": 3,
        "count": 2
      },
      "III": {
        "bind": 3,
        "potency": 5,
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Encounter, borrow one Quick Action this Turn and lose one Quick Action next Turn as an unavoidable debt. When the debt is paid, gain 4 temporary Shield.",
      "II": "Once per Encounter, borrow one Quick Action this Turn and lose one Quick Action next Turn as an unavoidable debt. When the debt is paid, gain 6 temporary Shield.",
      "III": "Once per Encounter, borrow one Quick Action this Turn and lose one Quick Action next Turn as an unavoidable debt. When the debt is paid, gain 10 temporary Shield."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Shield; Quick Action",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Chronolock Bracelet",
    "kind": "accessory",
    "allowedChassisIds": [
      "bracelet",
      "ring",
      "anklet"
    ],
    "baseEffect": "Once per Encounter, borrow one Quick Action this Turn and lose one Quick Action next Turn as an unavoidable debt. When the debt is paid, gain {shield} temporary Shield.",
    "baseMagnitudes": {
      "shield": 4
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
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
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
      "I": "Once per Turn, when your Guard prevents direct enemy damage while wearing this armor, store up to 4 prevented damage. Your next weapon-linked Hit spends that Memory to deal equal extra Fixed Damage.",
      "II": "Once per Turn, when your Guard prevents direct enemy damage while wearing this armor, store up to 6 prevented damage. Your next weapon-linked Hit spends that Memory to deal equal extra Fixed Damage.",
      "III": "Once per Turn, when your Guard prevents direct enemy damage while wearing this armor, store up to 10 prevented damage. Your next weapon-linked Hit spends that Memory to deal equal extra Fixed Damage."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "Guard; Fixed Damage",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Requiem Coil Breastplate",
    "kind": "armor",
    "allowedChassisIds": [
      "breastplate",
      "half_plate",
      "splint_armor",
      "plate_armor"
    ],
    "baseEffect": "Once per Turn, when your Guard prevents direct enemy damage while wearing this armor, store up to {memory} prevented damage. Your next weapon-linked Hit spends that Memory to deal equal extra Fixed Damage.",
    "baseMagnitudes": {
      "memory": 4
    },
    "rankMagnitudes": {
      "I": {
        "memory": 4
      },
      "II": {
        "memory": 6
      },
      "III": {
        "memory": 10
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  },
  {
    "id": "nullwake",
    "name": "Nullwake",
    "school": "Anomalous",
    "items": [
      "Weapon"
    ],
    "lore": "Everything near the relic becomes momentarily uncertain of the rules that hold it together.",
    "tiers": {
      "I": "Once per Turn, when this weapon Hits an enemy carrying a removable temporary positive Status, remove up to 1 Count from one such Status of your choice.",
      "II": "Once per Turn, when this weapon Hits an enemy carrying a removable temporary positive Status, remove up to 2 Count from one such Status of your choice.",
      "III": "Once per Turn, when this weapon Hits an enemy carrying a removable temporary positive Status, remove up to 3 Count from one such Status of your choice."
    },
    "limits": "Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.",
    "statuses": "conditional combat effect",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true,
    "exampleItem": "Nullwake Dagger",
    "kind": "weapon",
    "allowedChassisIds": [
      "dagger",
      "rapier",
      "shortsword",
      "war_pick"
    ],
    "baseEffect": "Once per Turn, when this weapon Hits an enemy carrying a removable temporary positive Status, remove up to {count} Count from one such Status of your choice.",
    "baseMagnitudes": {
      "count": 1
    },
    "rankMagnitudes": {
      "I": {
        "count": 1
      },
      "II": {
        "count": 2
      },
      "III": {
        "count": 3
      }
    },
    "scaling": "ceil(baseMagnitude * rankMultiplier)"
  }
];
const SCHOOLS=Object.freeze(["Infernal","Glacial","Tempest","Sanguine","Umbral","Sanctified","Anomalous"]);
const normalize=(v)=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const scale=(base,rank)=>Number.isInteger(base)&&base>=0&&Object.prototype.hasOwnProperty.call(RANK_MULTIPLIERS,rank)?Math.ceil(base*RANK_MULTIPLIERS[rank]):null;
// Design-only compatibility preview; fail closed when no authoritative chassis ID exists.
const eligible=(enchantmentId,item)=>{const e=ENCHANTMENTS.find(x=>x.id===normalize(enchantmentId));if(!e||!item||normalize(item.itemType||item.equipment?.kind||item.kind||item.category)!==e.kind)return false;const chassis=normalize(item.chassisId||item.weaponId||item.baseWeaponId||item.definitionId);return chassis!==""&&e.allowedChassisIds.includes(chassis);};
const API=Object.freeze({version:"review-v3",approved:false,gameplayEnabled:false,RANK_MULTIPLIERS,ENCHANTMENTS:Object.freeze(ENCHANTMENTS),SCHOOLS,scale,eligible});
global.LuminousEnchantmentDesignReview=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
