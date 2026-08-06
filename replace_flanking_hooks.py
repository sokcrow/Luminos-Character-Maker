import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Inject movement before attack resolution and flanking checks into power/damage hooks.
    # Moving the attacker happens at the start of `resolveUnilateralWithCounter` and `resolveStandardClash`

    # 1. Move attacker in resolveUnilateralWithCounter
    search_uni = "let context = { engine: this, attacker: unitAttacker, defender: unitDefender, skill: attackSkill, targetsHit: [unitDefender] };"
    replace_uni = """// Move attacker dynamically to the target before executing
        if (unitAttacker.grid_pos && unitDefender.grid_pos) {
            this.moveAttackerToTarget(unitAttacker, unitDefender);
        }
        let context = { engine: this, attacker: unitAttacker, defender: unitDefender, skill: attackSkill, targetsHit: [unitDefender] };"""

    if "this.moveAttackerToTarget(unitAttacker, unitDefender);" not in content:
        content = content.replace(search_uni, replace_uni, 1)

    # 2. Inject Flanking Bonus to power calculation (calculateFinalPower)
    search_power = "let passiveBasePower = contextOptions ? (contextOptions.modifiers.base_power || 0) : 0;"
    replace_power = """let passiveBasePower = contextOptions ? (contextOptions.modifiers.base_power || 0) : 0;

        // Inject Flanking Power Bonus if applicable
        if (unit && unit.grid_pos && contextOptions && contextOptions.defender && contextOptions.defender.grid_pos) {
            let isFlanking = false;
            let allies = this.getAllAliveUnits().filter(u => u.faction === unit.faction && u !== unit);
            for (let ally of allies) {
                if (ally.grid_pos && this.evaluateFlanking(unit.grid_pos, ally.grid_pos, contextOptions.defender.grid_pos)) {
                    isFlanking = true;
                    break;
                }
            }
            if (isFlanking) {
                passiveBasePower += this.FLANKING_POWER_BONUS || 2;
            }
        }"""

    if "passiveBasePower += this.FLANKING_POWER_BONUS" not in content:
        content = content.replace(search_power, replace_power, 1)


    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
