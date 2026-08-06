import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Add block checks to resolve functions

    replacements = [
        ("resolveUnilateralWithCounter: function(unitAttacker, attackSkill, unitDefender, counterSkill, options = { skipUseHooks: false, clashResult: null }) {",
         "resolveUnilateralWithCounter: function(unitAttacker, attackSkill, unitDefender, counterSkill, options = { skipUseHooks: false, clashResult: null }) {\n        if (this.currentState === 'PRE_COMBAT_PLANNING') return { attackLogs: [{ message: 'Action blocked during Planning Phase.', class: 'error' }], damageTaken: 0 };"),

        ("resolveStandardClash: function(unitA, skillA, unitB, skillB) {",
         "resolveStandardClash: function(unitA, skillA, unitB, skillB) {\n        if (this.currentState === 'PRE_COMBAT_PLANNING') return { logs: [{ message: 'Clash blocked during Planning Phase.', class: 'error' }], clashWinner: null, damageResult: null };"),
    ]

    for search, replace in replacements:
        if replace not in content:
            content = content.replace(search, replace, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
