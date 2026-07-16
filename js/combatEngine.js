const CombatEngine = {
// 0. Habilidades y Poder (Skills)
    // 0.5 Helper D&D
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

            // D&D Hybrid Additions
            type: config.type || 'Normal', // 'Normal', 'Spell', 'Roll'
            statUsed: config.statUsed || null,
            skillUsed: config.skillUsed || null
        };

        // Initialize coins array based on coinAmount
        skill.coins = [];
        for (let i = 0; i < skill.coinAmount; i++) {
            skill.coins.push({
                type: skill.coinType,
                status: 'active'
            });
        }

        if (skill.type === 'Spell' || skill.type === 'Roll') {
            skill.coinPower = 4;
            skill.coinAmount = 5;
            skill.coins = [];
            for (let i = 0; i < skill.coinAmount; i++) {
                skill.coins.push({
                    type: skill.coinType,
                    status: 'active'
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

    resolveSpell: function(spellSkill, target, targetHeadsFlipped) {
        // Genera la tirada de salvación para el objetivo
        let saveSkill = this.createSaveSkill(target, spellSkill.statUsed);
        let savePower = this.calculateFinalPower(saveSkill, targetHeadsFlipped);

        let isSuccess = savePower >= spellSkill.saveDC;

        return {
            isStaticDC: true,
            dc: spellSkill.saveDC,
            savePower: savePower,
            isSuccess: isSuccess,
            winner: isSuccess ? 'Target' : 'Caster',
            message: `Spell DC ${spellSkill.saveDC} vs Save ${savePower}. ${isSuccess ? 'Save Successful!' : 'Save Failed!'}`
        };
    },

    resolveStandardClash: function(unitA, skillA, unitB, skillB) {
        let result = {
            winner: null,
            clashLogs: [],
            counterAttackPending: false,
            crackedCoinsToUse: null // Will hold the 'cracked' coins if counter attack is triggered
        };

        // Ensure skills have coins initialized (backward compatibility fallback)
        if (!skillA.coins) {
            skillA.coins = Array.from({length: skillA.coinAmount}, () => ({ type: skillA.coinType || 'standard', status: 'active' }));
        }
        if (!skillB.coins) {
            skillB.coins = Array.from({length: skillB.coinAmount}, () => ({ type: skillB.coinType || 'standard', status: 'active' }));
        }

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

        // Setup counter-attack if the loser has cracked coins
        let loserSkill = result.winner === 'A' ? skillB : (result.winner === 'B' ? skillA : null);
        if (loserSkill) {
            let crackedCoins = loserSkill.coins.filter(c => c.status === 'cracked');
            if (crackedCoins.length > 0) {
                result.counterAttackPending = true;
                result.crackedCoinsToUse = crackedCoins;
            }
        }

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

    // 1. Stats Base y Cálculo de HP
    calculateMaxHP: function(base, hpCoef, level) {
        return Math.floor(base + (hpCoef * level));
    },

    getOffensiveLevel: function(level, skill = {}) {
        const modifier = skill.offenseModifier || 0;
        return Math.max(1, level + modifier);
    },

    getDefensiveLevel: function(level, skillOrPart = {}) {
        const modifier = skillOrPart.defenseModifier || 0;
        return Math.max(1, level + modifier);
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

    // 2. Sistema de Escudos (Shield) y Daño (Aplicación)
    applyDamage: function(unit, damage, tipoDaño = 'directo', isCritical = false, skillUsed = null) {
        // Híbrido D&D: Si la habilidad es Spell o Roll, no se aplica daño automático.
        if (skillUsed && (skillUsed.type === 'Spell' || skillUsed.type === 'Roll' || skillUsed.type === 'Save')) {
            return { hp: unit.hp, shield: unit.shield, message: 'Daño automático omitido por tipo de habilidad (Spell/Roll).' };
        }

        let remainingDamage = isCritical ? damage * 1.5 : damage;

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
        if (v >= 1) {
            return v - 1;
        } else {
            return (v - 1) / 2;
        }
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
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CombatEngine;
} else if (typeof window !== 'undefined') {
    window.CombatEngine = CombatEngine;
}