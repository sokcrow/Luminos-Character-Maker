const RESONANCE_BONUS = {
    // Índice: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11+]
    REGULAR:  [0, 0, 1, 3, 3, 5, 5, 7, 7, 9, 9, 11],
    ABSOLUTE: [0, 0, 0, 3, 5, 5, 7, 7, 9, 9, 11, 11]
};

const CombatEngine = {
// 0. Habilidades y Poder (Skills)
    // 0.5 Helper D&D
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
        let savePower = this.calculateFinalPower(saveSkill, targetHeadsFlipped);

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
        if (!guardSkill.coins) {
            guardSkill.coins = Array.from({length: guardSkill.coinAmount}, () => ({ type: guardSkill.coinType || 'standard', status: 'active' }));
        }

        let probDefender = this.getCoinProbability(unitDefender.sp || 0);
        let guardTosses = guardSkill.coins.map(c => c.status === 'active' ? (Math.random() * 100 < probDefender) : true);
        let guardPower = this.calculateFinalPower(guardSkill, guardTosses);

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
        this.triggerEvent('[On Unopposed Attack]', context, [unitDefender]);

        let defContext = { engine: this, attacker: unitAttacker, defender: unitDefender, skill: attackSkill };
        this.triggerEvent('[Before Getting Hit]', defContext, [unitDefender]);

        let activeAttackCoins = attackSkill.coins.filter(c => c.status === 'active' || c.status === 'cracked');
        let probAttacker = this.getCoinProbability(unitAttacker.sp || 0);



        for (let i = 0; i < activeAttackCoins.length; i++) {
            let currentCoin = activeAttackCoins[i];
            context.currentCoin = currentCoin;

            this.triggerEvent('[Coin Start]', context, [unitDefender]);

            let attackTosses = activeAttackCoins.map(c => c.status === 'active' ? (Math.random() * 100 < probAttacker) : true);
            let attackPower = this.calculateFinalPower(attackSkill, attackTosses);

            // current coin toss result (it's the i-th toss basically, if we consider only active ones we need mapping, but let's assume current toss is for current coin)
            // Limbus note: toss result for current coin is attackTosses[i]
            let isHeads = attackTosses[i];
            if (isHeads) {
                this.triggerEvent('[Heads Hit]', context, [unitDefender]);
            } else {
                this.triggerEvent('[Tails Hit]', context, [unitDefender]);
            }

            result.attackLogs.push({
                attackPower: attackPower,
                attackTosses: attackTosses
            });

            // Apply damage physically to process HP and Stagger states
            let clashCount = options.clashCount || 0; // options.clashCount could be passed if from a clash, else 0
            let finalDamage = this.calculateCoinDamage(unitAttacker, unitDefender, attackSkill, attackPower, false, clashCount);

            let applyDmgResult = this.applyDamage(unitDefender, finalDamage, 'directo', false, attackSkill);
            context.damageDealt = finalDamage;

            this.triggerEvent('[On Hit]', context, [unitDefender]);

            // If they just won a clash
            if (options.clashResult === 'Win') {
                this.triggerEvent('[Hit after Clash Win]', context, [unitDefender]);
            } else if (options.clashResult === 'Lose') {
                this.triggerEvent('[Hit after Clash Lose]', context, [unitDefender]);
            }

            this.triggerEvent('[Current Coin Attack End]', context, [unitDefender]);

            if (unitDefender.isStaggered) {
                result.defenderStaggered = true;
                break; // Stop evaluating further coins if staggered
            }
        }

        this.triggerEvent('[Attack End]', context, [unitDefender]);


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
            let evadePower = this.calculateFinalPower(evadeSkill, evadeTosses);

            // Roll Attack (only rolling the current coin + previous coins are usually evaluated as well,
            // but in Evade vs Attack, the attacker usually rolls all their remaining coins for power)
            // Limbus Rule: Attacker rolls ALL active coins for power. We will roll all active/cracked for the attacker.
            let attackTosses = activeAttackCoins.map(c => c.status === 'active' ? (Math.random() * 100 < probAttacker) : true);
            let attackPower = this.calculateFinalPower(attackSkill, attackTosses);

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


        let round = 1;

        while (true) {
            let activeCoinsA = skillA.coins.filter(c => c.status === 'active');
            let activeCoinsB = skillB.coins.filter(c => c.status === 'active');

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

            let powerA = this.calculateFinalPower(skillA, tossesA);
            let powerB = this.calculateFinalPower(skillB, tossesB);

            let roundWinner = powerA > powerB ? 'A' : (powerB > powerA ? 'B' : 'Tie');

            result.clashLogs.push({
                round: round,
                powerA: powerA,
                powerB: powerB,
                tossesA: tossesA,
                tossesB: tossesB,
                winner: roundWinner
            });

            // LIFO Coin Destruction Logic
            const processLoss = (loserSkill, winnerSkill) => {
                // Find the last active coin
                for (let i = loserSkill.coins.length - 1; i >= 0; i--) {
                    if (loserSkill.coins[i].status === 'active') {
                        let loserCoin = loserSkill.coins[i];
                        let winnerActiveCoins = winnerSkill ? winnerSkill.coins.filter(c => c.status === 'active') : [];
                        let winningCoinType = winnerActiveCoins.length > 0 ? winnerActiveCoins[0].type : 'standard';

                        if (loserCoin.type === 'unbreakable') {
                            if (winningCoinType === 'excision') {
                                loserCoin.status = 'broken';
                            } else {
                                loserCoin.status = 'cracked';
                            }
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
            this.triggerEvent('[Clash Win]', contextA, [unitB]);
            this.triggerEvent('[Clash Lose]', contextB, [unitA]);
        } else if (result.winner === 'B') {
            this.triggerEvent('[Clash Win]', contextB, [unitA]);
            this.triggerEvent('[Clash Lose]', contextA, [unitB]);
        }

        result.pendingActions = [];

        // Setup counter-attack if the loser has cracked coins

        let loserSkill = result.winner === 'A' ? skillB : (result.winner === 'B' ? skillA : null);
        let loserUnit = result.winner === 'A' ? unitB : (result.winner === 'B' ? unitA : null);
        let winnerSkill = result.winner === 'A' ? skillA : (result.winner === 'B' ? skillB : null);
        let winnerUnit = result.winner === 'A' ? unitA : (result.winner === 'B' ? unitB : null);

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
            let attackerPower = result.winner === 'A' ? lastLog.powerA : lastLog.powerB;
            result.mitigatedPower = Math.max(0, attackerPower - guardPower);
            result.mitigationApplied = true;
        }

        // We will push counter attack to pendingActions outside this function when processing unilateral attacks
        // since Counters wait for the attack to finish. But if ClashableCounter is involved in a clash, it acts as normal attack.

        return result;
    },

    resolveRollClash: function(skillA, headsA, skillB, headsB) {
        let powerA = this.calculateFinalPower(skillA, headsA);
        let powerB = this.calculateFinalPower(skillB, headsB);

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

    calculateFinalPower: function(skill, headsFlipped) {
        if (typeof headsFlipped === 'number') {
            return skill.basePower + (headsFlipped * skill.coinPower);
        }

        if (Array.isArray(headsFlipped)) {
            let totalPower = skill.basePower;
            let activeOrCrackedCoins = skill.coins ? skill.coins.filter(c => c.status === 'active' || c.status === 'cracked') : [];

            for (let i = 0; i < headsFlipped.length; i++) {
                let coinResult = headsFlipped[i];
                let coin = activeOrCrackedCoins[i];

                if (!coin) continue;

                if (coin.status === 'active') {
                    if (coinResult) {
                        totalPower += skill.coinPower;
                    }
                } else if (coin.status === 'cracked') {
                    // Cracked coins have a fixed base power of 1 or -1 before external modifiers
                    // In calculateFinalPower context, the coin base is fixed and it acts as an automatic heads
                    let crackedBasePower = skill.coinPower < 0 ? -1 : 1;
                    totalPower += crackedBasePower;
                    // Any external modifiers would be applied after this function,
                    // as calculateFinalPower only calculates the base + coin power
                }
            }
            return totalPower;
        }

        return skill.basePower;
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
        if (!context || !context.skill) return;

        // Collect all effects that match the tag from the skill root
        let applicableEffects = [];
        if (context.skill.effects) {
            applicableEffects.push(...context.skill.effects.filter(e => e.tag === tag));
        }

        // If context has a currentCoin, collect effects from that coin too
        if (context.currentCoin && context.currentCoin.effects) {
            applicableEffects.push(...context.currentCoin.effects.filter(e => e.tag === tag));
        }

        if (applicableEffects.length === 0) return;

        // If it's a targeted event (like [On Hit]), it accumulates per target hit
        let executionTargets = targetsHit.length > 0 ? targetsHit : [context.defender || null];

        for (let target of executionTargets) {
            if (!target) continue; // Si no hay objetivo aplicable (por ejemplo, Before Use puede no tener objetivo definido aún en algunos contextos, o es global)

            // Set the current target in context for the effect to know who is being evaluated
            context.currentTarget = target;

            for (let effect of applicableEffects) {
                if (typeof effect.execute === 'function') {
                    effect.execute(context);
                }
            }
        }
    },

    triggerPhase: function(phaseTag, allUnits) {
        if (!allUnits || !Array.isArray(allUnits)) return;

        for (let unit of allUnits) {
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

    getOffensiveLevel: function(level, skill = {}) {
        const modifier = skill.offenseModifier || 0;
        const resonanceBonus = skill.resonanceOffenseBonus || 0;
        return Math.max(1, level + modifier + resonanceBonus);
    },

    getDefensiveLevel: function(level, skillOrPart = {}) {
        const modifier = skillOrPart.defenseModifier || 0;
        const resonanceBonus = skillOrPart.resonanceDefenseBonus || 0;
        return Math.max(1, level + modifier + resonanceBonus);
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
        let offLevel = this.getOffensiveLevel(attacker.level || 1, skill);
        let defLevel = this.getDefensiveLevel(defender.level || 1, defender);
        let levelMod = (offLevel - defLevel) / (Math.abs(offLevel - defLevel) + 25);

        // 3. Modificadores por Crítico y Choque
        let critMod = isCritical ? 0.2 : 0;
        let clashMod = (clashCount || 0) * 0.03;

        let totalStaticMod = physMod + sinMod + levelMod + critMod + clashMod;

        // Daño Base
        let baseDamage = Math.floor(coinFinalPower * (1 + totalStaticMod));

        // 4. Modificadores Dinámicos (Planos)
        let dynamicMod = 0;

        // Efectos del defensor (Fragile, Protection, etc.)
        if (defender.statusEffects) {
            if (defender.statusEffects['Fragile']) dynamicMod += defender.statusEffects['Fragile'];
            if (defender.statusEffects['Protection']) dynamicMod -= defender.statusEffects['Protection'];
            // Asume otros estados aquí si es necesario, o usa un bucle.
        }

        // Efectos del atacante (Damage Up, Damage Down, etc.)
        if (attacker.statusEffects) {
            if (attacker.statusEffects['Damage Up']) dynamicMod += attacker.statusEffects['Damage Up'];
            if (attacker.statusEffects['Damage Down']) dynamicMod -= attacker.statusEffects['Damage Down'];
        }

        let damageWithDynamic = baseDamage + dynamicMod;

        // 5. Límite de Daño Mínimo (5% o 1) envolviendo a los Modificadores Dinámicos
        let finalDamage = Math.max(damageWithDynamic, Math.floor(coinFinalPower * 0.05), 1);

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