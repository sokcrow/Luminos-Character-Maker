import re

with open('pantalla_dm.html', 'r') as f:
    content = f.read()

match = re.search(r'\.getElementById\("btn-save-stats"\)\s*\.addEventListener\("click",\s*\(\)\s*=>\s*\{.*?(?=\.getElementById\("btn-save-inventario"\))', content, re.DOTALL)
if match:
    print(match.group(0)[-1000:])
else:
    print("Not found")
