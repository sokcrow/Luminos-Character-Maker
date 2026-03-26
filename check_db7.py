import re

with open('pantalla_dm.html', 'r') as f:
    content = f.read()

match = re.search(r'\.getElementById\("btn-save-stats"\)\s*\.addEventListener\("click",\s*\(\)\s*=>\s*\{.*?\n          \}\);', content, re.DOTALL)
if match:
    print(match.group(0))
else:
    print("Not found")
