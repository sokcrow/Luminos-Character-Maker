import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    search = "let damageWithOffensive = rawDamage * offMult;"
    replace = "let damageWithOffensive = rawDamage * offMult * flankingMultiplier;"

    if "flankingMultiplier;" not in content:
        content = content.replace(search, replace, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
