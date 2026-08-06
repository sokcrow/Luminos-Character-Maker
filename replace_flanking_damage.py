import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Inject Flanking Damage Multiplier into calculateDamage
    search_dmg = "let dealtMult = Math.max(0.0, baseDealtMult + (potencyDealt * 0.1));"
    replace_dmg = """let dealtMult = Math.max(0.0, baseDealtMult + (potencyDealt * 0.1));

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
                dealtMult *= (this.FLANKING_DAMAGE_MULTIPLIER || 1.20);
            }
        }"""

    if "dealtMult *= (this.FLANKING_DAMAGE_MULTIPLIER" not in content:
        content = content.replace(search_dmg, replace_dmg, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
