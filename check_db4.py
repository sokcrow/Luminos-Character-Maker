import re

with open('pantalla_dm.html', 'r') as f:
    content = f.read()

match = re.search(r'document\.getElementById\("btn-save-combat-jugador"\)\.onclick\s*=\s*(async\s*)?\(\)\s*=>\s*\{.*?\}', content, re.DOTALL)
if match:
    print(match.group(0)[:800])
else:
    print("Save handler 2 not found.")
