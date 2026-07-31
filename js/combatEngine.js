const RESONANCE_BONUS = {
    // Índice: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11+]
    REGULAR:  [0, 0, 1, 3, 3, 5, 5, 7, 7, 9, 9, 11],
    ABSOLUTE: [0, 0, 0, 3, 5, 5, 7, 7, 9, 9, 11, 11]
};

const CombatEngine = {
// 0. Habilidades y Poder (Skills)
    // 0.5 Helper D&D
    // 0.4 Initialization Helpers
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

        // At runtime, default current sprite to idle
        unit.current_sprite = unit.idle_sprite;
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
        let result = {
            attackLogs: [],
            pendingActions: [], // cracked coins and counter attacks
            defenderStaggered: false
        };


        // Assume the attack hits unilaterally first.
        if (!attackSkill.coins) {
            attackSkill.coins = Array.from({length: attackSkill.coinAmount}, () => ({ type: attackSkill.coinType || 'standard', status: 'active', effects: [] }));
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



        for (let i = 0; i < activeAttackCoins.length; i++) {
            let currentCoin = activeAttackCoins[i];
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

            let isCritical = false;
            if (unitAttacker.statusEffects && unitAttacker.statusEffects['poise'] > 0) {
                // Future poise integration can override this logic.
                // Assuming it's calculated elsewhere or we hook into it.
                // We'll leave it as false unless overridden, but the code structure handles it.
            }

            let finalDamage = this.calculateCoinDamage(unitAttacker, unitDefender, attackSkill, attackPower, isCritical, clashCount);

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

            if (!skillA.isDefense) powerA += (this.applyPassiveModifiers(unitA).clash_power || 0);
            if (!skillB.isDefense) powerB += (this.applyPassiveModifiers(unitB).clash_power || 0);

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

        let passiveMods = unit ? this.applyPassiveModifiers(unit) : {};
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
        let targetsHit = [primaryTarget];
        let remainingWeight = skill.attackWeight - (primaryTarget.slotWeight || 1);

        if (remainingWeight <= 0) return targetsHit;

        // Filter out the primary target from the possible targets
        let remainingTargets = allPossibleTargets.filter(t => t !== primaryTarget);

        // Sort targets based on priority:
        // 1. Untargeted in current round (assuming a property 'isTargetedThisRound' exists, false if undefined)
        // 2. Lowest HP percentage
        remainingTargets.sort((a, b) => {
            let aTargeted = a.isTargetedThisRound ? 1 : 0;
            let bTargeted = b.isTargetedThisRound ? 1 : 0;
            if (aTargeted !== bTargeted) {
                return aTargeted - bTargeted; // 0 comes before 1
            }

            let aHpPct = (a.hp / (a.maxHp || 1));
            let bHpPct = (b.hp / (b.maxHp || 1));
            return aHpPct - bHpPct; // Lower HP% comes first
        });

        for (let target of remainingTargets) {
            if (remainingWeight > 0) {
                targetsHit.push(target);
                remainingWeight -= (target.slotWeight || 1);
            } else {
                break;
            }
        }

        return targetsHit;
    },

// 0.8 Event-Driven System (Hooks)
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
                        // Package the effect and context for execution later
                        // Clone necessary context to avoid reference mutations, but keep unit refs
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



    applyPassiveModifiers: function(unit) {
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
            coin_power: 0
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


    triggerPhase: function(phaseTag, allUnits) {
        if (!allUnits || !Array.isArray(allUnits)) return;

        for (let unit of allUnits) {
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
    calculateCoinDamage: function(attacker, defender, skill, coinFinalPower, isCritical, clashCount) {
        // Passive modifiers
        let attackerMods = this.applyPassiveModifiers(attacker);
        let defenderMods = this.applyPassiveModifiers(defender);
        let dmgDealtMultiplierMod = attackerMods.damage_dealt_multiplier || 0;
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
        let critMod = isCritical ? 0.2 : 0;
        let cCount = clashCount || 0;
        let clashMod = 0;
        if (cCount >= 1) {
            clashMod = 0.03 + (0.03 * cCount); // 3% + (3% * clashCount)
        }

        let totalStaticMod = physMod + sinMod + levelMod + critMod + clashMod;

        // --- NUEVA ARQUITECTURA DE CÁLCULO DE DAÑO (La Regla del 0.1) ---
        // Paso 1: Cálculo de poder en bruto
        let rawDamage = coinFinalPower * (1 + totalStaticMod);

        // Paso 3: Aplicación del modificador ofensivo (Damage Dealt Multiplier del atacante)
        let offMult = Math.max(0, 1.0 + (dmgDealtMultiplierMod * 0.1));
        let damageWithOffensive = rawDamage * offMult;

        // Paso 4: Paso Final: Aplicación del modificador defensivo (Damage Taken Multiplier del objetivo)
        let defMult = Math.max(0, 1.0 - (dmgTakenMultiplierMod * 0.1));
        let damageWithDefensive = damageWithOffensive * defMult;

        let finalDamage = Math.max(Math.floor(damageWithDefensive), 0);

        // 6. Attack Adders (Daño Adicional Condicional)
        let attackAdders = 0;

        // Daño fijo desde skill.effects (ej. "Daño +3")
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
        // Un flanqueo ocurre si las coordenadas del atacante y el aliado están
        // diametralmente opuestas alrededor del objetivo.
        // Vector desde el objetivo al aliado
        let vecAllyX = allyCoords.x - targetCoords.x;
        let vecAllyY = allyCoords.y - targetCoords.y;

        // Vector desde el objetivo al atacante
        let vecAtkX = attackerCoords.x - targetCoords.x;
        let vecAtkY = attackerCoords.y - targetCoords.y;

        // Deben ser vectores no nulos
        if ((vecAllyX === 0 && vecAllyY === 0) || (vecAtkX === 0 && vecAtkY === 0)) return false;

        // Son diametralmente opuestos si vecAtk == -vecAlly
        return (vecAtkX === -vecAllyX && vecAtkY === -vecAllyY);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CombatEngine;
} else if (typeof window !== 'undefined') {
    window.CombatEngine = CombatEngine;
}