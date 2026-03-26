import re

with open('pantalla_dm.html', 'r') as f:
    content = f.read()

match = re.search(r'window\.abrirModalCombateJugador\s*=\s*function\(.*?\{.*?\}', content, re.DOTALL)
if match:
    print(match.group(0)[:1000])
else:
    print("Function window.abrirModalCombateJugador not found.")

match2 = re.search(r'function abrirModalCombateJugador\(.*?\{.*?\}', content, re.DOTALL)
if match2:
    print(match2.group(0)[:1000])
else:
    print("Function abrirModalCombateJugador not found.")
