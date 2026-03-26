import re

with open('pantalla_dm.html', 'r') as f:
    content = f.read()

match = re.search(r'window\.abrirModalEdicionCombateJugador.*?\{.*?(?=\})', content, re.DOTALL)
if match:
    print(match.group(0)[:1000])
else:
    print("Function not found.")
