import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Insert state variables and Encounter Start trigger
    insertion = """const CombatEngine = {
    // Game State
    currentState: 'COMBAT_ACTIVE', // 'PRE_COMBAT_PLANNING', 'COMBAT_ACTIVE'

    triggerEncounterStart: function() {
        this.currentState = 'COMBAT_ACTIVE';
        // Add additional logic if needed when planning ends
    },
"""
    if "currentState: 'COMBAT_ACTIVE'," not in content:
        content = content.replace("const CombatEngine = {", insertion, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
