import re

with open('js/combatEngine.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'calculateAoETargets' in line:
        print(f"{i+1}: {line.strip()}")
