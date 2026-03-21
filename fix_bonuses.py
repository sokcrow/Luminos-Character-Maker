import re

with open("hoja_personaje.js", "r", encoding="utf-8") as f:
    js = f.read()

# Replace initial bonuses dict
search1 = r"accesorio_2: \{ off: 0, def: 0 \}"
replace1 = '''accesorio_2: { off: 0, def: 0 },
        accesorio_3: { off: 0, def: 0 },
        accesorio_4: { off: 0, def: 0 }'''
js = js.replace(search1, replace1)

# Replace logic condition
search2 = r"item\.equipped_slot === \'accesorio_1\' \|\| item\.equipped_slot === \'accesorio_2\'"
replace2 = "item.equipped_slot === 'accesorio_1' || item.equipped_slot === 'accesorio_2' || item.equipped_slot === 'accesorio_3' || item.equipped_slot === 'accesorio_4'"
js = js.replace(search2, replace2)

# Replace UI condition
search3 = r"slotId === \'accesorio_1\' \|\| slotId === \'accesorio_2\'"
replace3 = "slotId.startsWith('accesorio_')"
js = js.replace(search3, replace3)


with open("hoja_personaje.js", "w", encoding="utf-8") as f:
    f.write(js)
print("Accessories logic updated.")
