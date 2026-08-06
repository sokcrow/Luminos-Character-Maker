import sys
import re

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Step 3: Targeting Types Resolution Engine

    # [Focused Attack]: If target HP == 0, break loop automatically. (Already partially there, let's ensure it covers the new targeting types logic)
    # [Focused Volley]: If target HP == 0, check AI vs Human for auto-retarget.
    # [Unfocused Volley]: Randomize target per coin.

    # We will hook into the coin execution loop inside resolveUnilateralWithCounter.

    search_block = """
        for (let i = 0; i < activeAttackCoins.length; i++) {
            let currentCoin = activeAttackCoins[i];
"""

    replace_block = """
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
                    result.attackLogs.push({ message: `Retargeting coin to ${unitDefender.name} ([Unfocused Volley]).`, class: 'clash-info' });
                    // NOTE: marked as Unopposed Attack logic strictly.
                }
            }

            // AoE logic is handled outside the coin loop (during target selection / calculateAoETargets)
            // Indiscriminate logic is handled during round start / target caching.

"""

    if "let targetingType = attackSkill.targeting_type" not in content:
        content = content.replace(search_block, replace_block, 1)

    # We also need a helper to find closest hostile (for enemy auto-retargeting) and getAllAliveUnits
    helper_funcs = """
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
"""
    if "getAllAliveUnits: function(" not in content:
        content = content.replace("calculateResonance: function(actionQueue) {", helper_funcs + "\n    calculateResonance: function(actionQueue) {", 1)


    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
