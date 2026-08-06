import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    search = "let dmgDealtMultiplierMod = attackerMods.damage_dealt_multiplier || 0;"
    replace = """let dmgDealtMultiplierMod = attackerMods.damage_dealt_multiplier || 0;

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
        }"""

    if "flankingMultiplier = this.FLANKING_DAMAGE_MULTIPLIER" not in content:
        content = content.replace(search, replace, 1)

    search_apply = "let baseDmg = finalResistMultiplier * finalCoinPower * (1 + dmgDealtMultiplierMod);"
    replace_apply = "let baseDmg = finalResistMultiplier * finalCoinPower * (1 + dmgDealtMultiplierMod) * flankingMultiplier;"

    if "flankingMultiplier;" not in content:
        content = content.replace(search_apply, replace_apply, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
