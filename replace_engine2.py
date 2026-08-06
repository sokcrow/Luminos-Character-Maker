import re

with open('js/combatEngine.js', 'r', encoding='utf-8') as f:
    content = f.read()

search_unilateral = """            context.currentCoin = currentCoin;

            this.triggerEvent('[Coin Start]', context, [unitDefender]);"""

replace_unilateral = """            context.currentCoin = currentCoin;

            // Handle AoE and Indiscriminate properly inside Unilateral / Unopposed
            if (targetingType === 'AoE' || targetingType === 'Indiscriminate') {
                let allAlive = this.getAllAliveUnits();
                context.targetsHit = this.calculateAoETargets(attackSkill, unitDefender, allAlive, unitAttacker);
            } else {
                context.targetsHit = [unitDefender];
            }

            this.triggerEvent('[Coin Start]', context, [unitDefender]);"""

content = content.replace(search_unilateral, replace_unilateral)

with open('js/combatEngine.js', 'w', encoding='utf-8') as f:
    f.write(content)
