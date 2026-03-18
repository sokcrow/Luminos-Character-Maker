with open('hoja_personaje.js', 'r') as f:
    js = f.read()
idx = js.find('// Actualización del HUD de Combate (Vitales)')
print(js[idx:idx+800])
