const CombatEngine = {
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
    applyDamage: function(unit, damage, tipoDaño = 'directo') {
        let remainingDamage = damage;

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