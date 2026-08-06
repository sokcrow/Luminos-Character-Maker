const RESONANCE_BONUS = {
    // Índice: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11+]
    REGULAR:  [0, 0, 1, 3, 3, 5, 5, 7, 7, 9, 9, 11],
    ABSOLUTE: [0, 0, 0, 3, 5, 5, 7, 7, 9, 9, 11, 11]
};

const CombatEngine = {
    // Game State
    currentState: 'COMBAT_ACTIVE',
    FLANKING_DAMAGE_MULTIPLIER: 1.20,
    FLANKING_POWER_BONUS: 2,

 // 'PRE_COMBAT_PLANNING', 'COMBAT_ACTIVE'


    analyzeEnemyRole: function(unit) {
        // AI Profiling based on stats, skills, and spells
        let hpScore = (unit.maxHp || 100) / 100;
        let defScore = ((unit.defensive_level || 0) + (unit.staggerThresholds ? unit.staggerThresholds.length : 0)) * 0.5;
        let aoeCount = 0;
        let supportCount = 0;

        // Scan skills
        let allSkills = [];
        if (unit.attack_tier_1_sequence) allSkills = allSkills.concat(unit.attack_tier_1_sequence);
        if (unit.attack_tier_2_sequence) allSkills = allSkills.concat(unit.attack_tier_2_sequence);
        if (unit.attack_tier_3_sequence) allSkills = allSkills.concat(unit.attack_tier_3_sequence);

        allSkills.forEach(skill => {
            if (skill.targeting_type === 'AoE' || skill.targeting_type === 'Unfocused Volley') aoeCount++;
            if (skill.type === 'Guard' || skill.type === 'Counter') defScore++;
        });

        // Very basic categorization logic based on the user's rules:
        if (hpScore + defScore > 3 && aoeCount === 0) return 'Front';
        if (aoeCount > 0 || hpScore < 1.5) return 'Back';
        return 'Mid';
    },

    autoDeployEnemies: function(enemies, totalEnemyColumns) {
        if (!enemies || enemies.length === 0 || totalEnemyColumns <= 0) return;

        // Subdivide grid
        let colsPerZone = Math.floor(totalEnemyColumns / 3);
        let frontCols = totalEnemyColumns - (colsPerZone * 2); // Remainder to front

        let frontXStart = 0;
        let midXStart = frontXStart + frontCols;
        let backXStart = midXStart + colsPerZone;

        let frontAvailable = [];
        let midAvailable = [];
        let backAvailable = [];

        // Generate possible positions (Assuming y goes from 0 to grid_height-1, let's say 5 for now, or just line them up)
        let gridHeight = 5;
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < frontCols; x++) frontAvailable.push({x: frontXStart + x, y: y});
            for (let x = 0; x < colsPerZone; x++) midAvailable.push({x: midXStart + x, y: y});
            for (let x = 0; x < colsPerZone; x++) backAvailable.push({x: backXStart + x, y: y});
        }

        enemies.forEach(enemy => {
            let role = this.analyzeEnemyRole(enemy);
            let targetZone = frontAvailable;
            if (role === 'Mid') targetZone = midAvailable;
            if (role === 'Back') targetZone = backAvailable;

            // Fallback if zone is full
            if (targetZone.length === 0) targetZone = frontAvailable.length > 0 ? frontAvailable : (midAvailable.length > 0 ? midAvailable : backAvailable);

            if (targetZone.length > 0) {
                // Pick random available spot in zone
                let idx = Math.floor(Math.random() * targetZone.length);
                let pos = targetZone.splice(idx, 1)[0];
                enemy.grid_pos = pos;
            }
        });
    },

    triggerEncounterStart: function() {
        this.currentState = 'COMBAT_ACTIVE';
        // Add additional logic if needed when planning ends
    },

// 0. Habilidades y Poder (Skills)
    // 0.5 Helper D&D
    // 0.4 Initialization Helpers
        initializeUnitData: function(unit) {
        if (!unit) return;
        if (unit.took_damage_this_turn === undefined) unit.took_damage_this_turn = false;
        if (unit.took_damage_last_turn === undefined) unit.took_damage_last_turn = false;
        if (!unit.delayed_effects) unit.delayed_effects = [];
        if (!unit.next_turn_buffer) unit.next_turn_buffer = [];
        if (unit.damage_dealt_multiplier === undefined) unit.damage_dealt_multiplier = 1.0;
        if (unit.damage_taken_multiplier === undefined) unit.damage_taken_multiplier = 1.0;
        if (!unit.grid_pos) unit.grid_pos = {x: 0, y: 0};
        this.initializeUnitAnimations(unit);
    },
    initializeUnitAnimations: function(unit) {
        if (!unit) return;

        // Ensure visual animation state variables exist
        unit.idle_sprite = unit.idle_sprite || unit.img || '';
        unit.moving_sprite = unit.moving_sprite || '';
        unit.guard_sprite = unit.guard_sprite || '';
        unit.evade_sprite = unit.evade_sprite || '';
        unit.hurt_sprite = unit.hurt_sprite || '';
        unit.dead_sprite = unit.dead_sprite || '';

        // Ensure attack sequence architecture arrays exist
        unit.attack_tier_1_sequence = unit.attack_tier_1_sequence || [];
        unit.attack_tier_2_sequence = unit.attack_tier_2_sequence || [];
        unit.attack_tier_3_sequence = unit.attack_tier_3_sequence || [];

        // Initialize Original Sequences Memory (Base State Reversion)
        if (!unit.original_sequences) {
            unit.original_sequences = {
                tier_1: JSON.parse(JSON.stringify(unit.attack_tier_1_sequence)),
                tier_2: JSON.parse(JSON.stringify(unit.attack_tier_2_sequence)),
                tier_3: JSON.parse(JSON.stringify(unit.attack_tier_3_sequence))
            };
        }

        // At runtime, default current sprite to idle
        unit.current_sprite = unit.idle_sprite;
    },


    getAllAliveUnits: function() {
        // Needs a reference to all units in the battle. Assuming they are accessible via some global or engine state,
        // but typically CombatEngine processes them via context. Let's assume window.combatData exists in UI, but Engine should be decoupled.
        // We will need a registry in CombatEngine if it doesn't exist.
        if (typeof window !== 'undefined' && window.combatData) {
             return Object.values(window.combatData).filter(u => u.hp > 0);
        }
        return [];
    },

    findClosestHostile: function(unit) {
        let hostiles = this.getAllAliveUnits().filter(u => u.faction !== unit.faction);
        if (hostiles.length === 0) return null;

        // Find closest based on grid_pos distance
        if (unit.grid_pos && hostiles[0].grid_pos) {
            hostiles.sort((a, b) => {
                let distA = Math.abs(unit.grid_pos.x - a.grid_pos.x) + Math.abs(unit.grid_pos.y - a.grid_pos.y);
                let distB = Math.abs(unit.grid_pos.x - b.grid_pos.x) + Math.abs(unit.grid_pos.y - b.grid_pos.y);
                if (distA !== distB) return distA - distB;
                // Tiebreaker: Aggro / maxHp
                return (b.maxHp || 1) - (a.maxHp || 1);
            });
        }
        return hostiles[0];
    },

    calculateResonance: function(actionQueue) {
        if (!actionQueue || actionQueue.length === 0) return;

        // Reset previous resonance bonuses
        actionQueue.forEach(action => {
            if (action && action.skill) {
                action.skill.resonanceOffenseBonus = 0;
                action.skill.resonanceDefenseBonus = 0;
            }
        });

        // Track global counts for Regular Resonance
        const affinityCounts = {};

        // Track chains for Absolute Resonance
        let currentChainAffinity = null;
        let currentChainLength = 0;
        let currentChainStartIndex = 0;
        const chains = [];

        // First pass: identify absolute resonance chains and count regular resonance
        actionQueue.forEach((action, index) => {
            const skill = action && action.skill;
            if (!skill || !skill.affinity) {
                // Break chain if skill or affinity is missing
                if (currentChainLength >= 3) {
                    chains.push({
                        affinity: currentChainAffinity,
                        startIndex: currentChainStartIndex,
                        length: currentChainLength
                    });
                }
                currentChainAffinity = null;
                currentChainLength = 0;
                return;
            }

            const affinity = skill.affinity;

            // Track global count
            if (!affinityCounts[affinity]) affinityCounts[affinity] = 0;
            affinityCounts[affinity]++;

            // Track chains
            if (affinity === currentChainAffinity) {
                currentChainLength++;
            } else {
                if (currentChainLength >= 3) {
                    chains.push({
                        affinity: currentChainAffinity,
                        startIndex: currentChainStartIndex,
                        length: currentChainLength
                    });
                }
                currentChainAffinity = affinity;
                currentChainLength = 1;
                currentChainStartIndex = index;
            }
        });

        // Check if the last chain was >= 3
        if (currentChainLength >= 3) {
            chains.push({
                affinity: currentChainAffinity,
                startIndex: currentChainStartIndex,
                length: currentChainLength
            });
        }

        // Second pass: apply bonuses
        // Track appearance order for Regular Resonance
        const appearanceOrder = {};

        actionQueue.forEach((action, index) => {
            const skill = action && action.skill;
            if (!skill || !skill.affinity) return;

            const affinity = skill.affinity;

            // Calculate Absolute Resonance bonus for this skill
            let absoluteBonus = 0;
            const chain = chains.find(c => c.affinity === affinity && index >= c.startIndex && index < c.startIndex + c.length);
            if (chain) {
                const lookupIndex = Math.min(chain.length, 11);
                absoluteBonus = RESONANCE_BONUS.ABSOLUTE[lookupIndex];
            }

            // Calculate Regular Resonance bonus for this skill
            let regularBonus = 0;
            const globalCount = affinityCounts[affinity];
            if (globalCount >= 2) {
                if (!appearanceOrder[affinity]) appearanceOrder[affinity] = 0;
                appearanceOrder[affinity]++;
                const appearanceIndex = appearanceOrder[affinity];
                const lookupIndex = Math.min(appearanceIndex, 11);
                regularBonus = RESONANCE_BONUS.REGULAR[lookupIndex];
            }

            // Apply highest bonus
            const finalBonus = Math.max(absoluteBonus, regularBonus);
            if (finalBonus > 0) {
                skill.resonanceOffenseBonus = finalBonus;
                skill.resonanceDefenseBonus = finalBonus;
            }
        });
    },

    getDndModifier: function(score) {
        return Math.floor((score - 10) / 2);
    },

    calculateDndBonus: function(unit, statUsed, skillUsed) {
        if (!unit || !unit.dndStats) return 0;
        let modifier = 0;

        if (statUsed && unit.dndStats[statUsed] !== undefined) {
            modifier = this.getDndModifier(unit.dndStats[statUsed]);
        }

        let isProficient = false;
        if (unit.dndStats.proficiencies) {
            if (statUsed && unit.dndStats.proficiencies.includes(statUsed + "_SAVE")) {
                isProficient = true;
            }
            if (skillUsed && unit.dndStats.proficiencies.includes(skillUsed)) {
                isProficient = true;
            }
        }

        let profBonus = isProficient ? (unit.dndStats.proficiencyBonus || 0) : 0;
        return modifier + profBonus;
    },

    createSkill: function(config = {}) {
        let skill = {
            basePower: config.basePower || 0,
            coinPower: config.coinPower || 0,
            coinAmount: Math.max(1, config.coinAmount || 1),
            coinType: config.coinType || 'standard',
            attackType: config.attackType || 'Slash',
            sinAffinity: config.sinAffinity !== undefined ? config.sinAffinity : null,
            levelModifier: config.levelModifier || 0,
            attackWeight: config.attackWeight || 1,
            skillAmount: config.skillAmount || 1,
            tier: config.tier !== undefined ? config.tier : 1, // Fallback a tier 1
            isItemSkill: config.isItemSkill || false, // Fallback a false

            // D&D Hybrid Additions
            type: config.type || 'Normal', // 'Normal', 'Spell', 'Roll', 'Guard', 'Evade', 'Counter', 'ClashableGuard', 'ClashableCounter'
            statUsed: config.statUsed || null,
            skillUsed: config.skillUsed || null,

            // Efectos (Hooks)
            effects: config.effects || [],

            // Flags misceláneas
            isTargetFixed: config.isTargetFixed || false,
            isIndiscriminate: config.isIndiscriminate || false,
            isUnclashable: config.isUnclashable || false
        };

        const defenseTypes = ['Guard', 'Evade', 'Counter', 'ClashableGuard', 'ClashableCounter'];
        if (defenseTypes.includes(skill.type)) {
            skill.isDefense = true;
            skill.isClashable = (skill.type === 'ClashableGuard' || skill.type === 'ClashableCounter');
        } else {
            skill.isDefense = false;
            skill.isClashable = !skill.isUnclashable; // Assume standard attacks are clashable unless isUnclashable is true
        }

        // Initialize coins array based on coinAmount
        skill.coins = [];
        for (let i = 0; i < skill.coinAmount; i++) {
            let coinConfig = (config.coins && config.coins[i]) || {};
            skill.coins.push({
                type: skill.coinType,
                status: 'active',
                effects: coinConfig.effects || []
            });
        }

        if (skill.type === 'Spell' || skill.type === 'Roll') {
            skill.coinPower = 4;
            skill.coinAmount = 5;
            skill.coins = [];
            for (let i = 0; i < skill.coinAmount; i++) {
                skill.coins.push({
                    type: skill.coinType,
                    status: 'active',
                    effects: [] // Roll/Spell coins might not have standard coin effects
                });
            }

            if (config.caster) {
                let dndBonus = this.calculateDndBonus(config.caster, skill.statUsed, skill.skillUsed);
                skill.basePower = dndBonus;

                if (skill.type === 'Spell') {
                    skill.saveDC = 8 + dndBonus;
                }
            }
        }

        return skill;
    },

    createSaveSkill: function(target, statUsed) {
        let skill = {
            type: 'Save',
            basePower: 0,
            coinPower: 4,
            coinAmount: 5,
            coinType: 'standard',
            statUsed: statUsed
        };

        skill.coins = [];
        for (let i = 0; i < skill.coinAmount; i++) {
            skill.coins.push({
                type: skill.coinType,
                status: 'active'
            });
        }

        if (target) {
            skill.basePower = this.calculateDndBonus(target, statUsed, null);
        }

        return skill;
    },

    checkOffset: function(skillA, skillB) {
        if (!skillA || !skillB) return false;
        if (skillA.isDefense && skillB.isDefense) {
            const nonClashableDefenses = ['Guard', 'Evade'];
            if (nonClashableDefenses.includes(skillA.type) && nonClashableDefenses.includes(skillB.type)) {
                return true;
            }
        }
        return false;
    },

    resolveSpell: function(spellSkill, target, targetHeadsFlipped) {
        // Genera la tirada de salvación para el objetivo
        let saveSkill = this.createSaveSkill(target, spellSkill.statUsed);
        let savePower = this.calculateFinalPower(saveSkill, targetHeadsFlipped, target);

        let isSuccess = savePower >= spellSkill.saveDC;

        return {
            pendingActions: [],
            isStaticDC: true,
            dc: spellSkill.saveDC,
            savePower: savePower,
            isSuccess: isSuccess,
            winner: isSuccess ? 'Target' : 'Caster',
            message: `Spell DC ${spellSkill.saveDC} vs Save ${savePower}. ${isSuccess ? 'Save Successful!' : 'Save Failed!'}`
        };
    },

    resolveGuard: function(unitDefender, guardSkill) {
        if (unitDefender && unitDefender.guard_sprite) {
            unitDefender.current_sprite = unitDefender.guard_sprite;
        }
        if (!guardSkill.coins) {
            guardSkill.coins = Array.from({length: guardSkill.coinAmount}, () => ({ type: guardSkill.coinType || 'standard', status: 'active' }));
        }

        let probDefender = this.getCoinProbability(unitDefender.sp || 0);
        let guardTosses = guardSkill.coins.map(c => c.status === 'active' ? (Math.random() * 100 < probDefender) : true);
        let guardPower = this.calculateFinalPower(guardSkill, guardTosses, unitDefender);

        unitDefender.shield = (unitDefender.shield || 0) + guardPower;

        return {
            pendingActions: [],
            guardPower: guardPower,
            guardTosses: guardTosses,
            newShieldAmount: unitDefender.shield
        };
    },

    resolveUnilateralWithCounter: function(unitAttacker, attackSkill, unitDefender, counterSkill, options = { skipUseHooks: false, clashResult: null }) {
        if (this.currentState === 'PRE_COMBAT_PLANNING') return { attackLogs: [{ message: 'Action blocked during Planning Phase.', class: 'error' }], damageTaken: 0 };
        let result = {
            attackLogs: [],
            pendingActions: [], // cracked coins and counter attacks
            defenderStaggered: false
        };


        // Assume the attack hits unilaterally first.
        if (!attackSkill.coins) {
            attackSkill.coins = Array.from({length: attackSkill.coinAmount}, () => ({ type: attackSkill.coinType || 'standard', status: 'active', effects: [] }));
        }

        // Move attacker dynamically to the target before executing
        if (unitAttacker.grid_pos && unitDefender.grid_pos) {
            this.moveAttackerToTarget(unitAttacker, unitDefender);
        }
        let context = { engine: this, attacker: unitAttacker, defender: unitDefender, skill: attackSkill, targetsHit: [unitDefender] };

        // [Before Use] and [On Use] might have been triggered if it was originally an Unclashable attack,
        // but if it's purely unilateral, we trigger them here.
        if (!options.skipUseHooks) {
            this.triggerEvent('[Before Use]', context, [unitDefender]);
            this.triggerEvent('[On Use]', context, [unitDefender]);
        }

        this.triggerEvent('[Before Attack]', context, [unitDefender]);

        if (!options.clashResult) {
            this.triggerEvent('[On Unopposed Attack]', context, [unitDefender]);
        }

        if (counterSkill) {
            let defContext = { engine: this, attacker: unitAttacker, defender: unitDefender, skill: counterSkill };
            this.triggerEvent('[Before Getting Hit]', defContext, [unitDefender]);
        }

        let activeAttackCoins = attackSkill.coins.filter(c => c.status === 'active' || c.status === 'cracked' || c.status === 'latent');
        let probAttacker = this.getCoinProbability(unitAttacker.sp || 0);



        // ---------------- TARGETING TYPES INJECTION ----------------
        // Identify the base targeting type
        let targetingType = attackSkill.targeting_type || 'Focused Attack';
        let originalDefender = unitDefender;

        for (let i = 0; i < activeAttackCoins.length; i++) {
            let currentCoin = activeAttackCoins[i];

            // Check Target Alive Status
            if (unitDefender.hp <= 0) {
                if (targetingType === 'Focused Attack') {
                    // Cancel remaining coins instantly
                    result.attackLogs.push({ message: `Target dead. Action cancelled ([Focused Attack]).`, class: 'clash-info' });
                    break;
                }

                if (targetingType === 'Focused Volley') {
                    if (unitAttacker.faction === 'enemy') {
                        // AI Auto-Retargeting
                        let newTarget = this.findClosestHostile(unitAttacker); // Needs helper
                        if (newTarget) {
                            unitDefender = newTarget;
                            context.defender = unitDefender;
                            context.targetsHit = [unitDefender];
                            result.attackLogs.push({ message: `AI Auto-retargeting to ${unitDefender.name} ([Focused Volley]).`, class: 'clash-info' });
                        } else {
                            break; // No targets left
                        }
                    } else {
                        // For players, we pause and wait for UI event (we just break for now, assuming UI handles the pause via queue management)
                        // This would emit a custom event to the DOM.
                        if (typeof document !== 'undefined') {
                            document.dispatchEvent(new CustomEvent('CombatEngine:PlayerRetargetNeeded', { detail: { attacker: unitAttacker, skill: attackSkill, remainingCoins: activeAttackCoins.slice(i) }}));
                        }
                        result.attackLogs.push({ message: `Waiting for player retarget... ([Focused Volley]).`, class: 'clash-info' });
                        break;
                    }
                }
            }

            if (targetingType === 'Unfocused Volley') {
                // Randomize target per coin
                let possibleTargets = this.getAllAliveUnits().filter(u => u.faction !== unitAttacker.faction);
                if (possibleTargets.length > 0) {
                    let randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
                    unitDefender = randomTarget;
                    context.defender = unitDefender;
                    context.targetsHit = [unitDefender];
                    // Always treat as unopposed if retargeted (or if it was already unopposed). Even if it hits the clash target, we enforce unopposed resolution rules here for damage
                    options.clashResult = null; // Forces unopposed damage logic
                    if (possibleTargets.length === 1 && unitDefender === originalDefender) {
                        result.attackLogs.push({ message: `Only one target remaining, unloading remaining coins on ${unitDefender.name} ([Unfocused Volley - Unopposed]).`, class: 'clash-info' });
                    } else {
                        result.attackLogs.push({ message: `Retargeting coin to ${unitDefender.name} ([Unfocused Volley - Unopposed]).`, class: 'clash-info' });
                    }
                }
            }

            // AoE logic is handled outside the coin loop (during target selection / calculateAoETargets)
            // Indiscriminate logic is handled during round start / target caching.

            if (i > 0 && options.clashResult === null && attackSkill.coins && attackSkill.coins.length === 1) {
                // If this is a unilateral attack with a single-coin skill looping multiple times (like a recycled coin)
                // However, our loop is over activeAttackCoins which is just the coins array.
                // A true recycled coin is pushed to the coins array or re-evaluated.
                // Let's just set it generically if i > 0 and coinAmount is 1 (meaning it's the same coin reused)
                if (attackSkill.coinAmount === 1) currentCoin.isReused = true;
            }
            context.currentCoin = currentCoin;

            this.triggerEvent('[Coin Start]', context, [unitDefender]);
            this.processStatusEffects(unitAttacker, 'on_coin_flip', context);

            let attackPower;
            let isHeads = false;
            let attackTosses = [];

            if (currentCoin.status === 'latent') {
                // Latent unbreakable coins deal exactly 1 power
                attackPower = 1;
                // Assuming latent coins don't "toss" for mechanics like Heads/Tails triggers (or maybe they always hit heads? We will say they don't toss heads)
                isHeads = false;
                attackTosses = activeAttackCoins.map(c => false); // Mock array
            } else {
                attackTosses = activeAttackCoins.map(c => c.status === 'active' ? (Math.random() * 100 < probAttacker) : true);
                attackPower = this.calculateFinalPower(attackSkill, attackTosses, unitAttacker);

                // current coin toss result (it's the i-th toss basically, if we consider only active ones we need mapping, but let's assume current toss is for current coin)
                // Limbus note: toss result for current coin is attackTosses[i]
                isHeads = attackTosses[i];
            }
            if (isHeads) {
                this.triggerEvent('[Heads]', context, [unitDefender]);
            this.processStatusEffects(unitAttacker, 'on_heads', context);
            } else {
                this.triggerEvent('[Tails]', context, [unitDefender]);
            this.processStatusEffects(unitAttacker, 'on_tails', context);
            }

            result.attackLogs.push({
                attackPower: attackPower,
                attackTosses: attackTosses
            });

            // Handle Crashable Guard Mitigation
            if (options.clashResult === 'Win' && options.mitigationPenalty !== undefined) {
                // The attacker's power was permanently mitigated by the Clashable Guard for this attack sequence.
                // Replace attackPower with mitigatedPower if provided. We apply mitigation mathematically.
                // It makes sense that mitigation reduces the attackPower, not below 0 though.
                // If it's a completely mitigated hit, attack power would be 0. We'll use Math.max to prevent negative power.
                // The instructions say "reduce el Poder Final del atacante en una cantidad igual a su propio resultado... para el resto de los golpes secuenciales de ese turno".
                // Since mitigatedPower was already calculated as max(0, attackerPower - guardPower) in clash resolution,
                // wait, if we are recalculating power here, we should apply a flat penalty.
                // Let's modify options to hold mitigationPenalty instead, or just subtract here.
                if (options.mitigationPenalty) {
                    attackPower = Math.max(0, attackPower - options.mitigationPenalty);
                }
            }

            // Apply damage physically to process HP and Stagger states
            let clashCount = options.clashCount || 0; // options.clashCount could be passed if from a clash, else 0

            // 1. Modulo de Tasa Critica (Crit Rate & Poise)
            let baseCritRate = 0.05;
            let poiseBonus = 0;

            // Poise del atacante
            if (unitAttacker.statusEffects && unitAttacker.statusEffects['poise']) {
                let p_count = typeof unitAttacker.statusEffects['poise'] === 'object' ? (unitAttacker.statusEffects['poise'].count || 1) : unitAttacker.statusEffects['poise'];
                poiseBonus = p_count * 0.05;
            }

            // Vulnerabilidad Critica del Defensor
            let critVulnerabilityBonus = 0;
            if (unitDefender.statusEffects) {
                let activeStatuses = Object.keys(unitDefender.statusEffects);
                for (let statusId of activeStatuses) {
                    let statusConfig = null;
                    if (typeof window !== 'undefined' && window.STATUS_REGISTRY) statusConfig = window.STATUS_REGISTRY[statusId];
                    if (!statusConfig && typeof STATUS_REGISTRY !== 'undefined') statusConfig = STATUS_REGISTRY[statusId];

                    if (statusConfig && statusConfig.crit_vulnerability_per_count) {
                        let statusInstance = unitDefender.statusEffects[statusId];
                        let count = typeof statusInstance === 'object' ? (statusInstance.count || 1) : (typeof statusInstance === 'number' ? statusInstance : 1);
                        critVulnerabilityBonus += (statusConfig.crit_vulnerability_per_count * count);
                    }
                }
            }

            let finalCritRate = baseCritRate + poiseBonus + critVulnerabilityBonus;
            let isCritical = Math.random() < finalCritRate;

            let finalDamage = this.calculateCoinDamage(unitAttacker, unitDefender, attackSkill, attackPower, isCritical, clashCount, context);

            let hpBeforeHit = unitDefender.hp;
            let applyDmgResult = this.applyDamage(unitDefender, finalDamage, 'directo', isCritical, attackSkill);
            this.processStatusEffects(unitDefender, 'getting_hit', context);
            context.damageDealt = finalDamage;

            this.triggerEvent('[On Hit]', context, [unitDefender]);

            if (isHeads) {
                this.triggerEvent('[Heads Hit]', context, [unitDefender]);
                this.processStatusEffects(unitAttacker, 'on_heads', context);
            } else if (!isHeads && currentCoin.status !== 'latent') { // Latent has no toss, so it isn't tails
                this.triggerEvent('[Tails Hit]', context, [unitDefender]);
                this.processStatusEffects(unitAttacker, 'on_tails', context);
            }

            if (isCritical) {
                this.triggerEvent('[On Crit]', context, [unitDefender]);
                this.processStatusEffects(unitAttacker, 'on_crit', context);
                if (isHeads) {
                    this.triggerEvent('[On Crit - Heads Hit]', context, [unitDefender]);
                } else if (!isHeads && currentCoin.status !== 'latent') {
                    this.triggerEvent('[On Crit - Tails Hit]', context, [unitDefender]);
                }
            }

            if (hpBeforeHit > 0 && unitDefender.hp <= 0) {
                this.triggerEvent('[On Kill]', context, [unitDefender]);
                if (isCritical) {
                    this.triggerEvent('[On Crit Kill]', context, [unitDefender]);
                    if (unitAttacker.faccion !== unitDefender.faccion) {
                        this.triggerEvent('[On Crit Kill Against Enemy]', context, [unitDefender]);
                    }
                }
            }

            // If they just won a clash
            if (options.clashResult === 'Win') {
                this.triggerEvent('[On Clash Win]', context, [unitDefender]);
                this.triggerEvent('[Hit after Clash Win]', context, [unitDefender]);
            } else if (options.clashResult === 'Lose') {
                this.triggerEvent('[On Clash Lose]', context, [unitDefender]);

                // Exclusivo para Monedas Rojas (Unbreakable)
                if (currentCoin.type === 'unbreakable') {
                    this.triggerEvent('[Hit after Clash Lose]', context, [unitDefender]);
                }
            }

            // Exclusivo para Monedas Rojas sin romperse (status sigue 'active', no ha pasado a 'latent')
            if (currentCoin.type === 'unbreakable' && currentCoin.status === 'active') {
                this.triggerEvent('[On Hit without Cracking]', context, [unitDefender]);
            }

            this.triggerEvent('[Current Coin Attack End]', context, [unitDefender]);

            if (unitDefender.isStaggered) {
                result.defenderStaggered = true;
                break; // Stop evaluating further coins if staggered
            }
        }

        this.triggerEvent('[Attack End]', context, [unitDefender]);

        // Final Triggers strictly for 1-coin skills
        if (attackSkill.coins && attackSkill.coins.length === 1) {
            let singleCoin = attackSkill.coins[0];
            context.currentCoin = singleCoin; // Explicitly set it just in case
            if (activeAttackCoins.length === 1 && activeAttackCoins[0] === singleCoin) {
                // If it was heads, fire Heads Attack End. We tracked currentCoinToss earlier, let's use the local context state if available or deduce it
                // isHeads was local to the loop, we'll retrieve it if possible or deduce from context. Let's look up how isHeads is tracked... it's attackTosses[0]
                let finalTossIsHeads = false;
                if (result.attackLogs.length > 0) {
                     let lastLog = result.attackLogs[result.attackLogs.length - 1];
                     if (lastLog.attackTosses && lastLog.attackTosses.length > 0) {
                         finalTossIsHeads = lastLog.attackTosses[0];
                     }
                }

                if (finalTossIsHeads) {
                    this.triggerEvent('[Heads Attack End]', context, [unitDefender]);
                } else if (singleCoin.status !== 'latent') {
                    this.triggerEvent('[Tails Attack End]', context, [unitDefender]);
                }
            }
        }


                if (!unitDefender.isStaggered) {
            result.pendingActions.push({
                type: 'counter',
                unit: unitDefender,
                target: unitAttacker,
                skill: counterSkill
            });
        }

        // Cortafuegos y Retargeting: Reuse Skill
        let skillReused = options.skill_reused || false;
        let hasReuseGlobalEffect = false;
        if (attackSkill.effects) {
             hasReuseGlobalEffect = attackSkill.effects.some(eff => eff.is_reuse);
        }

        if (hasReuseGlobalEffect && !skillReused && unitDefender.hp <= 0 && options.combatants) {
             let aliveEnemies = options.combatants.filter(c => c.faccion !== unitAttacker.faccion && c.hp > 0);
             if (aliveEnemies.length > 0) {
                  let newTarget = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
                  let nextOptions = Object.assign({}, options, { skipUseHooks: true, skill_reused: true });
                  let retargetResult = this.resolveUnilateralWithCounter(unitAttacker, attackSkill, newTarget, null, nextOptions);

                  // Combinar resultados (o simplemente agregar logs)
                  result.attackLogs = result.attackLogs.concat(retargetResult.attackLogs);
                  result.damageTaken += retargetResult.damageTaken;
             }
        }

        return result;
    },

    resolveEvade: function(unitDefender, evadeSkill, unitAttacker, attackSkill) {
        if (unitDefender && unitDefender.evade_sprite) {
            unitDefender.current_sprite = unitDefender.evade_sprite;
        }
        let result = {
            evadeLogs: [],
            evadeDestroyed: false,
            pendingActions: [],
            damageTaken: 0, // Sum of damages from coins that beat the evade
            coinsBeaten: [] // The attack coins that hit the defender
        };

        if (!evadeSkill.coins) {
            evadeSkill.coins = Array.from({length: evadeSkill.coinAmount}, () => ({ type: evadeSkill.coinType || 'standard', status: 'active' }));
        }
        if (!attackSkill.coins) {
            attackSkill.coins = Array.from({length: attackSkill.coinAmount}, () => ({ type: attackSkill.coinType || 'standard', status: 'active' }));
        }

        let activeAttackCoins = attackSkill.coins.filter(c => c.status === 'active' || c.status === 'cracked');
        let probDefender = this.getCoinProbability(unitDefender.sp || 0);
        let probAttacker = this.getCoinProbability(unitAttacker.sp || 0);

        for (let i = 0; i < activeAttackCoins.length; i++) {
            let attackCoin = activeAttackCoins[i];

            // Roll Evade
            let evadeTosses = evadeSkill.coins.map(c => c.status === 'active' ? (Math.random() * 100 < probDefender) : true);
            let evadePower = this.calculateFinalPower(evadeSkill, evadeTosses, unitDefender);

            // Roll Attack (only rolling the current coin + previous coins are usually evaluated as well,
            // but in Evade vs Attack, the attacker usually rolls all their remaining coins for power)
            // Limbus Rule: Attacker rolls ALL active coins for power. We will roll all active/cracked for the attacker.
            let attackTosses = activeAttackCoins.map(c => c.status === 'active' ? (Math.random() * 100 < probAttacker) : true);
            let attackPower = this.calculateFinalPower(attackSkill, attackTosses, unitAttacker);

            let log = {
                evadePower: evadePower,
                attackPower: attackPower,
                evadeTosses: evadeTosses,
                attackTosses: attackTosses
            };


            if (evadePower >= attackPower) {
                // Evade successful
                log.result = 'Evaded';
                result.evadeLogs.push(log);

                let context = { engine: this, defender: unitDefender, attacker: unitAttacker, skill: evadeSkill, attackSkill: attackSkill };

                if (evadeSkill.coins && evadeSkill.coins.length > 0) {
                    context.currentCoin = evadeSkill.coins[0];
                }

                this.triggerEvent('[On Evade]', context, [unitAttacker]);

                // Evade is not consumed, move to next attack coin (if any)
            } else {

                // Evade failed
                log.result = 'Hit';
                result.evadeLogs.push(log);
                result.evadeDestroyed = true;

                // Attack hits, calculate damage and stop evade processing
                // The remaining coins (including this one) will hit the defender.
                let remainingHitCoins = activeAttackCoins.slice(i);
                result.coinsBeaten = remainingHitCoins;

                // Evade is destroyed
                evadeSkill.coins.forEach(c => c.status = 'broken');
                break;
            }
        }

        // If the defender has cracked coins and an evade was destroyed, they don't get to counter with cracked coins in Evade logic usually,
        // but we'll stick to the rule: "Si una unidad sobrevive a un choque y tiene monedas en estado 'cracked' Y además tiene un 'Counter'... "
        // Evade doesn't trigger cracked coin counter since evade doesn't lose a clash, it just gets destroyed. We leave pendingActions empty for Evade.

        return result;
    },

    resolveStandardClash: function(unitA, skillA, unitB, skillB) {
        if (this.currentState === 'PRE_COMBAT_PLANNING') return { logs: [{ message: 'Clash blocked during Planning Phase.', class: 'error' }], clashWinner: null, damageResult: null };
        // [Unclashable bypass fallback]
        // The driver should theoretically not call resolveStandardClash if either skill is isUnclashable.
        // But if it does, we can return a flag telling it to bypass, or handle it as Unilateral.
        if (skillA.isUnclashable || skillB.isUnclashable) {
            return {
                winner: 'Unclashable',
                clashLogs: [{ note: 'Clash bypassed due to isUnclashable flag. Evaluate as unilateral attacks.' }],
                pendingActions: []
            };
        }

        let result = {
            winner: null,
            clashLogs: [],
            counterAttackPending: false,
            crackedCoinsToUse: null // Will hold the 'cracked' coins if counter attack is triggered
        };


        // Ensure skills have coins initialized (backward compatibility fallback)
        if (!skillA.coins) {
            skillA.coins = Array.from({length: skillA.coinAmount}, () => ({ type: skillA.coinType || 'standard', status: 'active', effects: [] }));
        }
        if (!skillB.coins) {
            skillB.coins = Array.from({length: skillB.coinAmount}, () => ({ type: skillB.coinType || 'standard', status: 'active', effects: [] }));
        }

        let contextA = { engine: this, attacker: unitA, defender: unitB, skill: skillA, targetsHit: [unitB] };
        let contextB = { engine: this, attacker: unitB, defender: unitA, skill: skillB, targetsHit: [unitA] };

        // [Before Use]
        this.triggerEvent('[Before Use]', contextA, [unitB]);
        this.triggerEvent('[Before Use]', contextB, [unitA]);

        // [On Use]
        this.triggerEvent('[On Use]', contextA, [unitB]);
        this.triggerEvent('[On Use]', contextB, [unitA]);

        // [Clash Start]
        this.triggerEvent('[Clash Start]', contextA, [unitB]);
        this.triggerEvent('[Clash Start]', contextB, [unitA]);
        this.triggerEvent('[Before Clash]', contextA, [unitB]);
        this.triggerEvent('[Before Clash]', contextB, [unitA]);


        let round = 1;

        while (true) {
            let activeCoinsA = skillA.coins.filter(c => c.status === 'active');
            let activeCoinsB = skillB.coins.filter(c => c.status === 'active');

            // Mark reused coins if they were already used in a previous round
            if (round > 1) {
                if (activeCoinsA.length === 1 && skillA.coinAmount === 1) activeCoinsA[0].isReused = true;
                if (activeCoinsB.length === 1 && skillB.coinAmount === 1) activeCoinsB[0].isReused = true;
            }

            if (activeCoinsA.length === 0 && activeCoinsB.length === 0) {
                result.winner = 'Tie';
                break;
            } else if (activeCoinsA.length === 0) {
                result.winner = 'B';
                break;
            } else if (activeCoinsB.length === 0) {
                result.winner = 'A';
                break;
            }

            // Generate toss results for active + cracked coins (cracked always auto-heads in power calc, but we still pass an array)
            // Actually, calculateFinalPower only cares about the toss results for 'active' coins.
            // But we need to pass a boolean array that matches the length of (active + cracked) coins.

            let allUsableA = skillA.coins.filter(c => c.status === 'active' || c.status === 'cracked');
            let allUsableB = skillB.coins.filter(c => c.status === 'active' || c.status === 'cracked');

            let probA = this.getCoinProbability(unitA.sp || 0);
            let probB = this.getCoinProbability(unitB.sp || 0);

            let tossesA = allUsableA.map(c => c.status === 'active' ? (Math.random() * 100 < probA) : true);
            let tossesB = allUsableB.map(c => c.status === 'active' ? (Math.random() * 100 < probB) : true);

            let powerA = this.calculateFinalPower(skillA, tossesA, unitA);
            let powerB = this.calculateFinalPower(skillB, tossesB, unitB);

            if (!skillA.isDefense) powerA += (this.applyPassiveModifiers(unitA, { skill: skillA }).clash_power || 0);
            if (!skillB.isDefense) powerB += (this.applyPassiveModifiers(unitB, { skill: skillB }).clash_power || 0);

            let roundWinner = powerA > powerB ? 'A' : (powerB > powerA ? 'B' : 'Tie');

            result.clashLogs.push({
                round: round,
                powerA: powerA,
                powerB: powerB,
                tossesA: tossesA,
                tossesB: tossesB,
                winner: roundWinner
            });

            // FIFO Coin Destruction Logic (from 'I' to 'V')
            const processLoss = (loserSkill, winnerSkill) => {
                // Find the first active coin
                for (let i = 0; i < loserSkill.coins.length; i++) {
                    if (loserSkill.coins[i].status === 'active') {
                        let loserCoin = loserSkill.coins[i];
                        let winnerActiveCoins = winnerSkill ? winnerSkill.coins.filter(c => c.status === 'active') : [];
                        let winningCoinType = winnerActiveCoins.length > 0 ? winnerActiveCoins[0].type : 'standard';

                        if (loserCoin.type === 'unbreakable') {
                            // Unbreakable Doctrine: Red Coins become 'latent' on clash loss, power reduced to 1 for hit
                            loserCoin.status = 'latent';
                        } else if (loserCoin.type === 'excision') {
                            loserCoin.status = 'cracked';
                        } else {
                            loserCoin.status = 'broken';
                        }
                        break;
                    }
                }
            };

            if (roundWinner === 'A') {
                processLoss(skillB, skillA);
            } else if (roundWinner === 'B') {
                processLoss(skillA, skillB);
            } else {
                // In a tie, both lose a coin (standard Limbus rules, though 'Tie' usually means continue without loss until parry limit)
                // Assuming standard clash rules: tie means no coins are destroyed in standard, they just re-clash.
                // However, to prevent infinite loops if they always tie, we need a tie-breaker or parry limit.
                // If the user wants standard rules, ties destroy no coins. We will add a parry limit.
            }

            // To prevent infinite ties, introduce a limit
            if (round >= 99) {
                result.winner = 'Tie';
                break;
            }
            round++;
        }


        // Event hooks for Clash Win/Lose
        if (result.winner === 'A') {
            this.triggerEvent('[On Clash Win]', contextA, [unitB]);
            this.triggerEvent('[On Clash Lose]', contextB, [unitA]);
        } else if (result.winner === 'B') {
            this.triggerEvent('[On Clash Win]', contextB, [unitA]);
            this.triggerEvent('[On Clash Lose]', contextA, [unitB]);
        }

        result.pendingActions = [];

        // Setup counter-attack if the loser has cracked coins

        let loserSkill = result.winner === 'A' ? skillB : (result.winner === 'B' ? skillA : null);
        let loserUnit = result.winner === 'A' ? unitB : (result.winner === 'B' ? unitA : null);
        let winnerSkill = result.winner === 'A' ? skillA : (result.winner === 'B' ? skillB : null);
        let winnerUnit = result.winner === 'A' ? unitA : (result.winner === 'B' ? unitB : null);

        // Sanity (SP) Gain for Winner and UI Logger Custom Event
        let actualClashCount = result.clashLogs.length;

        if (winnerUnit) { // Simple check to ensure we have a unit
            let spGain = 10 + actualClashCount;
            winnerUnit.sp = winnerUnit.sp !== undefined ? winnerUnit.sp : 0;
            winnerUnit.sp = this.limitSP(winnerUnit.sp + spGain);
            this.checkSanityStates(winnerUnit);

            let bonoPorcentaje = 3 + (3 * actualClashCount);

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('logCombate', {
                    detail: {
                        tipo: 'clash_result',
                        mensaje: `[ RESOLUCIÓN DE CHOQUE ] - ${winnerUnit.name || 'Unidad'} domina el duelo.`,
                        data: { clashCount: actualClashCount, bonoPorcentaje: bonoPorcentaje, spGanado: spGain }
                    }
                }));
            }
        }

        if (loserSkill && loserUnit) {
            let crackedCoins = loserSkill.coins.filter(c => c.status === 'cracked');
            if (crackedCoins.length > 0) {
                result.counterAttackPending = true;
                result.crackedCoinsToUse = crackedCoins;
                result.pendingActions.push({
                    type: 'cracked_attack',
                    unit: loserUnit,
                    target: winnerUnit,
                    skill: loserSkill,
                    coins: crackedCoins
                });
            }
        }

        // Handle ClashableGuard logic
        if (winnerSkill && winnerSkill.type === 'ClashableGuard') {
            // If ClashableGuard wins, increase target's Stagger Threshold (Tremor effect) by Final Power
            // Note: In standard clash logs, we need the final power of the winning skill in the last round.
            let lastLog = result.clashLogs[result.clashLogs.length - 1];
            let guardPower = result.winner === 'A' ? lastLog.powerA : lastLog.powerB;
            this.modifyNextStaggerThreshold(loserUnit, guardPower);
            result.clashableGuardTremorApplied = guardPower;
        } else if (loserSkill && loserSkill.type === 'ClashableGuard') {
            // If ClashableGuard loses, calculate mitigated power
            let lastLog = result.clashLogs[result.clashLogs.length - 1];
            let guardPower = result.winner === 'A' ? lastLog.powerB : lastLog.powerA;
            // The penalty to the attacker's final power is equal to the guard's final power.
            result.mitigationPenalty = guardPower;
            result.mitigationApplied = true;
        }

        // We will push counter attack to pendingActions outside this function when processing unilateral attacks
        // since Counters wait for the attack to finish. But if ClashableCounter is involved in a clash, it acts as normal attack.

        return result;
    },

    resolveRollClash: function(skillA, headsA, skillB, headsB, unitA, unitB) {
        let powerA = this.calculateFinalPower(skillA, headsA, unitA);
        let powerB = this.calculateFinalPower(skillB, headsB, unitB);

        let winner = powerA > powerB ? 'A' : (powerB > powerA ? 'B' : 'Tie');

        // Híbrido D&D: Determinar si es un Roll vs Ataque normal
        let isRollVsAttack = (skillA.type === 'Roll' && (skillB.type !== 'Roll' && skillB.type !== 'Spell' && skillB.type !== 'Save')) ||
                             (skillB.type === 'Roll' && (skillA.type !== 'Roll' && skillA.type !== 'Spell' && skillA.type !== 'Save'));

        let message = `Roll A (${powerA}) vs Roll B (${powerB}). Winner: ${winner}`;

        if (isRollVsAttack) {
            if (winner === 'A') {
                if (skillA.type === 'Roll') {
                    message += ` (Roll wins! Stops normal attack. No damage applied automatically. DM discretion required.)`;
                } else {
                    message += ` (Normal attack wins! Applies normal damage.)`;
                }
            } else if (winner === 'B') {
                if (skillB.type === 'Roll') {
                    message += ` (Roll wins! Stops normal attack. No damage applied automatically. DM discretion required.)`;
                } else {
                    message += ` (Normal attack wins! Applies normal damage.)`;
                }
            } else {
                message += ` (Tie! Both sides cancel out.)`;
            }
        }

        return {
            pendingActions: [],
            powerA: powerA,
            powerB: powerB,
            winner: winner,
            isRollVsAttack: isRollVsAttack,
            message: message
        };
    },

    calculateFinalPower: function(skill, headsFlipped, unit = null) {
        // Defensive Skill Scaling Intercept
        let basePowerOverride = null;
        let coinPowerOverride = null;

        if (skill.isDefense && unit && unit.stats) {
            if (skill.defenseSubtype === 'Evade') {
                const dex = unit.stats['destreza'] !== undefined ? unit.stats['destreza'] : 10;
                basePowerOverride = Math.floor((dex - 10) / 2); // D&D Modifier
                coinPowerOverride = dex; // Raw Stat
            } else {
                // Counter, ClashableCounter use Fuerza, Guard, ClashableGuard use Constitución
                const statKey = (skill.defenseSubtype === 'Counter' || skill.defenseSubtype === 'ClashableCounter') ? 'fuerza' : 'constitucion';
                const statVal = unit.stats[statKey] !== undefined ? unit.stats[statKey] : 10;
                basePowerOverride = Math.floor((statVal - 10) / 2); // D&D Modifier
                coinPowerOverride = statVal; // Raw Stat
            }
        }

        let passiveMods = unit ? this.applyPassiveModifiers(unit, { skill: skill }) : {};
        let finalActualBasePower = basePowerOverride !== null ? basePowerOverride : skill.basePower;
        let finalActualCoinPower = coinPowerOverride !== null ? coinPowerOverride : skill.coinPower;
        let finalPowerBonus = 0;

        if (skill.isDefense) {
            finalActualBasePower += (passiveMods.defense_power || 0);
            if (skill.defenseSubtype === 'ClashableGuard' || skill.defenseSubtype === 'ClashableCounter') {
                 finalActualBasePower += (passiveMods.clash_power || 0);
            }
        } else {
            finalActualBasePower += (passiveMods.base_power || 0);
            finalActualCoinPower += (passiveMods.coin_power || 0);
            finalPowerBonus += (passiveMods.final_power || 0);
        }

        const actualBasePower = finalActualBasePower;
        const actualCoinPower = finalActualCoinPower;

        if (typeof headsFlipped === 'number') {
            // No se puede aplicar paralisis de forma secuencial en una tirada agregada sin desglose,
            // pero para mantener consistencia matematica, si hay paralisis, anulamos X monedas simuladas.
            let power = actualBasePower;
            let effectiveHeads = headsFlipped;
            if (unit && unit.statusEffects && unit.statusEffects['paralyze'] && unit.statusEffects['paralyze'].count > 0) {
                // Simplificacion para casos donde headsFlipped es un numero entero
                let paralyzeCount = unit.statusEffects['paralyze'].count;
                let paralyzedCoins = Math.min(effectiveHeads, paralyzeCount);
                effectiveHeads -= paralyzedCoins;
                unit.statusEffects['paralyze'].count -= paralyzedCoins;
                if (unit.statusEffects['paralyze'].count <= 0) {
                    delete unit.statusEffects['paralyze'];
                }
            }
            return power + (effectiveHeads * actualCoinPower) + finalPowerBonus;
        }

        if (Array.isArray(headsFlipped)) {
            let totalPower = actualBasePower;
            let activeOrCrackedCoins = skill.coins ? skill.coins.filter(c => c.status === 'active' || c.status === 'cracked') : [];

            for (let i = 0; i < headsFlipped.length; i++) {
                let coinResult = headsFlipped[i];
                let coin = activeOrCrackedCoins[i];

                if (!coin) continue;

                // Determinar si la moneda salio Cara o es una moneda agrietada (cracked) que actua como Cara
                let isHeads = false;
                if (coin.status === 'active' && coinResult) {
                    isHeads = true;
                } else if (coin.status === 'cracked') {
                    isHeads = true;
                }

                // Intercepcion de Paralisis (Paralyze)
                let powerModifier = 0;
                if (coin.status === 'active') {
                    powerModifier = actualCoinPower;
                } else if (coin.status === 'cracked') {
                    powerModifier = actualCoinPower < 0 ? -1 : 1;
                }

                if (isHeads) {
                    // Si la moneda es Cara, verificar si hay Paralisis activa
                    if (unit && unit.statusEffects && unit.statusEffects['paralyze'] && unit.statusEffects['paralyze'].count > 0) {
                        // La Paralisis fuerza el modificador a 0
                        powerModifier = 0;
                        // Consumir carga de Paralisis
                        unit.statusEffects['paralyze'].count--;
                        if (unit.statusEffects['paralyze'].count <= 0) {
                            delete unit.statusEffects['paralyze'];
                        }
                    }
                    totalPower += powerModifier;
                }
            }
            return totalPower + finalPowerBonus;
        }

        return actualBasePower + finalPowerBonus;
    },

    calculateAoETargets: function(skill, primaryTarget, allPossibleTargets) {
        if (!primaryTarget || !skill) return [];

        if (skill.targeting_type === 'Indiscriminate' && skill._cachedIndiscriminateTargets) {
            let hits = [primaryTarget];
            skill._cachedIndiscriminateTargets.forEach(t => {
                if (t.hp > 0) hits.push(t);
            });
            return hits;
        }

        let remainingWeight = (skill.atkWeight || 1) - (primaryTarget.slotWeight || 1);
        let targetsHit = [primaryTarget];

        if (remainingWeight <= 0) return targetsHit;

        // Remove primary target from pool
        let possibleTargets = allPossibleTargets.filter(t => t !== primaryTarget && t.hp > 0);

        // Ensure everyone has grid_pos
        possibleTargets = possibleTargets.filter(t => t.grid_pos);
        if (!primaryTarget.grid_pos) return targetsHit;

        let cx = primaryTarget.grid_pos.x;
        let cy = primaryTarget.grid_pos.y;

        // Calculate exact distance to epicenter
        possibleTargets.forEach(t => {
            t._distToEpicenter = Math.sqrt(Math.pow(t.grid_pos.x - cx, 2) + Math.pow(t.grid_pos.y - cy, 2));
        });

        // Group by distance
        let grouped = {};
        possibleTargets.forEach(t => {
            let d = t._distToEpicenter.toFixed(4); // Use fixed precision for float ties
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(t);
        });

        // Sort distances ascending
        let sortedDistances = Object.keys(grouped).map(Number).sort((a, b) => a - b);

        for (let d of sortedDistances) {
            if (remainingWeight <= 0) break;

            let group = grouped[d.toFixed(4)];
            if (group.length <= remainingWeight) {
                // Everyone in this distance group gets hit
                group.forEach(t => {
                    targetsHit.push(t);
                    remainingWeight -= (t.slotWeight || 1);
                });
            } else {
                // RNG tiebreaker for remaining weight
                let shuffled = group.sort(() => 0.5 - Math.random());
                for (let i = 0; i < remainingWeight && i < shuffled.length; i++) {
                    targetsHit.push(shuffled[i]);
                }
                remainingWeight = 0; // Depleted
            }
        }

        return targetsHit;
    },

    triggerEvent: function(tag, context, targetsHit = []) {
        if (context && context.unitAttacker && context.unitAttacker.moving_sprite && (tag === '[On Attack]' || tag === '[Clash Start]')) {
            context.unitAttacker.current_sprite = context.unitAttacker.moving_sprite;
        }

        if (!context || !context.skill) return;

        // Collect all effects that match the tag from the skill root
        let applicableEffects = [];
        if (context.skill.effects) {
            applicableEffects.push(...context.skill.effects.filter(e => e.tag === tag));
        }

        // For some global tags, we need to scan all active coins in the skill
        let globalCoinTags = ['[Before Attack]', '[On Unopposed Attack]', '[Attack End]', '[Heads Attack End]', '[Tails Attack End]', '[Before Getting Hit]'];
        if (globalCoinTags.includes(tag) && context.skill.coins) {
            for (let coin of context.skill.coins) {
                if (coin.status === 'active' || coin.status === 'cracked' || coin.status === 'latent') {
                    if (coin.effects) {
                        applicableEffects.push(...coin.effects.filter(e => e.tag === tag));
                    }
                }
            }
        }

        // If context has a currentCoin, collect effects from that coin too
        if (context.currentCoin && context.currentCoin.effects) {
            applicableEffects.push(...context.currentCoin.effects.filter(e => e.tag === tag));
        }

        if (applicableEffects.length === 0) return;

        // Apply Boolean Architecture Filters (Reuse and Ally)
        applicableEffects = applicableEffects.filter(e => {
            // Filter by Reuse
            if (e.is_reuse && (!context.currentCoin || !context.currentCoin.isReused)) {
                return false;
            }
            return true;
        });

        if (applicableEffects.length === 0) return;

        // If it's a targeted event (like [On Hit]), it accumulates per target hit
        let executionTargets = targetsHit.length > 0 ? targetsHit : [context.defender || null];

        for (let target of executionTargets) {
            if (!target) continue; // Si no hay objetivo aplicable (por ejemplo, Before Use puede no tener objetivo definido aún en algunos contextos, o es global)

            // Set the current target in context for the effect to know who is being evaluated
            context.currentTarget = target;

            for (let effect of applicableEffects) {
                // Apply Ally Filter
                if (effect.target_ally) {
                    let execTarget = effect.target === 'self' ? context.attacker : target;
                    if (!context.attacker || !execTarget || context.attacker.faccion !== execTarget.faccion) {
                        continue; // Skip if they are not allies
                    }
                }

                // --- CONDITION VALIDATION ---
                let conditionPassed = true;
                if (effect.condition) {
                    let condTargetUnit = effect.condition.target === 'self' ? context.attacker : context.currentTarget;
                    if (condTargetUnit) {
                        let statVal = 0;
                        if (effect.condition.stat === 'HP') {
                            statVal = condTargetUnit.hp || 0;
                        } else if (effect.condition.stat === 'SP') {
                            statVal = condTargetUnit.sp || 0;
                        } else if (effect.condition.stat === 'took_damage_this_turn') {
                            statVal = condTargetUnit.took_damage_this_turn ? 1 : 0;
                        } else if (effect.condition.stat === 'took_damage_last_turn') {
                            statVal = condTargetUnit.took_damage_last_turn ? 1 : 0;
                        } else if (effect.condition.stat === 'took_no_damage_this_turn') {
                            statVal = condTargetUnit.took_damage_this_turn ? 0 : 1;
                        } else if (effect.condition.stat === 'took_no_damage_last_turn') {
                            statVal = condTargetUnit.took_damage_last_turn ? 0 : 1;
                        } else {
                            // Status effect check
                            let statusObj = condTargetUnit.statusEffects && condTargetUnit.statusEffects[effect.condition.stat];
                            if (statusObj) {
                                statVal = typeof statusObj === 'number' ? statusObj : (statusObj.potency || statusObj.count || 0);
                            } else {
                                statVal = 0;
                            }
                        }

                        let op = effect.condition.operator;
                        let val = effect.condition.value;
                        if (op === 'equal to' && statVal !== val) conditionPassed = false;
                        else if (op === 'more than' && statVal <= val) conditionPassed = false;
                        else if (op === 'less than' && statVal >= val) conditionPassed = false;
                    } else {
                        conditionPassed = false; // Cannot evaluate condition if target doesn't exist
                    }
                }

                if (!conditionPassed) {
                    continue; // Condition failed, skip this effect
                }


                // --- TIMING VALIDATION ---
                if (effect.timing === 'next_turn') {
                    let delayTargetUnit = effect.target === 'self' ? context.attacker : context.currentTarget;
                    if (delayTargetUnit) {
                        if (!delayTargetUnit.delayed_effects) {
                            delayTargetUnit.delayed_effects = [];
                        }
                        delayTargetUnit.delayed_effects.push({
                            effect: effect,
                            attacker: context.attacker,
                            defender: context.defender,
                            skill: context.skill,
                            currentCoin: context.currentCoin
                        });
                    }
                    continue; // Skip immediate execution
                }

                if (effect.type === 'scale_power') {
                    let scaleAmount = 0;
                    let checkUnit = effect.target === 'self' ? context.attacker : context.currentTarget;
                    if (checkUnit) {
                        if (effect.scaleCondition === 'negative_types') {
                            if (checkUnit.statusEffects) {
                                let negTypes = 0;
                                for (let sId in checkUnit.statusEffects) {
                                    let sConf = (window.STATUS_REGISTRY && window.STATUS_REGISTRY[sId]) || (typeof STATUS_REGISTRY !== 'undefined' ? STATUS_REGISTRY[sId] : null);
                                    if (sConf && sConf.type === 'negative') negTypes++;
                                }
                                scaleAmount = negTypes;
                            }
                        } else {
                            let sId = effect.status;
                            let statVal = 0;
                            if (checkUnit.statusEffects && checkUnit.statusEffects[sId]) {
                                let statusObj = checkUnit.statusEffects[sId];
                                if (effect.scaleCondition === 'status_count') {
                                    statVal = typeof statusObj === 'number' ? statusObj : (statusObj.count || 0);
                                } else {
                                    statVal = typeof statusObj === 'number' ? statusObj : (statusObj.potency || statusObj.count || 0);
                                }
                            }
                            scaleAmount = Math.floor(statVal / (effect.potency || 1));
                        }

                        if (effect.maxCap && effect.maxCap > 0) {
                            scaleAmount = Math.min(scaleAmount, effect.maxCap);
                        }

                        if (scaleAmount > 0) {
                            if (!context.modifiers) context.modifiers = {};
                            let targetAttr = effect.scaleTarget || 'base_power';
                            if (!context.modifiers[targetAttr]) context.modifiers[targetAttr] = 0;
                            context.modifiers[targetAttr] += scaleAmount;
                        }
                    }
                }

                if (typeof effect.execute === 'function') {

                    effect.execute(context);
                }

                // Si el efecto aplicado tiene un status, checar si es instant
                if (effect.status) {
                    let targetUnit = (effect.target === 'self') ? context.attacker : context.currentTarget;
                    if (targetUnit) {
                        this.processStatusEffects(targetUnit, 'instant', context);
                    }
                }

            }
        }
    },



    applyPassiveModifiers: function(unit, contextOptions = null) {
        if (!unit || !unit.statusEffects) return {};

        let modifiers = {
            damage_dealt_multiplier: 0,
            damage_taken_multiplier: 0,
            healing_multiplier: 0,
            final_power: 0,
            base_power: 0,
            defense_power: 0,
            clash_power: 0,
            offensive_level: 0,
            defensive_level: 0,
            speed: 0,
            resource: 0,
            coin_power: 0,
            crit_damage_multiplier: 0
        };

        const activeStatuses = Object.keys(unit.statusEffects);

        for (let statusId of activeStatuses) {
            let statusConfig = null;

            if (typeof window !== 'undefined' && window.STATUS_REGISTRY) {
                statusConfig = window.STATUS_REGISTRY[statusId];
            }
            if (!statusConfig && typeof STATUS_REGISTRY !== 'undefined') {
                statusConfig = STATUS_REGISTRY[statusId];
            }

            if (!statusConfig || !statusConfig.rules) continue;

            let statusInstance = unit.statusEffects[statusId];

            for (let rule of statusConfig.rules) {
                if (rule.trigger !== 'passive') continue;

                // 2 & 3. Segregacion de etiquetas de Damage y Power Up
                if (contextOptions && contextOptions.skill) {
                    let skill = contextOptions.skill;

                    if (statusConfig.damage_type_tag) {
                        let skillDamageType = skill.damageType || skill.type;
                        if (skillDamageType !== statusConfig.damage_type_tag) {
                            continue; // Validacion falla, ignorar regla
                        }
                    }
                    if (statusConfig.sin_affinity_tag) {
                        let skillAffinity = skill.affinity;
                        if (skillAffinity !== statusConfig.sin_affinity_tag) {
                            continue; // Validacion falla, ignorar regla
                        }
                    }
                }

                let potency = typeof statusInstance === 'object' ? (statusInstance.potency || 1) : 1;
                let count = typeof statusInstance === 'object' ? (statusInstance.count || 1) : (typeof statusInstance === 'number' ? statusInstance : 1);

                let baseVar = rule.cond_type === 'potency' ? potency : count;
                let factor = Math.floor(baseVar / (rule.cond_input || 1));

                let effectValue = factor * (rule.aff_input !== undefined ? rule.aff_input : 1);

                let affectation = rule.affectation;
                if (modifiers[affectation] !== undefined) {
                    if (rule.operation === 'add') modifiers[affectation] += effectValue;
                    if (rule.operation === 'sub') modifiers[affectation] -= effectValue;
                    if (rule.operation === 'mult') {
                         if (modifiers[affectation] === 0) modifiers[affectation] = effectValue;
                         else modifiers[affectation] *= effectValue;
                    }
                    if (rule.operation === 'set') modifiers[affectation] = effectValue;
                }
            }
        }
        return modifiers;
    },

    processStatusEffects: function(unit, triggerKey, context = {}) {
        if (!unit || !unit.statusEffects) return;

        const activeStatuses = Object.keys(unit.statusEffects);

        for (let statusId of activeStatuses) {
            let statusConfig = null;

            if (typeof window !== 'undefined' && window.STATUS_REGISTRY) {
                statusConfig = window.STATUS_REGISTRY[statusId];
            }
            if (!statusConfig && typeof STATUS_REGISTRY !== 'undefined') {
                statusConfig = STATUS_REGISTRY[statusId];
            }

            if (!statusConfig || !statusConfig.rules) continue;

            let statusInstance = unit.statusEffects[statusId];

            for (let rule of statusConfig.rules) {
                if (rule.trigger !== triggerKey) continue;

                let potency = typeof statusInstance === 'object' ? (statusInstance.potency || 1) : 1;
                let count = typeof statusInstance === 'object' ? (statusInstance.count || 1) : (typeof statusInstance === 'number' ? statusInstance : 1);

                let baseVar = rule.cond_type === 'potency' ? potency : count;
                let factor = Math.floor(baseVar / (rule.cond_input || 1));

                let effectValue = factor * (rule.aff_input !== undefined ? rule.aff_input : 1);

                let finalDmg = 0;
                let affectation = rule.affectation;

                if (affectation && affectation !== '') {
                    // Legacy Fallback for older skills
                    let actualAffectation = affectation === 'damage_multiplier' ? 'damage_dealt_multiplier' : affectation;

                    if (actualAffectation === 'hp') {
                        finalDmg = effectValue;
                        if (rule.operation === 'sub') {
                            this.applyDamage(unit, finalDmg, 'efecto_estado');
                        } else if (rule.operation === 'add') {
                            unit.hp = Math.min(unit.hp + finalDmg, unit.maxHp || unit.hp);
                        } else if (rule.operation === 'set') {
                            unit.hp = Math.min(finalDmg, unit.maxHp || unit.hp);
                        }
                    } else if (actualAffectation === 'sp') {
                        if (rule.operation === 'sub') {
                            unit.sp = this.limitSP((unit.sp || 0) - effectValue);
                        } else if (rule.operation === 'add') {
                            unit.sp = this.limitSP((unit.sp || 0) + effectValue);
                        } else if (rule.operation === 'set') {
                            unit.sp = this.limitSP(effectValue);
                        }
                    } else if (actualAffectation === 'stagger_threshold') {
                         if (rule.operation === 'add') {
                             this.modifyNextStaggerThreshold(unit, effectValue);
                         } else if (rule.operation === 'sub') {
                             this.modifyNextStaggerThreshold(unit, -effectValue);
                         }
                    } else if (actualAffectation === 'damage_dealt_multiplier' || actualAffectation === 'damage_taken_multiplier' || actualAffectation === 'healing_multiplier' || actualAffectation === 'speed' || actualAffectation === 'resource' || actualAffectation === 'defensive_level' || actualAffectation === 'offensive_level' || actualAffectation === 'clash_power' || actualAffectation === 'coin_power' || actualAffectation === 'base_power' || actualAffectation === 'final_power' || actualAffectation === 'defense_power') {
                        if (context && typeof context === 'object') {
                            if (!context.modifiers) context.modifiers = {};
                            if (!context.modifiers[actualAffectation]) context.modifiers[actualAffectation] = 0;

                            if (rule.operation === 'add') context.modifiers[actualAffectation] += effectValue;
                            if (rule.operation === 'sub') context.modifiers[actualAffectation] -= effectValue;
                            if (rule.operation === 'mult') context.modifiers[actualAffectation] *= effectValue;
                            if (rule.operation === 'div' && effectValue !== 0) context.modifiers[actualAffectation] /= effectValue;
                            if (rule.operation === 'set') context.modifiers[actualAffectation] = effectValue;
                        }
                    }

                }

                // Rule Decay Execution
                if (rule.decay) {
                    if (rule.decay === 'sub_count_1') {
                        if (typeof unit.statusEffects[statusId] === 'object' && unit.statusEffects[statusId] !== null) {
                            if (unit.statusEffects[statusId].count !== undefined) unit.statusEffects[statusId].count -= 1;
                        } else if (typeof unit.statusEffects[statusId] === 'number') {
                            unit.statusEffects[statusId] -= 1;
                        }
                    } else if (rule.decay === 'sub_potency_1') {
                        if (typeof unit.statusEffects[statusId] === 'object' && unit.statusEffects[statusId] !== null) {
                            if (unit.statusEffects[statusId].potency !== undefined) unit.statusEffects[statusId].potency -= 1;
                        }
                    } else if (rule.decay === 'half_count') {
                        if (typeof unit.statusEffects[statusId] === 'object' && unit.statusEffects[statusId] !== null && unit.statusEffects[statusId].count !== undefined) {
                            unit.statusEffects[statusId].count = Math.floor(unit.statusEffects[statusId].count / 2);
                        } else if (typeof unit.statusEffects[statusId] === 'number') {
                            unit.statusEffects[statusId] = Math.floor(unit.statusEffects[statusId] / 2);
                        }
                    } else if (rule.decay === 'half_potency') {
                        if (typeof unit.statusEffects[statusId] === 'object' && unit.statusEffects[statusId] !== null && unit.statusEffects[statusId].potency !== undefined) {
                            unit.statusEffects[statusId].potency = Math.floor(unit.statusEffects[statusId].potency / 2);
                        }
                    } else if (rule.decay === 'total_loss') {
                        unit.statusEffects[statusId] = 0;
                    }
                }
            }

            // Cleanup check
            let currentVal = unit.statusEffects[statusId];
            let shouldDelete = false;
            if (typeof currentVal === 'object' && currentVal !== null) {
                if ((currentVal.count !== undefined && currentVal.count <= 0) ||
                    (currentVal.potency !== undefined && currentVal.potency <= 0 && currentVal.count === undefined)) {
                    shouldDelete = true;
                }
            } else if (typeof currentVal === 'number' && currentVal <= 0) {
                shouldDelete = true;
            }

            if (shouldDelete) {
                delete unit.statusEffects[statusId];
            }
        }
    },



    // Skill Evolution Mutation Scanner
    // Skill Evolution Mutation Scanner
    scanSkillEvolutions: function(unit, allUnits) {
        if (!unit.original_sequences) return;

        const evaluateCondition = (evolution, targetUnit) => {
            if (!targetUnit) return false;
            let val = 0;
            if (evolution.condition_type === 'hp_percent') {
                val = (targetUnit.hp / (targetUnit.maxHp || 1)) * 100;
            } else if (evolution.condition_type === 'status_potency') {
                const status = (targetUnit.statuses || []).find(s => s.id === evolution.condition_status_id);
                val = status ? status.potency : 0;
            } else if (evolution.condition_type === 'status_count') {
                const status = (targetUnit.statuses || []).find(s => s.id === evolution.condition_status_id);
                val = status ? status.count : 0;
            }

            const targetVal = parseFloat(evolution.condition_value) || 0;
            switch (evolution.condition_operator) {
                case '<': return val < targetVal;
                case '<=': return val <= targetVal;
                case '=': return val === targetVal;
                case '>=': return val >= targetVal;
                case '>': return val > targetVal;
                default: return false;
            }
        };

        const processSequence = (activeSeq, originalSeq) => {
            for (let i = 0; i < activeSeq.length; i++) {
                // Siempre partimos desde la base (la habilidad original)
                // A menos que hayamos mutado permanentemente y sobrescrito el original
                let currentBaseId = originalSeq[i];
                let skill = window.SKILL_REGISTRY ? window.SKILL_REGISTRY[currentBaseId] : null;

                let nextEvolvedId = currentBaseId; // The ID we will end up with
                let depth = 0;

                while (skill && skill.evolution && depth < 10) {
                    depth++; // Max depth to prevent infinite loops

                    let conditionPassed = false;

                    if (skill.evolution.condition_target === 'Self') {
                        conditionPassed = evaluateCondition(skill.evolution, unit);
                    } else if (skill.evolution.condition_target === 'Target') {
                        // We check if ANY enemy meets the condition
                        const enemies = allUnits.filter(u => u.hp > 0 && u.isPlayer !== unit.isPlayer);
                        conditionPassed = enemies.some(enemy => evaluateCondition(skill.evolution, enemy));
                    }

                    if (conditionPassed) {
                        nextEvolvedId = skill.evolution.target_skill_id;

                        // Si la mutacion es permanente, actualizamos la memoria base para que no retroceda
                        if (skill.evolution.is_permanent) {
                            originalSeq[i] = nextEvolvedId;
                        }

                        // Para soporte de cadena (Tier 3), obtenemos la nueva habilidad inyectada y re-evaluamos en el while
                        skill = window.SKILL_REGISTRY ? window.SKILL_REGISTRY[nextEvolvedId] : null;
                    } else {
                        break; // Condition failed, stop evolving this chain
                    }
                }

                // Aplicamos la habilidad resultante a la secuencia activa
                activeSeq[i] = nextEvolvedId;
            }
        };

        processSequence(unit.attack_tier_1_sequence, unit.original_sequences.tier_1);
        processSequence(unit.attack_tier_2_sequence, unit.original_sequences.tier_2);
        processSequence(unit.attack_tier_3_sequence, unit.original_sequences.tier_3);
    },

    canUseConsumable: function(unit) {
        if (!unit) return false;
        return !unit.consumable_used_this_turn;
    },

    useConsumable: function(unit) {
        if (!unit) return false;
        if (!this.canUseConsumable(unit)) {
            console.warn(`[LIMITADOR DE COMBATE] La unidad ${unit.name || 'Unidad'} ya ha utilizado un consumible este turno.`);
            return false;
        }
        unit.consumable_used_this_turn = true;
        return true;
    },

    triggerPhase: function(phaseTag, allUnits) {
        if (!allUnits || !Array.isArray(allUnits)) return;

        for (let unit of allUnits) {
            // Evaluacion de inmovilizacion (al inicio del round)
            if (phaseTag === '[Round Start]') {
                unit.isImmobilized = unit.statusEffects && unit.statusEffects['immobilized'] && unit.statusEffects['immobilized'].count > 0;

                // Cache indiscriminate targets
                if (!unit.isImmobilized) {
                    let allSkills = [].concat(unit.attack_tier_1_sequence || [], unit.attack_tier_2_sequence || [], unit.attack_tier_3_sequence || []);
                    allSkills.forEach(skill => {
                        if (skill && skill.targeting_type === 'Indiscriminate') {
                            let weight = skill.atkWeight || 1;
                            if (weight > 1) {
                                let allAlive = this.getAllAliveUnits().filter(u => u !== unit); // Exclude self
                                // Shuffle
                                allAlive.sort(() => 0.5 - Math.random());
                                skill._cachedIndiscriminateTargets = allAlive.slice(0, weight - 1);
                            }
                        }
                    });
                }

            }

            // Historial de combate y transicion de daño
            if (phaseTag === '[Round End]' || phaseTag === '[Round Start]') {
                unit.consumable_used_this_turn = false; // Reset strict consumable limiter per turn!
            }
            if (phaseTag === '[Round End]') {
                unit.took_damage_last_turn = unit.took_damage_this_turn || false;
                unit.took_damage_this_turn = false;
            }

            // Restore idle sprite on certain phases if not dead
            // Restore idle sprite on certain phases if not dead
            if (unit.hp > 0 && unit.idle_sprite && (phaseTag === '[Phase Start]' || phaseTag === '[Round Start]')) {
                unit.current_sprite = unit.idle_sprite;
            }

            // Process Delayed Effects on [Round Start]
            if (phaseTag === '[Round Start]' && unit.delayed_effects && unit.delayed_effects.length > 0) {
                for (let delayed of unit.delayed_effects) {
                    let eff = delayed.effect;
                    let context = {
                        engine: this,
                        attacker: delayed.attacker,
                        defender: delayed.defender,
                        skill: delayed.skill,
                        currentCoin: delayed.currentCoin,
                        currentTarget: unit
                    };

                    if (typeof eff.execute === 'function') {
                        eff.execute(context);
                    }
                    if (eff.status) {
                        this.processStatusEffects(unit, 'instant', context);
                    }
                }
                unit.delayed_effects = []; // Clear buffer
            }

            // Skill Evolution Dynamic Mutation (After delayed effects, before action generation)
            if (phaseTag === '[Round Start]' && unit.hp > 0) {
                this.scanSkillEvolutions(unit, allUnits);
            }

            // Unidades pueden tener efectos pasivos en root (skills pasivas, equipamiento)
            // que queremos disparar aquí. Asumimos que unit.passives es un arreglo de habilidades/efectos.
            if (!unit.passives) continue;

            let context = {
                engine: this,
                unit: unit,
                phase: phaseTag
            };

            for (let passive of unit.passives) {
                if (passive.effects) {
                    let matchingEffects = passive.effects.filter(e => e.tag === phaseTag);
                    for (let effect of matchingEffects) {
                        if (typeof effect.execute === 'function') {
                            effect.execute(context);
                        }
                    }
                }
            }
        }
    },

    // 1. Stats Base y Cálculo de HP
    // 1. Stats Base y Cálculo de HP
    calculateMaxHP: function(base, hpCoef, level) {
        return Math.floor(base + (hpCoef * level));
    },

    getOffensiveLevel: function(unit, skill = {}) {
        const baseLevel = unit && unit.level ? unit.level : 1;
        let passiveMods = this.applyPassiveModifiers(unit);
        let offLevelMod = passiveMods.offensive_level || 0;
        let statModifier = 0;
        if (unit && unit.stats && skill && skill.scaling_stat) {
            statModifier = unit.stats[skill.scaling_stat.toLowerCase()] || 0;
        } else if (skill.offenseModifier) {
            statModifier = skill.offenseModifier;
        }
        const resonanceBonus = skill.resonanceOffenseBonus || 0;
        return Math.max(1, baseLevel + statModifier + resonanceBonus + offLevelMod);
    },

    getDefensiveLevel: function(unit, skillOrPart = {}) {
        const baseLevel = unit && unit.level ? unit.level : 1;
        let passiveMods = this.applyPassiveModifiers(unit);
        let defLevelMod = passiveMods.defensive_level || 0;
        let statModifier = 0;
        if (unit && unit.stats && skillOrPart && skillOrPart.scaling_stat) {
            statModifier = unit.stats[skillOrPart.scaling_stat.toLowerCase()] || 0;
        } else if (skillOrPart.defenseModifier) {
            statModifier = skillOrPart.defenseModifier;
        }
        const resonanceBonus = skillOrPart.resonanceDefenseBonus || 0;
        return Math.max(1, baseLevel + statModifier + resonanceBonus + defLevelMod);
    },

    calculateClashBonus: function(skillA, levelA, skillB, levelB) {
        let bonus = Math.floor(Math.abs(levelA - levelB) / 3);
        let winner = levelA > levelB ? 'A' : (levelB > levelA ? 'B' : null);

        if (!winner || bonus === 0) return { bonusA: 0, bonusB: 0 };

        // Edge case: Attack vs Non-Clashable Defense
        let aIsNonClashableDefense = skillA.isDefense === true && skillA.isClashable === false;
        let bIsNonClashableDefense = skillB.isDefense === true && skillB.isClashable === false;

        // If one is non-clashable defense and the other is an attack (not a defense)
        if (aIsNonClashableDefense && !skillB.isDefense) {
            // Only A (Defense) can get the bonus
            if (winner === 'A') return { bonusA: bonus, bonusB: 0 };
            return { bonusA: 0, bonusB: 0 };
        } else if (bIsNonClashableDefense && !skillA.isDefense) {
            // Only B (Defense) can get the bonus
            if (winner === 'B') return { bonusA: 0, bonusB: bonus };
            return { bonusA: 0, bonusB: 0 };
        }

        // Standard clash
        return {
            bonusA: winner === 'A' ? bonus : 0,
            bonusB: winner === 'B' ? bonus : 0
        };
    },


    // Nueva función para calcular el daño por moneda con modificadores planos
        calculateCoinDamage: function(attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
        // Passive modifiers
        let attackerMods = this.applyPassiveModifiers(attacker, { skill: skill });
        let defenderMods = this.applyPassiveModifiers(defender, { skill: skill });
        let dmgDealtMultiplierMod = attackerMods.damage_dealt_multiplier || 0;

        // Inject Flanking Damage Multiplier
        let flankingMultiplier = 1.0;
        if (attacker.grid_pos && defender.grid_pos) {
            let isFlanking = false;
            let allies = this.getAllAliveUnits().filter(u => u.faction === attacker.faction && u !== attacker);
            for (let ally of allies) {
                if (ally.grid_pos && this.evaluateFlanking(attacker.grid_pos, ally.grid_pos, defender.grid_pos)) {
                    isFlanking = true;
                    break;
                }
            }
            if (isFlanking) {
                flankingMultiplier = this.FLANKING_DAMAGE_MULTIPLIER || 1.20;
            }
        }
        let dmgTakenMultiplierMod = defenderMods.damage_taken_multiplier || 0;

        let staggerLevel = defender.staggerLevel || 0;
        let isStaggered = defender.isStaggered || false;

        let physRes = defender.physRes || 1.0;
        let sinRes = defender.sinRes || 1.0;

        // 1. Stagger Override para resistencia física
        let physMod;
        if (isStaggered) {
            physMod = 0.5 + (0.5 * staggerLevel);
        } else {
            physMod = this.calculateResistanceModifier(physRes);
        }
        let sinMod = this.calculateResistanceModifier(sinRes);

        // 2. Modificador de niveles
        let offLevel = this.getOffensiveLevel(attacker, skill);
        let defLevel = this.getDefensiveLevel(defender, defender);
        let levelMod = (offLevel - defLevel) / (Math.abs(offLevel - defLevel) + 25);

        // 3. Modificadores por Crítico y Choque
        let critDmgUpMod = attackerMods.crit_damage_multiplier || 0;
        let critMod = isCritical ? 0.2 + (critDmgUpMod * 0.1) : 0;
        let cCount = clashCount || 0;
        let clashMod = 0;
        if (cCount >= 1) {
            clashMod = 0.03 + (0.03 * cCount); // 3% + (3% * clashCount)
        }

        let totalStaticMod = physMod + sinMod + levelMod + critMod + clashMod;

        // --- NUEVA ARQUITECTURA DE CÁLCULO DE DAÑO (La Regla del 0.1) ---
        // Paso 1: Cálculo de poder en bruto
        let rawDamage = coinFinalPower * (1 + totalStaticMod);


        let localPctDmg = 0;
        let localRawDmg = 0;
        if (context && context.currentCoin && context.currentCoin.effects) {
             context.currentCoin.effects.forEach(eff => {
                  if (eff.type === 'percentage_damage') {
                       localPctDmg += (eff.potency || 0);
                  } else if (eff.type === 'raw_damage') {
                       localRawDmg += (eff.potency || 0);
                  }
             });
        }

        // Paso 3: Aplicación del modificador ofensivo (Damage Dealt Multiplier del atacante)
        let offMult = Math.max(0, 1.0 + (dmgDealtMultiplierMod * 0.1) + (localPctDmg / 100));
        let damageWithOffensive = rawDamage * offMult * flankingMultiplier;

        // Paso 4: Paso Final: Aplicación del modificador defensivo (Damage Taken Multiplier del objetivo)
        let defMult = Math.max(0, 1.0 - (dmgTakenMultiplierMod * 0.1));
        let damageWithDefensive = damageWithOffensive * defMult;

        let finalDamage = Math.max(Math.floor(damageWithDefensive), 0);

        // 6. Attack Adders (Daño Adicional Condicional)

        let attackAdders = localRawDmg;

        // Daño fijo desde skill.effects (ej. "Daño +3") (ej. "Daño +3")
        if (skill.effects) {
            for (let effect of skill.effects) {
                // Buscamos algo parecido a un tag que añada daño
                // Adaptamos la lógica de 'Damage Adder' basado en como este estructurado
                if (effect.type === 'Damage Adder' && effect.value) {
                    attackAdders += effect.value;
                } else if (effect.value && typeof effect.value === 'number' && effect.type !== 'Damage Adder' && effect.type && effect.type.includes('Damage')) { // just a fallback
                     attackAdders += effect.value;
                }
            }
        }

        // Daño por estados del objetivo (ej. Rupture)
        if (defender.statusEffects && defender.statusEffects['Rupture']) {
             attackAdders += defender.statusEffects['Rupture'];
        }

        return finalDamage + attackAdders;
    },

    // 2. Sistema de Escudos (Shield) y Daño (Aplicación)
    applyDamage: function(unit, damage, tipoDaño = 'directo', isCritical = false, skillUsed = null) {
        if (unit.hurt_sprite) {
            unit.current_sprite = unit.hurt_sprite;
            // Un motor real de animaciones regresaría esto a idle con un timeout o trigger,
            // pero por ahora el modelo dicta mapear la lógica base
        }
        // Híbrido D&D: Si la habilidad es Spell o Roll, no se aplica daño automático.
        if (skillUsed && (skillUsed.type === 'Spell' || skillUsed.type === 'Roll' || skillUsed.type === 'Save')) {
            return { hp: unit.hp, shield: unit.shield, message: 'Daño automático omitido por tipo de habilidad (Spell/Roll).' };
        }

        let remainingDamage = damage; // Critical multiplier moved to calculateCoinDamage

        if (unit.shield && unit.shield > 0) {
            if (unit.shield >= remainingDamage) {
                unit.shield -= remainingDamage;
                remainingDamage = 0;
            } else {
                remainingDamage -= unit.shield;
                unit.shield = 0;
            }
        }

        unit.hp = Math.max(0, unit.hp - remainingDamage);

        if (remainingDamage > 0) {
             unit.took_damage_this_turn = true;
        }

        // Chequeo de Stagger: Solo ocurre en impactos (daño directo),
        // incluso si el daño fue absorbido por escudo o es 0.
        if (tipoDaño === 'directo') {
            this.checkStagger(unit);
        }

        // Revisar SP tras aplicar daño
        if (unit.sp !== undefined) {
            this.checkSanityStates(unit);
        }

        return { hp: unit.hp, shield: unit.shield };
    },

    // 2.5 Sistema de Stagger
    modifyNextStaggerThreshold: function(unit, amount) {
        if (!unit.staggerThresholds || unit.staggerThresholds.length === 0) return;

        if (!unit.crossedThresholds) {
            unit.crossedThresholds = new Array(unit.staggerThresholds.length).fill(false);
        }

        // Buscar el umbral no cruzado con el porcentaje más alto
        let targetIndex = -1;
        let highestUncrossedValue = -Infinity;

        for (let i = 0; i < unit.staggerThresholds.length; i++) {
            if (!unit.crossedThresholds[i] && unit.staggerThresholds[i] > highestUncrossedValue) {
                highestUncrossedValue = unit.staggerThresholds[i];
                targetIndex = i;
            }
        }

        if (targetIndex !== -1) {
            unit.staggerThresholds[targetIndex] += amount;
        }
    },

    checkStagger: function(unit) {
        if (unit.hp <= 0 && unit.dead_sprite) {
            unit.current_sprite = unit.dead_sprite;
        }

        if (!unit.staggerThresholds || unit.staggerThresholds.length === 0) return;
        if (!unit.maxHp || unit.maxHp <= 0) return;

        // Inicializar array paralelo para registrar los umbrales cruzados
        if (!unit.crossedThresholds) {
            unit.crossedThresholds = new Array(unit.staggerThresholds.length).fill(false);
        }

        let currentHpPct = (unit.hp / unit.maxHp) * 100;
        let newlyStaggered = false;

        for (let i = 0; i < unit.staggerThresholds.length; i++) {
            let threshold = unit.staggerThresholds[i];
            // Si no ha sido cruzado y el umbral es >= 0 (los negativos no pueden ser cruzados por daño)
            if (!unit.crossedThresholds[i] && threshold >= 0) {
                if (currentHpPct <= threshold) {
                    unit.crossedThresholds[i] = true;
                    newlyStaggered = true;
                }
            }
        }

        if (newlyStaggered) {
            // Vaciar la cola de acciones para cancelar las acciones de este turno
            unit.actionQueue = [];

            // Establecer el estado Stagger, que durará el resto de este turno y todo el siguiente (2 ticks)
            unit.isStaggered = true;
            unit.staggerTurns = 2;

            // Actualizar el nivel de stagger basado en cuántos umbrales han sido superados en total
            unit.staggerLevel = unit.crossedThresholds.filter(c => c).length;
        }
    },

    tickStagger: function(unit) {
        if (unit.isStaggered && unit.staggerTurns > 0) {
            unit.staggerTurns--;
            if (unit.staggerTurns <= 0) {
                unit.isStaggered = false;
                // staggerLevel se mantiene para el límite de multiplicador de daño en Stagger (por si se cruzan más),
                // pero ya no aplicará x2/x2.5/x3.0 porque ya no está en Stagger, esto se maneja en calculateDamageMultiplier.
                // Sin embargo, si staggerLevel se resetea al perder Stagger, deberíamos manejarlo:
                // Según el diseño de Limbus, una vez que pierdes Stagger las defensas vuelven a la normalidad, pero
                // para el siguiente Stagger, sumarías un staggerLevel más si pasas otro umbral.
                // En calculateDamageMultiplier solo se aplica el cambio a physRes si unit.isStaggered es true,
                // así que corregiremos eso en `calculateDamageMultiplier` o aquí. Lo mejor es usar `unit.isStaggered`
                // en `calculateDamageMultiplier`.
            }
        }
    },

    // 3. Sanidad (SP), Monedas y Estados Mentales
    limitSP: function(sp) {
        return Math.max(-45, Math.min(45, sp));
    },

    getCoinProbability: function(sp) {
        let validSp = this.limitSP(sp);
        return 50 + validSp; // % (Ej: SP 45 -> 95%, SP -45 -> 5%)
    },

    checkSanityStates: function(unit) {
        if (unit.sp === undefined) return;

        unit.sp = this.limitSP(unit.sp);
        unit.sanityState = 'Normal';

        if (unit.sp === -45) {
            unit.sanityState = 'Panic'; // pierde su turno/acción en la siguiente ronda
        } else if (unit.sp <= -30) {
            unit.sanityState = 'Low Morale';
        }
    },

    // 4. Velocidad, Slots y Targeting

    calculateActionSlots: function(combatants, currentRound, hasReinforcements, isPlayerFaction) {
        let maxGlobalSlots = (isPlayerFaction && !hasReinforcements) ? 11 : 12;
        let totalSlotsToDistribute = combatants.length + (currentRound - 1);

        totalSlotsToDistribute = Math.min(totalSlotsToDistribute, maxGlobalSlots);

        // Ordenar combatientes por Velocidad (de mayor a menor)
        let sortedCombatants = combatants.sort((a, b) => b.speed - a.speed);

        // Asignar 1 slot base a cada uno vivo
        sortedCombatants.forEach(c => {
            c.activeSlots = 1;
            // Aseguramos que la propiedad exista, si no, asumimos 3 (minion)
            if (c.maxSlotsLimit === undefined) {
                c.maxSlotsLimit = 3;
            }
        });

        let remainingSlots = totalSlotsToDistribute - sortedCombatants.length;

        // Bucle para repartir los restantes al más rápido, respetando sus topes individuales
        let i = 0;
        let iterationsWithoutAssignment = 0; // Guard against infinite loop

        while(remainingSlots > 0 && i < sortedCombatants.length) {
            let unit = sortedCombatants[i];
            if (unit.activeSlots < unit.maxSlotsLimit) {
                unit.activeSlots++;
                remainingSlots--;
                iterationsWithoutAssignment = 0;
            } else {
                iterationsWithoutAssignment++;
            }

            i++; // Pasar al siguiente más rápido

            // Reiniciar el loop si aún hay slots y todos los rápidos ya recibieron su ronda
            if (i >= sortedCombatants.length && remainingSlots > 0) {
                if (iterationsWithoutAssignment >= sortedCombatants.length) {
                    // Everyone is at their limit, break the loop to prevent infinite loop
                    break;
                }
                i = 0;
            }
        }
        return sortedCombatants;
    },

    autoTarget: function(attacker, skill, enemies) {
        if (!enemies || enemies.length === 0) return null;

        // Todas las unidades deben mantener siempre 1 Slot válido para recibir ataques
        let validTargets = enemies.filter(e => (e.actionSlots || 1) >= 1);
        if (validTargets.length === 0) validTargets = enemies;

        const priority = skill.priority || 'random';

        if (priority === 'highest_speed') {
            return validTargets.reduce((prev, current) => (prev.speed > current.speed) ? prev : current);
        } else if (priority === 'lowest_hp') {
            return validTargets.reduce((prev, current) => (prev.hp < current.hp) ? prev : current);
        } else {
            // random
            return validTargets[Math.floor(Math.random() * validTargets.length)];
        }
    },

    // 5. Cálculo de Resistencias (Modo Limbus)
    calculateResistanceModifier: function(v) {
        if (v <= 0) return -0.5;
        if (v < 1) return (v - 1) / 2;
        return v - 1;
    },

    calculateDamageMultiplier: function(physRes, sinRes, flatBuffs = 0, staggerLevel = 0, isStaggered = false, offLevel = null, defLevel = null) {
        // En Stagger, las resistencias físicas cambian temporalmente.
        if (isStaggered) {
            if (staggerLevel === 1) {
                physRes = 2.0; // Stagger
            } else if (staggerLevel === 2) {
                physRes = 2.5; // Stagger+
            } else if (staggerLevel >= 3) {
                physRes = 3.0; // Stagger++
            }
        }

        let physMod = this.calculateResistanceModifier(physRes);
        let sinMod = this.calculateResistanceModifier(sinRes);

        let totalMod = physMod + sinMod + flatBuffs;

        // Modifier por diferencia de niveles
        if (offLevel !== null && defLevel !== null) {
            let levelModifier = (offLevel - defLevel) / (Math.abs(offLevel - defLevel) + 25);
            totalMod += levelModifier;
        }

        let multiplier = 1 + totalMod;

        // Límites y Buffs: El daño nunca baja de x0 ni sube de x2 a menos que haya Stagger
        if (!isStaggered) {
            multiplier = Math.max(0.0, Math.min(2.0, multiplier));
        } else {
            // Se rompe el límite superior por el estado de Stagger
            multiplier = Math.max(0.0, multiplier);
        }

        return multiplier;
    },

    // 6. Matriz de Flanqueo (Flanking Matrix)
    evaluateFlanking: function(attackerCoords, allyCoords, targetCoords) {
        // Flanking check with direct adjacent opposite. We just check if they are diametrically opposite in a 1-cell radius (or straight line)
        let vecAllyX = allyCoords.x - targetCoords.x;
        let vecAllyY = allyCoords.y - targetCoords.y;

        let vecAtkX = attackerCoords.x - targetCoords.x;
        let vecAtkY = attackerCoords.y - targetCoords.y;

        if ((vecAllyX === 0 && vecAllyY === 0) || (vecAtkX === 0 && vecAtkY === 0)) return false;

        // Normalize vectors for direction comparison in case they are further away
        let normAllyX = vecAllyX === 0 ? 0 : vecAllyX / Math.abs(vecAllyX);
        let normAllyY = vecAllyY === 0 ? 0 : vecAllyY / Math.abs(vecAllyY);

        let normAtkX = vecAtkX === 0 ? 0 : vecAtkX / Math.abs(vecAtkX);
        let normAtkY = vecAtkY === 0 ? 0 : vecAtkY / Math.abs(vecAtkY);

        return (normAtkX === -normAllyX && normAtkY === -normAllyY);
    },

    moveAttackerToTarget: function(attacker, target) {
        if (!attacker.grid_pos || !target.grid_pos) return;

        let vecX = target.grid_pos.x - attacker.grid_pos.x;
        let vecY = target.grid_pos.y - attacker.grid_pos.y;

        // Normalize to find target adjacent cell in the direction of the vector
        let dirX = vecX === 0 ? 0 : (vecX > 0 ? 1 : -1);
        let dirY = vecY === 0 ? 0 : (vecY > 0 ? 1 : -1);

        let targetX = target.grid_pos.x - dirX;
        let targetY = target.grid_pos.y - dirY;

        // Ensure cell is free. If occupied, orbit the target.
        let allAlive = this.getAllAliveUnits();

        const isOccupied = (x, y) => {
            if (x === target.grid_pos.x && y === target.grid_pos.y) return true; // Can't stand ON the target
            return allAlive.some(u => u !== attacker && u.grid_pos && u.grid_pos.x === x && u.grid_pos.y === y);
        };

        if (isOccupied(targetX, targetY)) {
            // Orbit: check 8 adjacent cells
            let found = false;
            let offsets = [
                {x: 0, y: -1}, {x: 1, y: -1}, {x: 1, y: 0}, {x: 1, y: 1},
                {x: 0, y: 1}, {x: -1, y: 1}, {x: -1, y: 0}, {x: -1, y: -1}
            ];
            // Sort offsets by distance to preferred targetX, targetY
            offsets.sort((a, b) => {
                let cellA_x = target.grid_pos.x + a.x;
                let cellA_y = target.grid_pos.y + a.y;
                let cellB_x = target.grid_pos.x + b.x;
                let cellB_y = target.grid_pos.y + b.y;
                let distA = Math.abs(cellA_x - targetX) + Math.abs(cellA_y - targetY);
                let distB = Math.abs(cellB_x - targetX) + Math.abs(cellB_y - targetY);
                return distA - distB;
            });

            for (let offset of offsets) {
                let checkX = target.grid_pos.x + offset.x;
                let checkY = target.grid_pos.y + offset.y;
                if (!isOccupied(checkX, checkY)) {
                    targetX = checkX;
                    targetY = checkY;
                    found = true;
                    break;
                }
            }
        }

        attacker.grid_pos.x = targetX;
        attacker.grid_pos.y = targetY;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CombatEngine;
} else if (typeof window !== 'undefined') {
    window.CombatEngine = CombatEngine;
}