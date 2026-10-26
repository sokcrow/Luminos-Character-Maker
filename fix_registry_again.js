const fs = require('fs');
let content = fs.readFileSync('js/statusManager.js', 'utf8');

// I need to completely rebuild statusManager.js to ensure all statuses are perfect according to their descriptions.

content = content.replace(
    /name: 'Burn',.*?\],/s,
    "name: 'Burn', type: 'negative', mode: 'double', icon: 'https://imgur.com/L4bRd44.png',\n        rules: [{trigger: 'on_round_end', cond_input: 1, cond_type: 'potency', operation: 'sub', aff_input: 1, affectation: 'hp', decay: 'sub_count_1'}],"
);

content = content.replace(
    /name: 'Bleed',.*?\],/s,
    "name: 'Bleed', type: 'negative', mode: 'double', icon: 'https://imgur.com/mp9fbme.png',\n        rules: [{trigger: 'on_coin_flip', cond_input: 1, cond_type: 'potency', operation: 'sub', aff_input: 1, affectation: 'hp', decay: 'sub_count_1'}],"
);

content = content.replace(
    /name: 'Tremor', type: 'negative', mode: 'double', icon: 'https:\/\/imgur\.com\/fuDGjpn\.png',\n.*?\],/s,
    "name: 'Tremor', type: 'negative', mode: 'double', icon: 'https://imgur.com/fuDGjpn.png',\n        rules: [{trigger: 'on_tremor_burst', cond_input: 1, cond_type: 'potency', operation: 'add', aff_input: 1, affectation: 'stagger_threshold', decay: 'sub_count_1'}],"
);

content = content.replace(
    /name: 'Tremor - Decay',.*?\],/s,
    "name: 'Tremor - Decay', type: 'negative', mode: 'double',\n        rules: [{trigger: 'on_tremor_burst', cond_input: 1, cond_type: 'potency', operation: 'add', aff_input: 1, affectation: 'stagger_threshold', decay: 'sub_count_1'}, {trigger: 'passive', cond_input: 4, cond_type: 'potency', operation: 'sub', aff_input: 1, affectation: 'defensive_level', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'sub_count_1'}],"
);

content = content.replace(
    /name: 'Tremor - Fracture',.*?\],/s,
    "name: 'Tremor - Fracture', type: 'negative', mode: 'double',\n        rules: [{trigger: 'on_tremor_burst', cond_input: 1, cond_type: 'potency', operation: 'add', aff_input: 1, affectation: 'stagger_threshold', decay: 'sub_count_1'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'sub_count_1'}],"
);

content = content.replace(
    /name: 'Tremor - Reverb',.*?\],/s,
    "name: 'Tremor - Reverb', type: 'negative', mode: 'double',\n        rules: [{trigger: 'on_tremor_burst', cond_input: 1, cond_type: 'potency', operation: 'add', aff_input: 1, affectation: 'stagger_threshold', decay: 'sub_count_1'}, {trigger: 'on_tremor_burst', cond_input: 1, cond_type: 'potency', operation: 'sub', aff_input: 1, affectation: 'hp', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'sub_count_1'}],"
);

content = content.replace(
    /name: 'Rupture',.*?\],/s,
    "name: 'Rupture', type: 'negative', mode: 'double', icon: 'https://imgur.com/Qc2jQ67.png',\n        rules: [{trigger: 'getting_hit', cond_input: 1, cond_type: 'potency', operation: 'sub', aff_input: 1, affectation: 'hp', decay: 'sub_count_1'}],"
);

content = content.replace(
    /name: 'Sinking',.*?\],/s,
    "name: 'Sinking', type: 'negative', mode: 'double', icon: 'https://imgur.com/ZnulGzZ.png',\n        rules: [{trigger: 'getting_hit', cond_input: 1, cond_type: 'potency', operation: 'sub', aff_input: 1, affectation: 'sp', decay: 'sub_count_1'}],"
);

content = content.replace(
    /name: 'Poise',.*?\],/s,
    "name: 'Poise', type: 'positive', mode: 'double', icon: 'https://imgur.com/KFEmJB5.png',\n        rules: [{trigger: 'on_crit', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'sub_count_1'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'sub_count_1'}],"
);

content = content.replace(
    /name: 'Charge',.*?\],/s,
    "name: 'Charge', type: 'positive', mode: 'double', maxCount: 20, icon: 'https://imgur.com/GzJzNPV.png',\n        rules: [{trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'sub_count_1'}],"
);

// Elemental Up
content = content.replace(
    /name: `\$\{type\} DMG Up`,.*?rules: \[.*?\]/s,
    "name: `${type} DMG Up`,\n            type: 'positive',\n            mode: 'single',\n            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'damage_dealt_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}]"
);
content = content.replace(
    /name: `\$\{type\} Power Up`,.*?rules: \[.*?\]/s,
    "name: `${type} Power Up`,\n            type: 'positive',\n            mode: 'single',\n            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'final_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}]"
);
content = content.replace(
    /name: `\$\{type\} Protection`,.*?rules: \[.*?\]/s,
    "name: `${type} Protection`,\n            type: 'positive',\n            mode: 'single',\n            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'damage_taken_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}]"
);

// Elemental Down
content = content.replace(
    /name: `\$\{type\} DMG Down`,.*?rules: \[.*?\]/s,
    "name: `${type} DMG Down`,\n            type: 'negative',\n            mode: 'single',\n            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'damage_dealt_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}]"
);
content = content.replace(
    /name: `\$\{type\} Power Down`,.*?rules: \[.*?\]/s,
    "name: `${type} Power Down`,\n            type: 'negative',\n            mode: 'single',\n            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'final_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}]"
);
content = content.replace(
    /name: `\$\{type\} Fragility`,.*?rules: \[.*?\]/s,
    "name: `${type} Fragility`,\n            type: 'negative',\n            mode: 'single',\n            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'damage_taken_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}]"
);


// Generic buffs
content = content.replace(
    /name: 'Damage Up',.*?\],/s,
    "name: 'Damage Up', type: 'positive', mode: 'single', maxCount: 10, icon: 'https://imgur.com/KDLYRCR.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'damage_dealt_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Haste',.*?\],/s,
    "name: 'Haste', type: 'positive', mode: 'single', icon: 'https://imgur.com/zxUsYIN.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'speed', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Protection',.*?\],/s,
    "name: 'Protection', type: 'positive', mode: 'single', maxCount: 10, icon: 'https://imgur.com/yjPgnjd.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'damage_taken_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Plus Coin Boost',.*?\],/s,
    "name: 'Plus Coin Boost', type: 'positive', mode: 'single',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'coin_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Minus Coin Drop',.*?\],/s,
    "name: 'Minus Coin Drop', type: 'positive', mode: 'single',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'coin_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Weak-resist DMG Boost',.*?\],/s,
    "name: 'Weak-resist DMG Boost', type: 'positive', mode: 'single',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'damage_dealt_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'HP Healing Boost',.*?\],/s,
    "name: 'HP Healing Boost', type: 'positive', mode: 'single', maxCount: 5, icon: 'https://imgur.com/uynjNTN.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'healing_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'E\.G\.O Resource Amp',.*?\],/s,
    "name: 'E.G.O Resource Amp', type: 'positive', mode: 'single',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'resource', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);

// Generic Debuffs
content = content.replace(
    /name: 'Power Down',.*?\],/s,
    "name: 'Power Down', type: 'negative', mode: 'single',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'final_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Attack Power Down',.*?\],/s,
    "name: 'Attack Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/g69L38F.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'final_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Defense Power Down',.*?\],/s,
    "name: 'Defense Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/MGdXCaC.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'base_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Clash Power Down',.*?\],/s,
    "name: 'Clash Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/TppbWXb.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'clash_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Offense Level Down',.*?\],/s,
    "name: 'Offense Level Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/usBnT9m.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'offensive_level', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Defense Level Down',.*?\],/s,
    "name: 'Defense Level Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/C0apZVL.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'defensive_level', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Damage Down',.*?\],/s,
    "name: 'Damage Down', type: 'negative', mode: 'single', maxCount: 10, icon: 'https://imgur.com/bo7reA0.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'damage_dealt_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Bind',.*?\],/s,
    "name: 'Bind', type: 'negative', mode: 'single', icon: 'https://imgur.com/QndWew8.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'speed', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Fragile',.*?\],/s,
    "name: 'Fragile', type: 'negative', mode: 'single', maxCount: 10, icon: 'https://imgur.com/wSFboZT.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'damage_taken_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Paralyze',.*?\],/s,
    "name: 'Paralyze', type: 'negative', mode: 'single', icon: 'https://imgur.com/9TkO8Ce.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'set', aff_input: 0, affectation: 'coin_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Plus Coin Drop',.*?\],/s,
    "name: 'Plus Coin Drop', type: 'negative', mode: 'single',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'coin_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'Minus Coin Boost',.*?\],/s,
    "name: 'Minus Coin Boost', type: 'negative', mode: 'single',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'coin_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);
content = content.replace(
    /name: 'HP Healing Down',.*?\],/s,
    "name: 'HP Healing Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/5WYFFVt.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'healing_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],"
);

fs.writeFileSync('js/statusManager.js', content, 'utf8');

// Now fix processStatusEffects to allow decay to trigger independent of affectation logic for passive rules
let engine = fs.readFileSync('js/combatEngine.js', 'utf8');

// The issue was: "Since the engine never calls processStatusEffects with the string 'passive', the decay block is never reached."
// This means for buffs/debuffs where we want the buff passively active but decayed on round end, we split the rules:
// - Rule 1: Passive stat mod (no decay)
// - Rule 2: on_round_end dummy rule (empty affectation) with decay.
// I have done this above. We just need to make sure the engine handles empty affectations correctly.
engine = engine.replace(
    /if \(affectation\) \{.*?\}\n\s*\}/s,
    "if (affectation && affectation !== '') {\n                    let actualAffectation = affectation === 'damage_multiplier' ? 'damage_dealt_multiplier' : affectation;\n                    if (actualAffectation === 'hp') {\n                        finalDmg = effectValue;\n                        if (rule.operation === 'sub') {\n                            this.applyDamage(unit, finalDmg, 'efecto_estado');\n                        } else if (rule.operation === 'add') {\n                            unit.hp = Math.min(unit.hp + finalDmg, unit.maxHp || unit.hp);\n                        } else if (rule.operation === 'set') {\n                            unit.hp = Math.min(finalDmg, unit.maxHp || unit.hp);\n                        }\n                    } else if (actualAffectation === 'sp') {\n                        if (rule.operation === 'sub') {\n                            unit.sp = this.limitSP((unit.sp || 0) - effectValue);\n                        } else if (rule.operation === 'add') {\n                            unit.sp = this.limitSP((unit.sp || 0) + effectValue);\n                        } else if (rule.operation === 'set') {\n                            unit.sp = this.limitSP(effectValue);\n                        }\n                    } else if (actualAffectation === 'stagger_threshold') {\n                         if (rule.operation === 'add') {\n                             this.modifyNextStaggerThreshold(unit, effectValue);\n                         } else if (rule.operation === 'sub') {\n                             this.modifyNextStaggerThreshold(unit, -effectValue);\n                         }\n                    } else if (actualAffectation === 'damage_dealt_multiplier' || actualAffectation === 'damage_taken_multiplier' || actualAffectation === 'healing_multiplier' || actualAffectation === 'speed' || actualAffectation === 'resource' || actualAffectation === 'defensive_level' || actualAffectation === 'offensive_level' || actualAffectation === 'clash_power' || actualAffectation === 'coin_power' || actualAffectation === 'base_power' || actualAffectation === 'final_power') {\n                        if (context && typeof context === 'object') {\n                            if (!context.modifiers) context.modifiers = {};\n                            if (!context.modifiers[actualAffectation]) context.modifiers[actualAffectation] = 0;\n                            \n                            if (rule.operation === 'add') context.modifiers[actualAffectation] += effectValue;\n                            if (rule.operation === 'sub') context.modifiers[actualAffectation] -= effectValue;\n                            if (rule.operation === 'mult') context.modifiers[actualAffectation] *= effectValue;\n                            if (rule.operation === 'div' && effectValue !== 0) context.modifiers[actualAffectation] /= effectValue;\n                            if (rule.operation === 'set') context.modifiers[actualAffectation] = effectValue;\n                        }\n                    }\n                }"
);

fs.writeFileSync('js/combatEngine.js', engine, 'utf8');
