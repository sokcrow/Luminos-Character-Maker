with open('hoja_personaje.html', 'r', encoding='utf-8') as f:
    c = f.read()

# check where main blocks are
print("phone-statusbar:", c.find('sheet-phone-statusbar'))
print("sheet-phone-screen:", c.find('sheet-phone-screen'))
print("Stats Tab Content:", c.find('Stats Tab Content'))
