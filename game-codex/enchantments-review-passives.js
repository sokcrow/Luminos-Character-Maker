(function(global){
"use strict";
// Volume III: read-only editorial definitions. This file never registers gameplay effects.
const BASE=global.LuminousEnchantmentDesignReview;
if(!BASE||BASE.gameplayEnabled!==false||BASE.ENCHANTMENTS.length!==84)throw new Error("Review Volume II must load before Volume III");
const ADDITIONS=[
  {
    "id": "heartbound",
    "name": "Heartbound",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "pendant",
      "necklace",
      "ring"
    ],
    "exampleItem": "Heartbound Pendant",
    "lore": "The heart's name is carved into a small stone that refuses to forget how many beats remain.",
    "baseEffect": "While this accessory is equipped, increase the wearer's canonical Base Max HP by {percent}%. Recalculate effective Max HP and Stagger Thresholds from the final value.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "HP",
      "Max HP",
      "Passive"
    ],
    "limits": "Base Max HP means the already-derived canonical HP baseline, not current HP or permanent CON. Equipping does not heal; unequipping clamps current HP to effective Max HP. Never compounds from the previous enchanted total.",
    "items": [
      "Accessory"
    ],
    "formatters": {},
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
      "I": "While this accessory is equipped, increase the wearer's canonical Base Max HP by 5%. Recalculate effective Max HP and Stagger Thresholds from the final value.",
      "II": "While this accessory is equipped, increase the wearer's canonical Base Max HP by 8%. Recalculate effective Max HP and Stagger Thresholds from the final value.",
      "III": "While this accessory is equipped, increase the wearer's canonical Base Max HP by 13%. Recalculate effective Max HP and Stagger Thresholds from the final value."
    },
    "statuses": "HP; Max HP; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "bloodroot",
    "name": "Bloodroot",
    "school": "Vital",
    "kind": "armor",
    "allowedChassisIds": [
      "hide_armor",
      "scale_mail",
      "breastplate",
      "half_plate"
    ],
    "exampleItem": "Bloodroot Breastplate",
    "lore": "A vein of amber runs beneath the armor, delivering one stubborn heartbeat after another.",
    "baseEffect": "At Turn Start, if the wearer is alive and below Max HP, recover HP equal to {percent}% of effective Max HP, rounded up to a whole HP point.",
    "baseMagnitudes": {
      "percent": 2
    },
    "axes": [
      "HP",
      "HP Regeneration",
      "Passive"
    ],
    "limits": "Turn Start is the proposed timing. No recovery from 0 HP, no over-healing, no healing loop outside normal Turn Start; the integer HP amount uses Ceil after the rank percentage is computed.",
    "items": [
      "Armor"
    ],
    "formatters": {},
    "rankMagnitudes": {
      "I": {
        "percent": 2
      },
      "II": {
        "percent": 3
      },
      "III": {
        "percent": 5
      }
    },
    "tiers": {
      "I": "At Turn Start, if the wearer is alive and below Max HP, recover HP equal to 2% of effective Max HP, rounded up to a whole HP point.",
      "II": "At Turn Start, if the wearer is alive and below Max HP, recover HP equal to 3% of effective Max HP, rounded up to a whole HP point.",
      "III": "At Turn Start, if the wearer is alive and below Max HP, recover HP equal to 5% of effective Max HP, rounded up to a whole HP point."
    },
    "statuses": "HP; HP Regeneration; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "serenity_well",
    "name": "Serenity Well",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "pendant",
      "necklace",
      "brooch"
    ],
    "exampleItem": "Serenity Well Ring",
    "lore": "In the ring's center, a droplet hangs perfectly still even when the wielder's mind breaks into storm.",
    "baseEffect": "At Turn Start, recover {sp} SP up to the wearer's current maximum SP.",
    "baseMagnitudes": {
      "sp": 2
    },
    "axes": [
      "SP",
      "SP Recovery",
      "Passive"
    ],
    "limits": "Turn Start is the proposed timing; no benefit at full SP, no generation above Max SP, and no activation while unable to receive resource recovery.",
    "items": [
      "Accessory"
    ],
    "formatters": {},
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
    "tiers": {
      "I": "At Turn Start, recover 2 SP up to the wearer's current maximum SP.",
      "II": "At Turn Start, recover 3 SP up to the wearer's current maximum SP.",
      "III": "At Turn Start, recover 5 SP up to the wearer's current maximum SP."
    },
    "statuses": "SP; SP Recovery; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "mindward",
    "name": "Mindward",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "pendant",
      "ring",
      "brooch",
      "hairpin"
    ],
    "exampleItem": "Mindward Brooch",
    "lore": "Every whispered doubt is forced to pass through the inscription before it can touch its bearer.",
    "baseEffect": "When the wearer would lose SP from a non-voluntary loss event, reduce that SP loss by {loss} (minimum final loss 0).",
    "baseMagnitudes": {
      "loss": 1
    },
    "axes": [
      "SP",
      "SP Loss Reduction",
      "Passive"
    ],
    "limits": "Includes enemy-origin direct SP damage and status-caused SP loss. Does not discount voluntarily spent SP costs or grant SP; each actual loss event resolves once, not once per damage subcomponent.",
    "items": [
      "Accessory"
    ],
    "formatters": {},
    "rankMagnitudes": {
      "I": {
        "loss": 1
      },
      "II": {
        "loss": 2
      },
      "III": {
        "loss": 3
      }
    },
    "tiers": {
      "I": "When the wearer would lose SP from a non-voluntary loss event, reduce that SP loss by 1 (minimum final loss 0).",
      "II": "When the wearer would lose SP from a non-voluntary loss event, reduce that SP loss by 2 (minimum final loss 0).",
      "III": "When the wearer would lose SP from a non-voluntary loss event, reduce that SP loss by 3 (minimum final loss 0)."
    },
    "statuses": "SP; SP Loss Reduction; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "ironbark_inscription",
    "name": "Ironbark Inscription",
    "school": "Warding",
    "kind": "armor",
    "allowedChassisIds": [
      "hide_armor",
      "scale_mail",
      "breastplate",
      "half_plate",
      "plate_armor"
    ],
    "exampleItem": "Ironbark Inscription Breastplate",
    "lore": "Beneath the armor's grain a thousand crossed branches turn the edge of each slash toward the earth.",
    "baseEffect": "While this armor is equipped, reduce the incoming Slash damage resistance multiplier by {resistanceHundredths}, applied only to Slash damage.",
    "baseMagnitudes": {
      "resistanceHundredths": 6
    },
    "axes": [
      "Slash",
      "Physical Resistance",
      "Passive"
    ],
    "limits": "Resistance delta is a multiplier subtraction, not flat HP damage reduction. Physical resistance must honor the canonical 0.30 minimum; stacking with another ward of the same axis remains blocked pending approval.",
    "resistance": {
      "scope": "physical",
      "type": "slash"
    },
    "items": [
      "Armor"
    ],
    "formatters": {
      "resistanceHundredths": "hundredths"
    },
    "rankMagnitudes": {
      "I": {
        "resistanceHundredths": 6
      },
      "II": {
        "resistanceHundredths": 9
      },
      "III": {
        "resistanceHundredths": 15
      }
    },
    "tiers": {
      "I": "While this armor is equipped, reduce the incoming Slash damage resistance multiplier by 0.06, applied only to Slash damage.",
      "II": "While this armor is equipped, reduce the incoming Slash damage resistance multiplier by 0.09, applied only to Slash damage.",
      "III": "While this armor is equipped, reduce the incoming Slash damage resistance multiplier by 0.15, applied only to Slash damage."
    },
    "statuses": "Slash; Physical Resistance; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "needlebreaker",
    "name": "Needlebreaker",
    "school": "Warding",
    "kind": "armor",
    "allowedChassisIds": [
      "chain_shirt",
      "chain_mail",
      "splint_armor",
      "plate_armor"
    ],
    "exampleItem": "Needlebreaker Chain Mail",
    "lore": "Each ring bends the path of a needle until the narrowest wound finds no road inward.",
    "baseEffect": "While this armor is equipped, reduce the incoming Pierce damage resistance multiplier by {resistanceHundredths}, applied only to Pierce damage.",
    "baseMagnitudes": {
      "resistanceHundredths": 6
    },
    "axes": [
      "Pierce",
      "Physical Resistance",
      "Passive"
    ],
    "limits": "Not general damage immunity. Canonical physical floor 0.30 applies. Does not change Armor Quality, Durability or Shield Guard.",
    "resistance": {
      "scope": "physical",
      "type": "pierce"
    },
    "items": [
      "Armor"
    ],
    "formatters": {
      "resistanceHundredths": "hundredths"
    },
    "rankMagnitudes": {
      "I": {
        "resistanceHundredths": 6
      },
      "II": {
        "resistanceHundredths": 9
      },
      "III": {
        "resistanceHundredths": 15
      }
    },
    "tiers": {
      "I": "While this armor is equipped, reduce the incoming Pierce damage resistance multiplier by 0.06, applied only to Pierce damage.",
      "II": "While this armor is equipped, reduce the incoming Pierce damage resistance multiplier by 0.09, applied only to Pierce damage.",
      "III": "While this armor is equipped, reduce the incoming Pierce damage resistance multiplier by 0.15, applied only to Pierce damage."
    },
    "statuses": "Pierce; Physical Resistance; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "gravestone_mantle",
    "name": "Gravestone Mantle",
    "school": "Warding",
    "kind": "armor",
    "allowedChassisIds": [
      "padded_armor",
      "hide_armor",
      "half_plate",
      "plate_armor"
    ],
    "exampleItem": "Gravestone Mantle Half Plate",
    "lore": "A grave's patient weight settles over every blow, making the impact remember it has somewhere else to go.",
    "baseEffect": "While this armor is equipped, reduce the incoming Blunt damage resistance multiplier by {resistanceHundredths}, applied only to Blunt damage.",
    "baseMagnitudes": {
      "resistanceHundredths": 6
    },
    "axes": [
      "Blunt",
      "Physical Resistance",
      "Passive"
    ],
    "limits": "Not a block of Stagger, Fixed Damage, or other unrelated damage. Clamp the physical damage multiplier to the canonical minimum.",
    "resistance": {
      "scope": "physical",
      "type": "blunt"
    },
    "items": [
      "Armor"
    ],
    "formatters": {
      "resistanceHundredths": "hundredths"
    },
    "rankMagnitudes": {
      "I": {
        "resistanceHundredths": 6
      },
      "II": {
        "resistanceHundredths": 9
      },
      "III": {
        "resistanceHundredths": 15
      }
    },
    "tiers": {
      "I": "While this armor is equipped, reduce the incoming Blunt damage resistance multiplier by 0.06, applied only to Blunt damage.",
      "II": "While this armor is equipped, reduce the incoming Blunt damage resistance multiplier by 0.09, applied only to Blunt damage.",
      "III": "While this armor is equipped, reduce the incoming Blunt damage resistance multiplier by 0.15, applied only to Blunt damage."
    },
    "statuses": "Blunt; Physical Resistance; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "wrathcinder_aegis",
    "name": "Wrathcinder Aegis",
    "school": "Warding",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_round",
      "shield_heater",
      "shield_tower"
    ],
    "exampleItem": "Wrathcinder Aegis Heater Shield",
    "lore": "Flame-drawn letters flare against the shield as fury turns aside from its intended home.",
    "baseEffect": "While this shield is equipped and its ward is active, reduce the incoming Wrath SIN damage resistance multiplier by {resistanceHundredths}, affecting Wrath damage only.",
    "baseMagnitudes": {
      "resistanceHundredths": 6
    },
    "axes": [
      "Wrath",
      "SIN Resistance",
      "Passive"
    ],
    "limits": "Only Wrath affinity. Does not reduce all Fire damage unless the authoritative combat hit is actually assigned Wrath; SIN multiplier hook requires separate integration.",
    "resistance": {
      "scope": "sin",
      "type": "wrath"
    },
    "items": [
      "Shield"
    ],
    "formatters": {
      "resistanceHundredths": "hundredths"
    },
    "rankMagnitudes": {
      "I": {
        "resistanceHundredths": 6
      },
      "II": {
        "resistanceHundredths": 9
      },
      "III": {
        "resistanceHundredths": 15
      }
    },
    "tiers": {
      "I": "While this shield is equipped and its ward is active, reduce the incoming Wrath SIN damage resistance multiplier by 0.06, affecting Wrath damage only.",
      "II": "While this shield is equipped and its ward is active, reduce the incoming Wrath SIN damage resistance multiplier by 0.09, affecting Wrath damage only.",
      "III": "While this shield is equipped and its ward is active, reduce the incoming Wrath SIN damage resistance multiplier by 0.15, affecting Wrath damage only."
    },
    "statuses": "Wrath; SIN Resistance; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "roseglass_vow",
    "name": "Roseglass Vow",
    "school": "Warding",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "brooch",
      "pendant"
    ],
    "exampleItem": "Roseglass Vow Brooch",
    "lore": "The rose under the glass has never wilted; it keeps desire from becoming a blade.",
    "baseEffect": "While this accessory is equipped, reduce the incoming Lust SIN damage resistance multiplier by {resistanceHundredths}, affecting Lust damage only.",
    "baseMagnitudes": {
      "resistanceHundredths": 6
    },
    "axes": [
      "Lust",
      "SIN Resistance",
      "Passive"
    ],
    "limits": "Only actual Lust-affinity damage; does not block Charmed or other mental conditions. SIN resistance application requires approved engine integration.",
    "resistance": {
      "scope": "sin",
      "type": "lust"
    },
    "items": [
      "Accessory"
    ],
    "formatters": {
      "resistanceHundredths": "hundredths"
    },
    "rankMagnitudes": {
      "I": {
        "resistanceHundredths": 6
      },
      "II": {
        "resistanceHundredths": 9
      },
      "III": {
        "resistanceHundredths": 15
      }
    },
    "tiers": {
      "I": "While this accessory is equipped, reduce the incoming Lust SIN damage resistance multiplier by 0.06, affecting Lust damage only.",
      "II": "While this accessory is equipped, reduce the incoming Lust SIN damage resistance multiplier by 0.09, affecting Lust damage only.",
      "III": "While this accessory is equipped, reduce the incoming Lust SIN damage resistance multiplier by 0.15, affecting Lust damage only."
    },
    "statuses": "Lust; SIN Resistance; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "hourglass_sanctuary",
    "name": "Hourglass Sanctuary",
    "school": "Warding",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_buckler",
      "shield_round",
      "shield_heater"
    ],
    "exampleItem": "Hourglass Sanctuary Round Shield",
    "lore": "The sand inside the ward falls sideways whenever the world attempts to drag its bearer down.",
    "baseEffect": "While this shield is equipped and its ward is active, reduce the incoming Sloth SIN damage resistance multiplier by {resistanceHundredths}, affecting Sloth damage only.",
    "baseMagnitudes": {
      "resistanceHundredths": 6
    },
    "axes": [
      "Sloth",
      "SIN Resistance",
      "Passive"
    ],
    "limits": "Applies to Sloth affinity damage, not loss of actions or Speed. SIN modifiers must be combined in the canonical damage calculation.",
    "resistance": {
      "scope": "sin",
      "type": "sloth"
    },
    "items": [
      "Shield"
    ],
    "formatters": {
      "resistanceHundredths": "hundredths"
    },
    "rankMagnitudes": {
      "I": {
        "resistanceHundredths": 6
      },
      "II": {
        "resistanceHundredths": 9
      },
      "III": {
        "resistanceHundredths": 15
      }
    },
    "tiers": {
      "I": "While this shield is equipped and its ward is active, reduce the incoming Sloth SIN damage resistance multiplier by 0.06, affecting Sloth damage only.",
      "II": "While this shield is equipped and its ward is active, reduce the incoming Sloth SIN damage resistance multiplier by 0.09, affecting Sloth damage only.",
      "III": "While this shield is equipped and its ward is active, reduce the incoming Sloth SIN damage resistance multiplier by 0.15, affecting Sloth damage only."
    },
    "statuses": "Sloth; SIN Resistance; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "verdant_covenant",
    "name": "Verdant Covenant",
    "school": "Warding",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_round",
      "shield_heater",
      "shield_tower"
    ],
    "exampleItem": "Verdant Covenant Tower Shield",
    "lore": "Roots of translucent jade drink the greed of any curse that dares come close.",
    "baseEffect": "While this shield is equipped and its ward is active, reduce the incoming Gluttony SIN damage resistance multiplier by {resistanceHundredths}, affecting Gluttony damage only.",
    "baseMagnitudes": {
      "resistanceHundredths": 6
    },
    "axes": [
      "Gluttony",
      "SIN Resistance",
      "Passive"
    ],
    "limits": "Gluttony SIN only, not universal Poison/Acid defense. Requires the correct SIN tag in the authoritative hit.",
    "resistance": {
      "scope": "sin",
      "type": "gluttony"
    },
    "items": [
      "Shield"
    ],
    "formatters": {
      "resistanceHundredths": "hundredths"
    },
    "rankMagnitudes": {
      "I": {
        "resistanceHundredths": 6
      },
      "II": {
        "resistanceHundredths": 9
      },
      "III": {
        "resistanceHundredths": 15
      }
    },
    "tiers": {
      "I": "While this shield is equipped and its ward is active, reduce the incoming Gluttony SIN damage resistance multiplier by 0.06, affecting Gluttony damage only.",
      "II": "While this shield is equipped and its ward is active, reduce the incoming Gluttony SIN damage resistance multiplier by 0.09, affecting Gluttony damage only.",
      "III": "While this shield is equipped and its ward is active, reduce the incoming Gluttony SIN damage resistance multiplier by 0.15, affecting Gluttony damage only."
    },
    "statuses": "Gluttony; SIN Resistance; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "nocturne_shroud",
    "name": "Nocturne Shroud",
    "school": "Warding",
    "kind": "armor",
    "allowedChassisIds": [
      "padded_armor",
      "leather_armor",
      "hide_armor",
      "chain_shirt"
    ],
    "exampleItem": "Nocturne Shroud Leather Armor",
    "lore": "A strip of midnight is sewn into the garment, swallowing only the grief meant to destroy.",
    "baseEffect": "While this armor is equipped, reduce the incoming Gloom SIN damage resistance multiplier by {resistanceHundredths}, affecting Gloom damage only.",
    "baseMagnitudes": {
      "resistanceHundredths": 6
    },
    "axes": [
      "Gloom",
      "SIN Resistance",
      "Passive"
    ],
    "limits": "Does not reduce Sinking SP damage unless combat classifies that damage under the Gloom affinity multiplier. No interaction with permanent despair.",
    "resistance": {
      "scope": "sin",
      "type": "gloom"
    },
    "items": [
      "Armor"
    ],
    "formatters": {
      "resistanceHundredths": "hundredths"
    },
    "rankMagnitudes": {
      "I": {
        "resistanceHundredths": 6
      },
      "II": {
        "resistanceHundredths": 9
      },
      "III": {
        "resistanceHundredths": 15
      }
    },
    "tiers": {
      "I": "While this armor is equipped, reduce the incoming Gloom SIN damage resistance multiplier by 0.06, affecting Gloom damage only.",
      "II": "While this armor is equipped, reduce the incoming Gloom SIN damage resistance multiplier by 0.09, affecting Gloom damage only.",
      "III": "While this armor is equipped, reduce the incoming Gloom SIN damage resistance multiplier by 0.15, affecting Gloom damage only."
    },
    "statuses": "Gloom; SIN Resistance; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "crown_of_humility",
    "name": "Crown of Humility",
    "school": "Warding",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "brooch",
      "pendant"
    ],
    "exampleItem": "Crown of Humility Pendant",
    "lore": "The crown bears no jewel, and in its absence the world's proudest words lose their edge.",
    "baseEffect": "While this accessory is equipped, reduce the incoming Pride SIN damage resistance multiplier by {resistanceHundredths}, affecting Pride damage only.",
    "baseMagnitudes": {
      "resistanceHundredths": 6
    },
    "axes": [
      "Pride",
      "SIN Resistance",
      "Passive"
    ],
    "limits": "Pride damage only. Does not negate Radiance or remove buffs. Requires SIN-tagged damage handling.",
    "resistance": {
      "scope": "sin",
      "type": "pride"
    },
    "items": [
      "Accessory"
    ],
    "formatters": {
      "resistanceHundredths": "hundredths"
    },
    "rankMagnitudes": {
      "I": {
        "resistanceHundredths": 6
      },
      "II": {
        "resistanceHundredths": 9
      },
      "III": {
        "resistanceHundredths": 15
      }
    },
    "tiers": {
      "I": "While this accessory is equipped, reduce the incoming Pride SIN damage resistance multiplier by 0.06, affecting Pride damage only.",
      "II": "While this accessory is equipped, reduce the incoming Pride SIN damage resistance multiplier by 0.09, affecting Pride damage only.",
      "III": "While this accessory is equipped, reduce the incoming Pride SIN damage resistance multiplier by 0.15, affecting Pride damage only."
    },
    "statuses": "Pride; SIN Resistance; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "jealousy_mirror",
    "name": "Jealousy Mirror",
    "school": "Warding",
    "kind": "accessory",
    "allowedChassisIds": [
      "brooch",
      "pendant",
      "ring"
    ],
    "exampleItem": "Jealousy Mirror Ring",
    "lore": "The tiny mirror reflects lightning only when it belongs to someone else.",
    "baseEffect": "While this accessory is equipped, reduce the incoming Envy SIN damage resistance multiplier by {resistanceHundredths}, affecting Envy damage only.",
    "baseMagnitudes": {
      "resistanceHundredths": 6
    },
    "axes": [
      "Envy",
      "SIN Resistance",
      "Passive"
    ],
    "limits": "Envy damage only, not all Shock or Lightning unless canonically tagged as Envy. This is resistance, not damage reflection.",
    "resistance": {
      "scope": "sin",
      "type": "envy"
    },
    "items": [
      "Accessory"
    ],
    "formatters": {
      "resistanceHundredths": "hundredths"
    },
    "rankMagnitudes": {
      "I": {
        "resistanceHundredths": 6
      },
      "II": {
        "resistanceHundredths": 9
      },
      "III": {
        "resistanceHundredths": 15
      }
    },
    "tiers": {
      "I": "While this accessory is equipped, reduce the incoming Envy SIN damage resistance multiplier by 0.06, affecting Envy damage only.",
      "II": "While this accessory is equipped, reduce the incoming Envy SIN damage resistance multiplier by 0.09, affecting Envy damage only.",
      "III": "While this accessory is equipped, reduce the incoming Envy SIN damage resistance multiplier by 0.15, affecting Envy damage only."
    },
    "statuses": "Envy; SIN Resistance; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "soulvault",
    "name": "Soulvault",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "pendant",
      "necklace"
    ],
    "exampleItem": "Soulvault Necklace",
    "lore": "Seven sealed chambers within the pendant guard thoughts the mind has not yet learned how to carry.",
    "baseEffect": "While equipped, increase the wearer's canonical Base Max SP by {percent}%, recomputing effective Max SP without restoring the missing SP.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "SP",
      "Max SP",
      "Passive"
    ],
    "limits": "Additional proposed resource counterpart to Heartbound. Max SP derivation must be verified against character/SP rules; does not permanently change Base Score or heal when equipped.",
    "items": [
      "Accessory"
    ],
    "formatters": {},
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
      "I": "While equipped, increase the wearer's canonical Base Max SP by 5%, recomputing effective Max SP without restoring the missing SP.",
      "II": "While equipped, increase the wearer's canonical Base Max SP by 8%, recomputing effective Max SP without restoring the missing SP.",
      "III": "While equipped, increase the wearer's canonical Base Max SP by 13%, recomputing effective Max SP without restoring the missing SP."
    },
    "statuses": "SP; Max SP; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "mender_s_sigil",
    "name": "Mender's Sigil",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "ring",
      "pendant",
      "brooch"
    ],
    "exampleItem": "Mender's Sigil Ring",
    "lore": "Its gold lines brighten not when the body breaks, but when another hand begins to mend it.",
    "baseEffect": "While equipped, increase the HP healed by a valid healing effect received by the wearer by {percent}%, rounding the final healed HP amount up.",
    "baseMagnitudes": {
      "percent": 5
    },
    "axes": [
      "HP",
      "Healing Received",
      "Passive"
    ],
    "limits": "Healing must already be valid; this does not trigger by itself. No HP beyond Max HP and no repeated boost from the same source; healing-percent interactions await pipeline review.",
    "items": [
      "Accessory"
    ],
    "formatters": {},
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
      "I": "While equipped, increase the HP healed by a valid healing effect received by the wearer by 5%, rounding the final healed HP amount up.",
      "II": "While equipped, increase the HP healed by a valid healing effect received by the wearer by 8%, rounding the final healed HP amount up.",
      "III": "While equipped, increase the HP healed by a valid healing effect received by the wearer by 13%, rounding the final healed HP amount up."
    },
    "statuses": "HP; Healing Received; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "silverstep",
    "name": "Silverstep",
    "school": "Runic",
    "kind": "accessory",
    "allowedChassisIds": [
      "anklet",
      "bracelet",
      "earrings"
    ],
    "exampleItem": "Silverstep Anklet",
    "lore": "A silver footfall is engraved where tomorrow should have been, daring its bearer to arrive early.",
    "baseEffect": "At Encounter Start, gain {haste} Haste for the first Turn of that Encounter.",
    "baseMagnitudes": {
      "haste": 1
    },
    "axes": [
      "Speed",
      "Haste",
      "Passive"
    ],
    "limits": "Haste is restricted to the first Turn. Does not create Action Slots, add Coins, or grant permanent Speed.",
    "items": [
      "Accessory"
    ],
    "formatters": {},
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
    "tiers": {
      "I": "At Encounter Start, gain 1 Haste for the first Turn of that Encounter.",
      "II": "At Encounter Start, gain 2 Haste for the first Turn of that Encounter.",
      "III": "At Encounter Start, gain 3 Haste for the first Turn of that Encounter."
    },
    "statuses": "Speed; Haste; Passive",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "warcall_inscription",
    "name": "Warcall Inscription",
    "school": "Runic",
    "kind": "weapon",
    "allowedChassisIds": [
      "longsword",
      "rapier",
      "spear",
      "warhammer"
    ],
    "exampleItem": "Warcall Inscription Longsword",
    "lore": "The weapon answers the first bell of battle with the certainty of an opening move.",
    "baseEffect": "At Encounter Start, gain {offense} Offensive Level Up for the first Attack Skill sourced from this exact equipped weapon during the first Turn.",
    "baseMagnitudes": {
      "offense": 1
    },
    "axes": [
      "Offensive Level",
      "Passive",
      "Attack"
    ],
    "limits": "Applies only to the first eligible bound weapon Skill. Not Base Power, Final Power or Clash Power; no global improvement to other weapons.",
    "items": [
      "Weapon"
    ],
    "formatters": {},
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
    "tiers": {
      "I": "At Encounter Start, gain 1 Offensive Level Up for the first Attack Skill sourced from this exact equipped weapon during the first Turn.",
      "II": "At Encounter Start, gain 2 Offensive Level Up for the first Attack Skill sourced from this exact equipped weapon during the first Turn.",
      "III": "At Encounter Start, gain 3 Offensive Level Up for the first Attack Skill sourced from this exact equipped weapon during the first Turn."
    },
    "statuses": "Offensive Level; Passive; Attack",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "warden_s_promise",
    "name": "Warden's Promise",
    "school": "Runic",
    "kind": "shield",
    "allowedChassisIds": [
      "shield_round",
      "shield_heater",
      "shield_tower"
    ],
    "exampleItem": "Warden's Promise Tower Shield",
    "lore": "One line on the shield is left unfinished until the first impact proves the bearer stayed.",
    "baseEffect": "At Encounter Start, gain {defense} Defensive Level Up for the first Guard Skill sourced from this shield during the first Turn.",
    "baseMagnitudes": {
      "defense": 1
    },
    "axes": [
      "Defensive Level",
      "Passive",
      "Guard"
    ],
    "limits": "Effect ends when the first Guard is resolved or Turn 1 ends; cannot buff another shield or provide permanent Defensive Level.",
    "items": [
      "Shield"
    ],
    "formatters": {},
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
    "tiers": {
      "I": "At Encounter Start, gain 1 Defensive Level Up for the first Guard Skill sourced from this shield during the first Turn.",
      "II": "At Encounter Start, gain 2 Defensive Level Up for the first Guard Skill sourced from this shield during the first Turn.",
      "III": "At Encounter Start, gain 3 Defensive Level Up for the first Guard Skill sourced from this shield during the first Turn."
    },
    "statuses": "Defensive Level; Passive; Guard",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  },
  {
    "id": "clarity_s_return",
    "name": "Clarity's Return",
    "school": "Vital",
    "kind": "accessory",
    "allowedChassisIds": [
      "pendant",
      "brooch",
      "hairpin"
    ],
    "exampleItem": "Clarity's Return Pendant",
    "lore": "A mirrored thought waits just beyond every spell that attempts to scatter the mind.",
    "baseEffect": "Once per Turn, after successfully passing a Save against an enemy effect that would have caused SP loss, recover {sp} SP.",
    "baseMagnitudes": {
      "sp": 2
    },
    "axes": [
      "SP",
      "SP Recovery",
      "Save"
    ],
    "limits": "Only a successful Save against an actual SP-threatening enemy effect qualifies. No self-created tests, recovery above Max SP, or activation from voluntary SP payment.",
    "items": [
      "Accessory"
    ],
    "formatters": {},
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
    "tiers": {
      "I": "Once per Turn, after successfully passing a Save against an enemy effect that would have caused SP loss, recover 2 SP.",
      "II": "Once per Turn, after successfully passing a Save against an enemy effect that would have caused SP loss, recover 3 SP.",
      "III": "Once per Turn, after successfully passing a Save against an enemy effect that would have caused SP loss, recover 5 SP."
    },
    "statuses": "SP; SP Recovery; Save",
    "scaling": "ceil(baseMagnitude * rankMultiplier)",
    "reviewStatus": "proposed",
    "implementation": "design_only",
    "requiresEngine": true
  }
];
const ENCHANTMENTS=Object.freeze([...BASE.ENCHANTMENTS,...ADDITIONS]);
const SCHOOLS=Object.freeze([...BASE.SCHOOLS,...new Set(ADDITIONS.map(e=>e.school).filter(s=>!BASE.SCHOOLS.includes(s)))]);
const normalize=(v)=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const eligible=(id,item)=>{const e=ENCHANTMENTS.find(x=>x.id===normalize(id));if(!e||!item)return false;const kind=normalize(item.itemType||item.equipment?.kind||item.kind||item.category);const chassis=normalize(item.chassisId||item.weaponId||item.baseWeaponId||item.definitionId);return kind===e.kind&&!!chassis&&e.allowedChassisIds.includes(chassis);};
const API=Object.freeze({version:"review-v5",approved:false,gameplayEnabled:false,RANK_MULTIPLIERS:BASE.RANK_MULTIPLIERS,ENCHANTMENTS,SCHOOLS,scale:BASE.scale,eligible,BASE_COUNT:84,EXPANSION_COUNT:ADDITIONS.length});
global.LuminousEnchantmentDesignReview=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
