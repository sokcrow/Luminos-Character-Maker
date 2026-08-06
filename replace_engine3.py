import re

with open('js/combatEngine.js', 'r', encoding='utf-8') as f:
    content = f.read()


search_resolve = """        if (remainingWeight <= 0) return targetsHit;

        // Remove primary target from pool
        let possibleTargets = allPossibleTargets.filter(t => t !== primaryTarget && t.hp > 0);"""

replace_resolve = """        if (remainingWeight <= 0) return targetsHit;

        // Remove primary target from pool
        let possibleTargets = allPossibleTargets.filter(t => t !== primaryTarget && t.hp > 0);

        // Remove faction filter if any was present, but in calculateAoETargets we just get allPossibleTargets which should be allAliveUnits. No faction filtering here means friendly fire is active!"""

content = content.replace(search_resolve, replace_resolve)

with open('js/combatEngine.js', 'w', encoding='utf-8') as f:
    f.write(content)
