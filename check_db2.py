import re

with open('pantalla_dm.html', 'r') as f:
    content = f.read()

match = re.search(r'function guardarCambiosCombateJugador.*?\{.*?\}', content, re.DOTALL)
if match:
    print(match.group(0)[:500])
else:
    print("Function not found in HTML.")
