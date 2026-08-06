import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Redundancy for Unfocused Volley:
    # If the only target left is the original one, it should still mark it strictly as an Unopposed Attack (no randomness since there's only 1 target)
    # The current code already assigns randomly among possible targets. If there's only 1, it picks that 1.
    # We should add a specific log / mark for Unopposed Attack logic.

    search_logic = """                    unitDefender = randomTarget;
                    context.defender = unitDefender;
                    context.targetsHit = [unitDefender];
                    result.attackLogs.push({ message: `Retargeting coin to ${unitDefender.name} ([Unfocused Volley]).`, class: 'clash-info' });
                    // NOTE: marked as Unopposed Attack logic strictly.
"""
    replace_logic = """                    unitDefender = randomTarget;
                    context.defender = unitDefender;
                    context.targetsHit = [unitDefender];
                    // Always treat as unopposed if retargeted (or if it was already unopposed). Even if it hits the clash target, we enforce unopposed resolution rules here for damage
                    options.clashResult = null; // Forces unopposed damage logic
                    if (possibleTargets.length === 1 && unitDefender === originalDefender) {
                        result.attackLogs.push({ message: `Only one target remaining, unloading remaining coins on ${unitDefender.name} ([Unfocused Volley - Unopposed]).`, class: 'clash-info' });
                    } else {
                        result.attackLogs.push({ message: `Retargeting coin to ${unitDefender.name} ([Unfocused Volley - Unopposed]).`, class: 'clash-info' });
                    }
"""
    if "options.clashResult = null;" not in content:
        content = content.replace(search_logic, replace_logic, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
