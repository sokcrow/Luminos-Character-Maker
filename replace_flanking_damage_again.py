import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    search = "let baseDealtMult = contextOptions && contextOptions.attacker ? (contextOptions.attacker.damage_dealt_multiplier || 1.0) : 1.0;"
    replace = """let baseDealtMult = contextOptions && contextOptions.attacker ? (contextOptions.attacker.damage_dealt_multiplier || 1.0) : 1.0;

        // Inject Flanking Damage Multiplier
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
                baseDealtMult *= (this.FLANKING_DAMAGE_MULTIPLIER || 1.20);
            }
        }"""

    if "baseDealtMult *= (this.FLANKING_DAMAGE_MULTIPLIER" not in content:
        content = content.replace(search, replace, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
