import re

with open('hoja_personaje.js', 'r') as f:
    content = f.read()

roman_search = r"const tierStr = numberToRoman\(receta.tier_resultado \|\| 1\);"
roman_replace = r"const romanTiers = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];\n            const tierIndex = parseInt(receta.tier_resultado) || 1;\n            const tierStr = romanTiers[Math.min(tierIndex, 10)];"

content = re.sub(roman_search, roman_replace, content)

with open('hoja_personaje.js', 'w') as f:
    f.write(content)
