const STATUS_REGISTRY = {
    // Examples based on generic ecosystem
    'burn': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99 },
    'bleed': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99 },
    'tremor': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99 },
    'rupture': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99 },
    'sinking': { type: 'negative', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99 },
    'charge': { type: 'positive', mode: 'single', baseCount: 1, maxCount: 20 },
    'poise': { type: 'positive', mode: 'double', basePotency: 1, baseCount: 1, maxPotency: 99, maxCount: 99 },

    // Some static ones that might exist
    'fragile': { type: 'negative', mode: 'single', baseCount: 1, maxCount: 10 },
    'protection': { type: 'positive', mode: 'single', baseCount: 1, maxCount: 10 },
    'damage up': { type: 'positive', mode: 'single', baseCount: 1, maxCount: 10 },
    'damage down': { type: 'negative', mode: 'single', baseCount: 1, maxCount: 10 },

    // Zero mode example
    'marked': { type: 'negative', mode: 'zero' },
};

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
