import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    search = "let baseDmg = finalResistMultiplier * finalCoinPower * (1 + dmgDealtMultiplierMod);"
    replace = "let baseDmg = finalResistMultiplier * finalCoinPower * (1 + dmgDealtMultiplierMod) * flankingMultiplier;"

    if "flankingMultiplier;" not in content:
        content = content.replace(search, replace, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
