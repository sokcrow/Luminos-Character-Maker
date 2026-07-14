const CombatEngine = {
    // 1. Stats Base y Cálculo de HP
    calculateMaxHP: function(base, hpCoef, level) {
        return Math.floor(base + (hpCoef * level));
    },

    getOffensiveLevel: function(level) {
        return level;
    },

    getDefensiveLevel: function(level) {
        return level;
    },

    // 2. Sistema de Escudos (Shield) y Daño (Aplicación)
    applyDamage: function(unit, damage) {
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

        // Revisar SP tras aplicar daño
        if (unit.sp !== undefined) {
            this.checkSanityStates(unit);
        }

        return { hp: unit.hp, shield: unit.shield };
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

    calculateDamageMultiplier: function(physRes, sinRes, flatBuffs = 0, staggerLevel = 0) {
        // En Stagger, las resistencias físicas cambian temporalmente.
        if (staggerLevel === 1) {
            physRes = 2.0; // Stagger
        } else if (staggerLevel === 2) {
            physRes = 2.5; // Stagger+
        } else if (staggerLevel >= 3) {
            physRes = 3.0; // Stagger++
        }

        let physMod = this.calculateResistanceModifier(physRes);
        let sinMod = this.calculateResistanceModifier(sinRes);

        let totalMod = physMod + sinMod + flatBuffs;
        let multiplier = 1 + totalMod;

        // Límites y Buffs: El daño nunca baja de x0 ni sube de x2 a menos que haya Stagger
        if (staggerLevel === 0) {
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