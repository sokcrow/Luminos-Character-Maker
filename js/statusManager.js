const DAMAGE_TYPES = ['Slash', 'Pierce', 'Blunt'];
const SIN_TYPES = ['Wrath', 'Lust', 'Sloth', 'Gluttony', 'Gloom', 'Pride', 'Envy'];

const STATUS_REGISTRY = {
    // Core Statuses
    'burn': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "At turn end, take Burn Potency as Wrath damage and reduce Count by 1." },
    'bleed': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "Whenever tossing a coin for an Attack Skill, take Bleed Potency as damage and reduce Count by 1." },
    'tremor': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "When hit by an attack with Tremor Burst, raise Stagger Threshold by Tremor Potency. Count is reduced by 1 at turn end." },
    'rupture': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "When hit by an attack, take Rupture Potency as true damage and reduce Count by 1." },
    'sinking': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "When hit by an attack, take Sinking Potency as Gloom damage and reduce Count by 1 (or SP damage if applicable)." },
    'poise': { type: 'positive', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99, description: "Gain a chance to deal Critical Damage on hit. Potency increases Critical Chance, Count increases Critical Damage. Count is reduced by 1 at turn end." },
    'charge': { type: 'positive', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 20, description: "Resource used by certain skills for additional effects." },

    // Generic Modifiers
    'damage_up': { type: 'positive', mode: 'single', maxCount: 10, description: "Deal 10% more damage per Count. (Max 10)" },
    'damage_down': { type: 'negative', mode: 'single', maxCount: 10, description: "Deal 10% less damage per Count. (Max 10)" },
    'fragile': { type: 'negative', mode: 'single', maxCount: 10, description: "Take 10% more damage per Count. (Max 10)" },
    'protection': { type: 'positive', mode: 'single', maxCount: 10, description: "Take 10% less damage per Count. (Max 10)" },
    'attack_power_up': { type: 'positive', mode: 'single', maxCount: Infinity, description: "Increases Final Power of Attack Skills by Count." },
    'defense_power_up': { type: 'positive', mode: 'single', maxCount: Infinity, description: "Increases Final Power of Defense Skills by Count." },
    'clash_power_up': { type: 'positive', mode: 'single', maxCount: Infinity, description: "Increases Clash Power by Count." },
    'haste': { type: 'positive', mode: 'single', maxCount: Infinity, description: "Increases Speed by Count." },
    'bind': { type: 'negative', mode: 'single', maxCount: Infinity, description: "Decreases Speed by Count." },
    'offense_level_up': { type: 'positive', mode: 'single', maxCount: Infinity, description: "Increases Offense Level by Count." },
    'offense_level_down': { type: 'negative', mode: 'single', maxCount: Infinity, description: "Decreases Offense Level by Count." },
    'defense_level_up': { type: 'positive', mode: 'single', maxCount: Infinity, description: "Increases Defense Level by Count." },
    'defense_level_down': { type: 'negative', mode: 'single', maxCount: Infinity, description: "Decreases Defense Level by Count." },
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

        // 2. Power Up (Limit: Infinity)
        STATUS_REGISTRY[`${idPrefix}_power_up`] = {
            name: `${type} Power Up`,
            type: 'positive',
            mode: 'single',
            maxCount: Infinity,
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

        // 5. Power Down (Limit: Infinity)
        STATUS_REGISTRY[`${idPrefix}_power_down`] = {
            name: `${type} Power Down`,
            type: 'negative',
            mode: 'single',
            maxCount: Infinity,
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
            const maxCount = registry.maxCount !== undefined ? registry.maxCount : Infinity;
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
