import sys

with open('pantalla_dm.html', 'r') as f:
    html = f.read()

search_string = """              const perfil = data.perfil || {};
              const lvl = perfil.level || 1;
              const xp = perfil.xp || 0;
              const hpMax = perfil.hp_max || 0;
              const hpBase = perfil.hp_base || 0;
              const clase = perfil.clase || 'Desconocida';
              const raza = perfil.raza || 'Desconocida';"""

replace_string = """              const lvl = data.level || 1;
              const xp = data.xp || 0;
              const hpBase = data.hp_base || 0;
              const hpCoef = data.hp_coefficient || 0;
              const hpMax = data.hp_max || 0;
              const combatStats = data.combatStats || {};
              const hpActual = combatStats.hp_actual !== undefined ? combatStats.hp_actual : hpMax;
              const clase = data.class || 'Desconocida';
              const raza = data.race || 'Desconocida';"""

if search_string in html:
    html = html.replace(search_string, replace_string, 1)
    with open('pantalla_dm.html', 'w') as f:
        f.write(html)
    print("Patched successfully")
else:
    print("Search string not found")
