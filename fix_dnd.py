import re

with open("hoja_personaje.js", "r", encoding="utf-8") as f:
    js = f.read()

# Make sure handleEquipItem and dnd logic actually exists where it should be.
# We will just write a small check to verify it was injected correctly.
search = r"const handleEquipItem"
if search in js:
    print("handleEquipItem found in JS file.")
else:
    print("handleEquipItem MISSING from JS file. Need to inject.")
