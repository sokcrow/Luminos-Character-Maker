with open('hoja_personaje.js', 'r') as f:
    content = f.read()

content = content.replace("    reqDc.innerText = receta.dc;|    reqSkill.innerText = receta.habilidad.toUpperCase();\n    reqDc.innerText = receta.dc;", "    reqDc.innerText = receta.dc;")

with open('hoja_personaje.js', 'w') as f:
    f.write(content)
