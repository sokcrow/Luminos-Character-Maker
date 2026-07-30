const DAMAGE_TYPES = ['Slash', 'Pierce', 'Blunt'];
const SIN_TYPES = ['Wrath', 'Lust', 'Sloth', 'Gluttony', 'Gloom', 'Pride', 'Envy'];

const STATUS_REGISTRY = {
    // --- CORE STATUSES (Efectos Clave) ---
    'burn': {
        name: 'Burn', type: 'negative', mode: 'double', icon: 'https://imgur.com/L4bRd44.png',
        rules: [{trigger: 'on_round_end', cond_input: 1, cond_type: 'potency', operation: 'sub', aff_input: 1, affectation: 'hp', decay: 'sub_count_1'}],
        description: "At the end of the turn, take fixed damage by the effect’s Potency, then reduce its Count by 1."
    },
    'bleed': {
        name: 'Bleed', type: 'negative', mode: 'double', icon: 'https://imgur.com/mp9fbme.png',
        rules: [{trigger: 'on_coin_flip', cond_input: 1, cond_type: 'potency', operation: 'sub', aff_input: 1, affectation: 'hp', decay: 'sub_count_1'}],
        description: "When tossing an attack Coin, take fixed damage by the effect’s Potency. Then, reduce its Count by 1."
    },
    'tremor': {
        name: 'Tremor', type: 'negative', mode: 'double', icon: 'https://imgur.com/fuDGjpn.png',
        rules: [{trigger: 'on_tremor_burst', cond_input: 1, cond_type: 'potency', operation: 'add', aff_input: 1, affectation: 'stagger_threshold', decay: 'sub_count_1'}],
        description: "When hit by an attack, take fixed damage by the effect’s Potency. Then, reduce its Count by 1."
    },
    'sinking': {
        name: 'Sinking', type: 'negative', mode: 'double', icon: 'https://imgur.com/ZnulGzZ.png',
        rules: [{trigger: 'getting_hit', cond_input: 1, cond_type: 'potency', operation: 'sub', aff_input: 1, affectation: 'sp', decay: 'sub_count_1'}],
        description: "When hit by an attack, take fixed SP damage by the effect’s Potency. (Non-SP Units take Gloom damage instead.) Then, reduce its Count by 1."
    },
    'poise': {
        name: 'Poise', type: 'positive', mode: 'double', icon: 'https://imgur.com/KFEmJB5.png',
        rules: [{trigger: 'on_crit', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'sub_count_1'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'sub_count_1'}],
        description: "All skills gain Final Power by the effect's Count for one turn."
    },
    'attack_power_up': {
        name: 'Attack Power Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/JbDs4X0.png',
        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'final_power', decay: 'total_loss'}],
        description: "Attack skills gain Final Power by the effect's Count for one turn."
    },
    'defense_power_up': {
        name: 'Defense Power Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/AkiiCza.png',
        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'base_power', decay: 'total_loss'}],
        description: "Defense skills gain Final Power by the effect's Count for one turn."
    },
    'clash_power_up': {
        name: 'Clash Power Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/Q49TCVN.png',
        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'clash_power', decay: 'total_loss'}],
        description: "Gain Clash Power by the effect's Count for one turn."
    },
    'base_power_up': {
        name: 'Base Power Up', type: 'positive', mode: 'single',
        trigger: 'on_round_end', affectation_vector: 'base_power', decay_rule: 'total_loss_round_end',
        description: "Raise the Base Power of Skills by the effect's Count."
    },
    'offense_level_up': {
        name: 'Offense Level Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/p70Fei4.png',
        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'offensive_level', decay: 'total_loss'}],
        description: "Offense level increases based on the effect's Count for one turn."
    },
    'defense_level_up': {
        name: 'Defense Level Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/C0apZVL.png',
        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'defensive_level', decay: 'total_loss'}],
        description: "Defense Level increases based on the effect's Count for one turn."
    },
    'damage_up': {
        name: 'Damage Up', type: 'positive', mode: 'single', maxCount: 10, icon: 'https://imgur.com/KDLYRCR.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'damage_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Deal 10% more damage with skills based on the effect's Count for one turn. (Max 10)"
    },
    'haste': {
        name: 'Haste', type: 'positive', mode: 'single', icon: 'https://imgur.com/zxUsYIN.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'speed', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Speed increases by the effect's Count for one turn."
    },
    'protection': {
        name: 'Protection', type: 'positive', mode: 'single', maxCount: 10, icon: 'https://imgur.com/yjPgnjd.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'damage_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Take 10% less damage per Count from attacks for one turn. (Max 10)"
    },
    'plus_coin_boost': {
        name: 'Plus Coin Boost', type: 'positive', mode: 'single',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'coin_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Raise the Power of Plus Coins by the effect's Count for one turn."
    },
    'minus_coin_drop': {
        name: 'Minus Coin Drop', type: 'positive', mode: 'single',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'coin_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Reduce the Power of Minus Coins by the effect's Count for one turn."
    },
    'weak_resist_dmg_boost': {
        name: 'Weak-resist DMG Boost', type: 'positive', mode: 'single',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'damage_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Boost the damage of attacks against Weak resistances by 1% per Count for one turn."
    },
    'hp_healing_boost': {
        name: 'HP Healing Boost', type: 'positive', mode: 'single', maxCount: 5, icon: 'https://imgur.com/uynjNTN.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'healing_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Increases HP healing provided by Passive abilities, Skills, and Coin effects by 10% per Count. (Max 5)"
    },
    'ego_resource_amp': {
        name: 'E.G.O Resource Amp', type: 'positive', mode: 'single',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'resource', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Increases the amount of E.G.O resources earned from skills by the effect's Count for one turn."
    },

    // --- MODIFICADORES NEGATIVOS GENÉRICOS (Other Debuffs) ---
    'power_down': {
        name: 'Power Down', type: 'negative', mode: 'single',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'final_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "All skills lose Final Power by the effect's Count for one turn."
    },
    'attack_power_down': {
        name: 'Attack Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/g69L38F.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'final_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Attack skills lose Final Power by the effect's Count for one turn."
    },
    'defense_power_down': {
        name: 'Defense Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/MGdXCaC.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'base_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Defense skills lose Final Power by the effect's Count for one turn."
    },
    'clash_power_down': {
        name: 'Clash Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/TppbWXb.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'clash_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Lose Clash Power by the effect's Count for one turn."
    },
    'offense_level_down': {
        name: 'Offense Level Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/usBnT9m.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'offensive_level', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Offense level decreases based on the effect's Count for one turn."
    },
    'defense_level_down': {
        name: 'Defense Level Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/C0apZVL.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'defensive_level', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Defense Level decreases based on the effect's Count for one turn."
    },
    'damage_down': {
        name: 'Damage Down', type: 'negative', mode: 'single', maxCount: 10, icon: 'https://imgur.com/bo7reA0.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'damage_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Deal 10% less damage with skills per Count for one turn. (Max 10)"
    },
    'bind': {
        name: 'Bind', type: 'negative', mode: 'single', icon: 'https://imgur.com/QndWew8.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'speed', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Speed decreases by the effect's Count for one turn."
    },
    'fragile': {
        name: 'Fragile', type: 'negative', mode: 'single', maxCount: 10, icon: 'https://imgur.com/wSFboZT.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'damage_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Take 10% more damage from skills per Count for one turn. (Max 10)"
    },
    'paralyze': {
        name: 'Paralyze', type: 'negative', mode: 'single', icon: 'https://imgur.com/9TkO8Ce.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'set', aff_input: 0, affectation: 'coin_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Fix the Power of X Coin(s) to 0 for one turn."
    },
    'plus_coin_drop': {
        name: 'Plus Coin Drop', type: 'negative', mode: 'single',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'coin_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Reduce the Power of Plus Coins by the effect's Count for one turn."
    },
    'minus_coin_boost': {
        name: 'Minus Coin Boost', type: 'negative', mode: 'single',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'coin_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Raise the Power of Minus Coins by the effect's Count for one turn."
    },
    'hp_healing_down': {
        name: 'HP Healing Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/5WYFFVt.png',
        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'healing_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
        description: "Decreases HP healing provided by Passive abilities, Skills, and Coin effects."
    },
    'poison': {
        name: 'Poison', type: 'negative', mode: 'single',
        trigger: 'on_round_end', rules: [{trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'hp', decay: 'sub_count_1'}],
        description: "At the end of the turn, take fixed damage by the Count, then halve the Count."
    },
    'immobilized': {
        name: 'Immobilized', type: 'negative', mode: 'zero',
        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'set', aff_input: 0, affectation: 'base_power', decay: 'total_loss'}],
        description: "Does not act for this turn."
    }
};

const generateElementalStatuses = () => {
    const allTypes = [...DAMAGE_TYPES, ...SIN_TYPES];

    allTypes.forEach(type => {
        const idPrefix = type.toLowerCase();

        STATUS_REGISTRY[`${idPrefix}_dmg_up`] = {
            name: `${type} DMG Up`,
            type: 'positive',
            mode: 'single',
            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'damage_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
            maxCount: 10,
            description: `Deal 10% more damage with ${type} skills per Count for one turn. (Max 10)`
        };

        STATUS_REGISTRY[`${idPrefix}_power_up`] = {
            name: `${type} Power Up`,
            type: 'positive',
            mode: 'single',
            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'final_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
            description: `${type} skills gain final Power by the effect's Count for one turn.`
        };

        STATUS_REGISTRY[`${idPrefix}_protection`] = {
            name: `${type} Protection`,
            type: 'positive',
            mode: 'single',
            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'damage_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
            maxCount: 10,
            description: `Take 10% less damage from ${type} skills per Count for one turn. (Max 10)`
        };

        STATUS_REGISTRY[`${idPrefix}_dmg_down`] = {
            name: `${type} DMG Down`,
            type: 'negative',
            mode: 'single',
            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'damage_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
            maxCount: 10,
            description: `Deal 10% less damage with ${type} skills per Count for one turn. (Max 10)`
        };

        STATUS_REGISTRY[`${idPrefix}_power_down`] = {
            name: `${type} Power Down`,
            type: 'negative',
            mode: 'single',
            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'final_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
            description: `${type} skills lose final Power by the effect's Count for one turn.`
        };

        STATUS_REGISTRY[`${idPrefix}_fragility`] = {
            name: `${type} Fragility`,
            type: 'negative',
            mode: 'single',
            rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'damage_multiplier', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],
            maxCount: 10,
            description: `Take 10% more damage from ${type} skills per Count for one turn. (Max 10)`
        };
    });
};

generateElementalStatuses();

if (typeof window !== 'undefined') {
    window.STATUS_REGISTRY = STATUS_REGISTRY;
}
