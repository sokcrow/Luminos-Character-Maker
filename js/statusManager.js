const DAMAGE_TYPES = ['Slash', 'Pierce', 'Blunt'];
const SIN_TYPES = ['Wrath', 'Lust', 'Sloth', 'Gluttony', 'Gloom', 'Pride', 'Envy'];

const STATUS_REGISTRY = {
    // --- CORE STATUSES (Efectos Clave) ---
    'burn': {
        name: 'Burn', type: 'negative', mode: 'double', icon: 'https://imgur.com/L4bRd44.png',
        description: "At the end of the turn, take fixed damage by the effect’s Potency, then reduce its Count by 1."
    },
    'bleed': {
        name: 'Bleed', type: 'negative', mode: 'double', icon: 'https://imgur.com/mp9fbme.png',
        description: "When tossing an attack Coin, take fixed damage by the effect’s Potency. Then, reduce its Count by 1."
    },
    'tremor': {
        name: 'Tremor', type: 'negative', mode: 'double', icon: 'https://imgur.com/fuDGjpn.png',
        description: "When attacked by skills that burst Tremor, raise the Stagger Threshold by the effect’s Potency. At the end of the turn, reduce the Count by 1."
    },
    'tremor_decay': {
        name: 'Tremor - Decay', type: 'negative', mode: 'double',
        description: "Lose 1 Defense Level for every 4 Tremor Potency on self. When Hit by Skills that trigger Tremor Burst, raise the Stagger Threshold by the effect's Potency. Turn End: reduce the Count by 1."
    },
    'tremor_fracture': {
        name: 'Tremor - Fracture', type: 'negative', mode: 'double',
        description: "When Staggered, and when the sum of Tremor Potency and Count adds up to 20 or higher, raise Stagger Level by 1. When Hit by Skills that trigger Tremor Burst, raise the Stagger Threshold by the effect's Potency. Turn End: reduce the Count by 1."
    },
    'tremor_reverb': {
        name: 'Tremor - Reverb', type: 'negative', mode: 'double',
        description: "On Tremor Burst, take Sloth damage equal to Tremor Potency on self. When Hit by Skills that trigger Tremor Burst, raise the Stagger Threshold by the effect's Potency. Turn End: reduce the Count by 1."
    },
    'tremor_everlasting': {
        name: 'Tremor - Everlasting', type: 'negative', mode: 'double',
        description: "When hit by Skills or Coin effects that trigger Tremor Burst, (Tremor Potency on self)% chance to trigger an additional Tremor Burst. When hit by Skills or Coin effects that trigger Tremor Burst, (Tremor Count on self)% chance to trigger an additional Tremor Burst. Turn End: reduce the Count by 1."
    },
    'tremor_chain': {
        name: 'Tremor - Chain', type: 'negative', mode: 'double',
        description: "Lose 1 Clash Power for every 10 Tremor Potency on self (max 3). When Hit by Skills that trigger Tremor Burst, raise the Stagger Threshold by the effect's Potency. Turn End: reduce the Count by 1."
    },
    'tremor_scorch': {
        name: 'Tremor - Scorch', type: 'negative', mode: 'double',
        description: "On Tremor Burst, take Wrath Damage equal to (sum of Tremor Potency and Burn Potency / 2), and lose 1 Burn Count. When hit by Skills that trigger Tremor Burst, raise this unit's Stagger Threshold equal by the effect's Potency. Turn End: reduce the Count by 1."
    },
    'tremor_hemorrhage': {
        name: 'Tremor - Hemorrhage', type: 'negative', mode: 'double',
        description: "On Tremor Burst, take Lust Damage equal to (sum of Tremor Potency and Bleed Potency / 2), and lose 1 Bleed Count. When hit by Skills that trigger Tremor Burst, raise this unit's Stagger Threshold by the effect's Potency. Turn End: reduce the Count by 1."
    },
    'tremor_superposition': {
        name: 'Tremor - Superposition', type: 'negative', mode: 'double',
        description: "When triggering Amplitude Conversion, add the effects of the resulting Tremor type to the list of active Tremor effects under Tremor - Superposition."
    },
    'rupture': {
        name: 'Rupture', type: 'negative', mode: 'double', icon: 'https://imgur.com/g5LTeDs.png',
        description: "When hit by an attack, take fixed damage by the effect’s Potency. Then, reduce its Count by 1."
    },
    'sinking': {
        name: 'Sinking', type: 'negative', mode: 'double', icon: 'https://imgur.com/ZnulGzZ.png',
        description: "When hit by an attack, take fixed SP damage by the effect’s Potency. (Non-SP Units take Gloom damage instead.) Then, reduce its Count by 1."
    },
    'poise': {
        name: 'Poise', type: 'positive', mode: 'double', icon: 'https://imgur.com/KFEmJB5.png',
        description: "Gain a chance to deal Critical Damage on hit. Potency increases Critical Chance, Count increases Critical Damage. Count is reduced by 1 at turn end."
    },
    'charge': {
        name: 'Charge', type: 'positive', mode: 'double', maxCount: 20, icon: 'https://imgur.com/GzJzNPV.png',
        description: "Resource used by certain skills for additional effects."
    },

    // --- GENERIC BUFFS (Other Buffs) ---
    'power_up': {
        name: 'Power Up', type: 'positive', mode: 'single',
        description: "All skills gain Final Power by the effect's Count for one turn."
    },
    'attack_power_up': {
        name: 'Attack Power Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/JbDs4X0.png',
        description: "Attack skills gain Final Power by the effect's Count for one turn."
    },
    'defense_power_up': {
        name: 'Defense Power Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/AkiiCza.png',
        description: "Defense skills gain Final Power by the effect's Count for one turn."
    },
    'clash_power_up': {
        name: 'Clash Power Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/Q49TCVN.png',
        description: "Gain Clash Power by the effect's Count for one turn."
    },
    'base_power_up': {
        name: 'Base Power Up', type: 'positive', mode: 'single',
        description: "Raise the Base Power of Skills by the effect's Count."
    },
    'offense_level_up': {
        name: 'Offense Level Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/p70Fei4.png',
        description: "Offense level increases based on the effect's Count for one turn."
    },
    'defense_level_up': {
        name: 'Defense Level Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/C0apZVL.png',
        description: "Defense Level increases based on the effect's Count for one turn."
    },
    'damage_up': {
        name: 'Damage Up', type: 'positive', mode: 'single', maxCount: 10, icon: 'https://imgur.com/KDLYRCR.png',
        description: "Deal 10% more damage with skills based on the effect's Count for one turn. (Max 10)"
    },
    'haste': {
        name: 'Haste', type: 'positive', mode: 'single', icon: 'https://imgur.com/zxUsYIN.png',
        description: "Speed increases by the effect's Count for one turn."
    },
    'protection': {
        name: 'Protection', type: 'positive', mode: 'single', maxCount: 10, icon: 'https://imgur.com/yjPgnjd.png',
        description: "Take 10% less damage per Count from attacks for one turn. (Max 10)"
    },
    'plus_coin_boost': {
        name: 'Plus Coin Boost', type: 'positive', mode: 'single',
        description: "Raise the Power of Plus Coins by the effect's Count for one turn."
    },
    'minus_coin_drop': {
        name: 'Minus Coin Drop', type: 'positive', mode: 'single',
        description: "Reduce the Power of Minus Coins by the effect's Count for one turn."
    },
    'weak_resist_dmg_boost': {
        name: 'Weak-resist DMG Boost', type: 'positive', mode: 'single',
        description: "Boost the damage of attacks against Weak resistances by 1% per Count for one turn."
    },
    'hp_healing_boost': {
        name: 'HP Healing Boost', type: 'positive', mode: 'single', maxCount: 5, icon: 'https://imgur.com/uynjNTN.png',
        description: "Increases HP healing provided by Passive abilities, Skills, and Coin effects by 10% per Count. (Max 5)"
    },
    'ego_resource_amp': {
        name: 'E.G.O Resource Amp', type: 'positive', mode: 'single',
        description: "Increases the amount of E.G.O resources earned from skills by the effect's Count for one turn."
    },

    // --- MODIFICADORES NEGATIVOS GENÉRICOS (Other Debuffs) ---
    'power_down': {
        name: 'Power Down', type: 'negative', mode: 'single',
        description: "All skills lose Final Power by the effect's Count for one turn."
    },
    'attack_power_down': {
        name: 'Attack Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/g69L38F.png',
        description: "Attack skills lose Final Power by the effect's Count for one turn."
    },
    'defense_power_down': {
        name: 'Defense Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/MGdXCaC.png',
        description: "Defense skills lose Final Power by the effect's Count for one turn."
    },
    'clash_power_down': {
        name: 'Clash Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/TppbWXb.png',
        description: "Lose Clash Power by the effect's Count for one turn."
    },
    'offense_level_down': {
        name: 'Offense Level Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/usBnT9m.png',
        description: "Offense level decreases based on the effect's Count for one turn."
    },
    'defense_level_down': {
        name: 'Defense Level Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/C0apZVL.png',
        description: "Defense Level decreases based on the effect's Count for one turn."
    },
    'damage_down': {
        name: 'Damage Down', type: 'negative', mode: 'single', maxCount: 10, icon: 'https://imgur.com/bo7reA0.png',
        description: "Deal 10% less damage with skills per Count for one turn. (Max 10)"
    },
    'bind': {
        name: 'Bind', type: 'negative', mode: 'single', icon: 'https://imgur.com/QndWew8.png',
        description: "Speed decreases by the effect's Count for one turn."
    },
    'fragile': {
        name: 'Fragile', type: 'negative', mode: 'single', maxCount: 10, icon: 'https://imgur.com/wSFboZT.png',
        description: "Take 10% more damage from skills per Count for one turn. (Max 10)"
    },
    'paralyze': {
        name: 'Paralyze', type: 'negative', mode: 'single', icon: 'https://imgur.com/9TkO8Ce.png',
        description: "Fix the Power of X Coin(s) to 0 for one turn."
    },
    'plus_coin_drop': {
        name: 'Plus Coin Drop', type: 'negative', mode: 'single',
        description: "Reduce the Power of Plus Coins by the effect's Count for one turn."
    },
    'minus_coin_boost': {
        name: 'Minus Coin Boost', type: 'negative', mode: 'single',
        description: "Raise the Power of Minus Coins by the effect's Count for one turn."
    },
    'hp_healing_down': {
        name: 'HP Healing Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/5WYFFVt.png',
        description: "Decreases HP healing provided by Passive abilities, Skills, and Coin effects."
    },
    'poison': {
        name: 'Poison', type: 'negative', mode: 'single',
        description: "At the end of the turn, take fixed damage by the Count, then halve the Count."
    },
    'immobilized': {
        name: 'Immobilized', type: 'negative', mode: 'single',
        description: "Does not act for this turn."
    }
};

const generateElementalStatuses = () => {
    const allTypes = [...DAMAGE_TYPES, ...SIN_TYPES];

    allTypes.forEach(type => {
        const idPrefix = type.toLowerCase();

        // 1. DMG Up (Limit: 10)
        STATUS_REGISTRY[`${idPrefix}_dmg_up`] = {
            name: `${type} DMG Up`,
            type: 'positive',
            mode: 'single',
            maxCount: 10,
            description: `Deal 10% more damage with ${type} skills per Count for one turn. (Max 10)`
        };

        // 2. Power Up (Limit: 99)
        STATUS_REGISTRY[`${idPrefix}_power_up`] = {
            name: `${type} Power Up`,
            type: 'positive',
            mode: 'single',
            description: `${type} skills gain final Power by the effect's Count for one turn.`
        };

        // 3. Protection (Limit: 10)
        STATUS_REGISTRY[`${idPrefix}_protection`] = {
            name: `${type} Protection`,
            type: 'positive',
            mode: 'single',
            maxCount: 10,
            description: `Take 10% less damage from ${type} skills per Count for one turn. (Max 10)`
        };

        // 4. DMG Down (Limit: 10)
        STATUS_REGISTRY[`${idPrefix}_dmg_down`] = {
            name: `${type} DMG Down`,
            type: 'negative',
            mode: 'single',
            maxCount: 10,
            description: `Deal 10% less damage with ${type} skills per Count for one turn. (Max 10)`
        };

        // 5. Power Down (Limit: 99)
        STATUS_REGISTRY[`${idPrefix}_power_down`] = {
            name: `${type} Power Down`,
            type: 'negative',
            mode: 'single',
            description: `${type} skills lose final Power by the effect's Count for one turn.`
        };

        // 6. Fragility (Limit: 10)
        STATUS_REGISTRY[`${idPrefix}_fragility`] = {
            name: `${type} Fragility`,
            type: 'negative',
            mode: 'single',
            maxCount: 10,
            description: `Take 10% more damage from ${type} skills per Count for one turn. (Max 10)`
        };
    });
};

generateElementalStatuses();

const StatusManager = {
    /**
     * Applies or updates a status effect on a unit.
     * @param {Object} unit - The unit to apply the status to.
     * @param {string} statusId - The ID of the status (must exist in STATUS_REGISTRY).
     * @param {number} [potencyDelta] - Optional explicit potency delta (for double mode) or count delta (for single mode if potencyDelta acts as count, but we will handle it).
     * @param {number} [countDelta] - Optional explicit count delta.
     */
    applyStatus: function(unit, statusId, potencyDelta, countDelta) {
        if (!unit) return;
        if (!unit.statusEffects) {
            unit.statusEffects = {};
        }

        const registryId = statusId.toLowerCase();
        const registry = STATUS_REGISTRY[registryId];

        if (!registry) {
            console.warn(`StatusManager: Status '${statusId}' not found in registry.`);
            return;
        }

        // Initialize status if it doesn't exist
        if (!unit.statusEffects[statusId]) {
            unit.statusEffects[statusId] = {
                id: statusId,
                mode: registry.mode,
                type: registry.type
            };

            // Apply initial values based on mode
            if (registry.mode === 'zero') {
                // Zero mode is always 1, no scaling
                unit.statusEffects[statusId].value = 1;
            } else if (registry.mode === 'single') {
                // For single mode, if potencyDelta is passed but countDelta isn't,
                // the first numeric argument is treated as the count delta.
                let initialCount = registry.baseCount !== undefined ? registry.baseCount : 1;

                // Determine the explicit delta passed.
                // In applyStatus(unit, 'charge', 5), potencyDelta is 5.
                if (potencyDelta !== undefined) {
                    initialCount = potencyDelta;
                }

                unit.statusEffects[statusId].count = initialCount;
            } else if (registry.mode === 'double') {
                let initialPotency = registry.basePotency !== undefined ? registry.basePotency : 1;
                let initialCount = registry.baseCount !== undefined ? registry.baseCount : 1;

                if (potencyDelta !== undefined) {
                    initialPotency = potencyDelta;
                }
                if (countDelta !== undefined) {
                    initialCount = countDelta;
                }

                unit.statusEffects[statusId].potency = initialPotency;
                unit.statusEffects[statusId].count = initialCount;
            }
        } else {
            // Update existing status based on mode
            const existingStatus = unit.statusEffects[statusId];

            if (registry.mode === 'single') {
                // Determine delta. If applyStatus(unit, 'charge', 5) is called, potencyDelta is 5.
                let delta = 0;
                if (potencyDelta !== undefined) {
                    delta = potencyDelta;
                }
                existingStatus.count += delta;

            } else if (registry.mode === 'double') {
                let pDelta = potencyDelta !== undefined ? potencyDelta : 0;
                let cDelta = countDelta !== undefined ? countDelta : 0;

                existingStatus.potency += pDelta;
                existingStatus.count += cDelta;
            }
        }

        // Enforce limits and check expiration
        this._enforceLimitsAndExpiration(unit, statusId);
    },

    /**
     * Enforces limits (max values) and removal rules for a specific status.
     * @param {Object} unit - The unit.
     * @param {string} statusId - The ID of the status.
     */
    _enforceLimitsAndExpiration: function(unit, statusId) {
        if (!unit || !unit.statusEffects || !unit.statusEffects[statusId]) return;

        const status = unit.statusEffects[statusId];
        const registryId = statusId.toLowerCase();
        const registry = STATUS_REGISTRY[registryId];

        if (!registry) return;

        // Apply max values
        if (registry.mode === 'single') {
            const maxCount = registry.maxCount !== undefined ? registry.maxCount : 99;
            status.count = Math.min(status.count, maxCount);
        } else if (registry.mode === 'double') {
            const maxPotency = registry.maxPotency !== undefined ? registry.maxPotency : 99;
            const maxCount = registry.maxCount !== undefined ? registry.maxCount : 99;
            status.potency = Math.min(status.potency, maxPotency);
            status.count = Math.min(status.count, maxCount);
        }

        // Expiration rule
        if (registry.mode === 'single') {
            if (status.count <= 0) {
                delete unit.statusEffects[statusId];
            }
        } else if (registry.mode === 'double') {
            if (status.potency <= 0 || status.count <= 0) {
                delete unit.statusEffects[statusId];
            }
        }
        // zero mode statuses are not removed here, they rely on explicit removal if necessary
    },

    /**
     * Subtracts count/potency from a status.
     * @param {Object} unit - The unit.
     * @param {string} statusId - The ID of the status.
     * @param {number} [potencyDelta] - Potency to subtract (double mode) or count to subtract (single mode).
     * @param {number} [countDelta] - Count to subtract (double mode).
     */
    reduceStatus: function(unit, statusId, potencyDelta, countDelta) {
        if (!unit || !unit.statusEffects || !unit.statusEffects[statusId]) return;

        const registryId = statusId.toLowerCase();
        const registry = STATUS_REGISTRY[registryId];

        if (!registry) return;

        if (registry.mode === 'single') {
            let decrement = potencyDelta !== undefined ? potencyDelta : 1; // Default to -1 if nothing passed
            unit.statusEffects[statusId].count -= decrement;
        } else if (registry.mode === 'double') {
            let pDec = potencyDelta !== undefined ? potencyDelta : 0;
            let cDec = countDelta !== undefined ? countDelta : 0;

            unit.statusEffects[statusId].potency -= pDec;
            unit.statusEffects[statusId].count -= cDec;
        }

        this._enforceLimitsAndExpiration(unit, statusId);
    },

    /**
     * Counts the total number of negative status effects on a unit.
     * @param {Object} unit - The unit to check.
     * @returns {number} - The count of negative status effects.
     */
    countNegativeEffects: function(unit) {
        if (!unit || !unit.statusEffects) return 0;

        let count = 0;
        const effects = Object.values(unit.statusEffects);
        for (let i = 0; i < effects.length; i++) {
            if (effects[i].type === 'negative') {
                count++;
            }
        }
        return count;
    },

    /**
     * Counts the total number of positive status effects on a unit.
     * @param {Object} unit - The unit to check.
     * @returns {number} - The count of positive status effects.
     */
    countPositiveEffects: function(unit) {
        if (!unit || !unit.statusEffects) return 0;

        let count = 0;
        const effects = Object.values(unit.statusEffects);
        for (let i = 0; i < effects.length; i++) {
            if (effects[i].type === 'positive') {
                count++;
            }
        }
        return count;
    },

    /**
     * Validates all status effects on a unit, ensuring limits and removing expired ones.
     * Typically called after external modifications.
     * @param {Object} unit - The unit to validate.
     */
    validateAllStatuses: function(unit) {
        if (!unit || !unit.statusEffects) return;

        const effectIds = Object.keys(unit.statusEffects);
        for (let i = 0; i < effectIds.length; i++) {
            this._enforceLimitsAndExpiration(unit, effectIds[i]);
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STATUS_REGISTRY, StatusManager };
}
