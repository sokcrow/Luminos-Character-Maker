import sys
with open('hoja_personaje.js', 'r') as f:
    content = f.read()

idx = content.find("document.addEventListener('change'")
if idx != -1:
    print(content[idx:idx+1500])
