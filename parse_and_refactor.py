import re

with open('hoja_personaje.js', 'r') as f:
    text = f.read()

# Make sure we didn't break renderInventoryGrid, it's global and should remain as is.
if "window.renderInventoryGrid = function(gridId, itemsObj, isStash)" in text:
    print("renderInventoryGrid preserved")
else:
    print("WARNING: renderInventoryGrid missing")

# Check if Mesa de Trabajo (Crafting) functions are preserved.
if "renderRecetasCrafteo" in text:
    print("renderRecetasCrafteo preserved")
else:
    print("WARNING: renderRecetasCrafteo missing")

# Check if Shop functions are preserved
if "renderizarComprar" in text:
    print("renderizarComprar preserved")
else:
    print("WARNING: renderizarComprar missing")
