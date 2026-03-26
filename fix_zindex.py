with open('hoja_personaje.html', 'r') as f:
    content = f.read()

# Change z-index to 99999 so it sits on top of everything
import re
content = re.sub(r'z-index:\s*10000;', 'z-index: 99999 !important;', content)

with open('hoja_personaje.html', 'w') as f:
    f.write(content)
print("Updated z-index.")
