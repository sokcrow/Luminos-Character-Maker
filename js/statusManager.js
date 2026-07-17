const DAMAGE_TYPES = ['Slash', 'Pierce', 'Blunt'];
const SIN_TYPES = ['Wrath', 'Lust', 'Sloth', 'Gluttony', 'Gloom', 'Pride', 'Envy'];

const STATUS_REGISTRY = {
    // --- CORE STATUSES ---
    'burn': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "At turn end, take Burn Potency as Wrath damage and reduce Count by 1." },
    'bleed': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "Whenever tossing a coin for an Attack Skill, take Bleed Potency as damage and reduce Count by 1." },
    'tremor': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "When hit by an attack with Tremor Burst, raise Stagger Threshold by Tremor Potency. Count is reduced by 1 at turn end." },
    'rupture': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "When hit by an attack, take Rupture Potency as true damage and reduce Count by 1." },
    'sinking': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "When hit by an attack, take Sinking Potency as Gloom damage and reduce Count by 1 (or SP damage if applicable)." },
    'poise': { type: 'positive', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "Gain a chance to deal Critical Damage on hit. Potency increases Critical Chance, Count increases Critical Damage. Count is reduced by 1 at turn end." },
    'charge': { type: 'positive', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 20, description: "Resource used by certain skills for additional effects." },

    // --- GENERIC BUFFS (Other Buffs) ---
    'power_up': {
        name: 'Power Up', type: 'positive', mode: 'single',
        description: "All skills gain Final Power by the effect's Count for one turn."
    },
    'attack_power_up': {
        name: 'Attack Power Up', type: 'positive', mode: 'single',
        description: "Attack skills gain Final Power by the effect's Count for one turn."
    },
    'defense_power_up': {
        name: 'Defense Power Up', type: 'positive', mode: 'single',
        description: "Defense skills gain Final Power by the effect's Count for one turn."
    },
    'clash_power_up': {
        name: 'Clash Power Up', type: 'positive', mode: 'single',
        description: "Gain Clash Power by the effect's Count for one turn."
    },
    'base_power_up': {
        name: 'Base Power Up', type: 'positive', mode: 'single',
        description: "Raise the Base Power of Skills by the effect's Count."
    },
    'offense_level_up': {
        name: 'Offense Level Up', type: 'positive', mode: 'single',
        description: "Offense level increases based on the effect's Count for one turn."
    },
    'defense_level_up': {
        name: 'Defense Level Up', type: 'positive', mode: 'single',
        description: "Defense Level increases based on the effect's Count for one turn."
    },
    'damage_up': {
        name: 'Damage Up', type: 'positive', mode: 'single', maxCount: 10,
        description: "Deal 10% more damage with skills based on the effect's Count for one turn. (Max 10)"
    },
    'haste': {
        name: 'Haste', type: 'positive', mode: 'single',
        description: "Speed increases by the effect's Count for one turn."
    },
    'protection': {
        name: 'Protection', type: 'positive', mode: 'single', maxCount: 10,
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
        name: 'HP Healing Boost', type: 'positive', mode: 'single', maxCount: 5,
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
        name: 'Attack Power Down', type: 'negative', mode: 'single',
        description: "Attack skills lose Final Power by the effect's Count for one turn."
    },
    'defense_power_down': {
        name: 'Defense Power Down', type: 'negative', mode: 'single',
        description: "Defense skills lose Final Power by the effect's Count for one turn."
    },
    'clash_power_down': {
        name: 'Clash Power Down', type: 'negative', mode: 'single',
        description: "Lose Clash Power by the effect's Count for one turn."
    },
    'offense_level_down': {
        name: 'Offense Level Down', type: 'negative', mode: 'single',
        description: "Offense level decreases based on the effect's Count for one turn."
    },
    'defense_level_down': {
        name: 'Defense Level Down', type: 'negative', mode: 'single',
        description: "Defense Level decreases based on the effect's Count for one turn."
    },
    'damage_down': {
        name: 'Damage Down', type: 'negative', mode: 'single', maxCount: 10,
        description: "Deal 10% less damage with skills per Count for one turn. (Max 10)"
    },
    'bind': {
        name: 'Bind', type: 'negative', mode: 'single',
        description: "Speed decreases by the effect's Count for one turn."
    },
    'fragile': {
        name: 'Fragile', type: 'negative', mode: 'single', maxCount: 10,
        description: "Take 10% more damage from skills per Count for one turn. (Max 10)"
    },
    'paralyze': {
        name: 'Paralyze', type: 'negative', mode: 'single',
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
        name: 'HP Healing Down', type: 'negative', mode: 'single',
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
