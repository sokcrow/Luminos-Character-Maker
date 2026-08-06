import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Ensure grid_pos is initialized
    search = "if (unit.damage_taken_multiplier === undefined) unit.damage_taken_multiplier = 1.0;"
    replace = "if (unit.damage_taken_multiplier === undefined) unit.damage_taken_multiplier = 1.0;\n        if (!unit.grid_pos) unit.grid_pos = {x: 0, y: 0};"

    if "unit.grid_pos = {x: 0, y: 0};" not in content:
        content = content.replace(search, replace, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
