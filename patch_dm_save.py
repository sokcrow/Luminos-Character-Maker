with open('pantalla_dm.html', 'r') as f:
    html = f.read()

search_save = """                  btnGuardar.onclick = () => {
                      const newLvl = parseInt(pCard.querySelector('.input-lvl').value) || 1;
                      const newXp = parseInt(pCard.querySelector('.input-xp').value) || 0;
                      const newHpBase = parseInt(pCard.querySelector('.input-hpbase').value) || 0;

                      db.ref(`campaña/jugadores/${nombre}/perfil`).update({
                          level: newLvl,
                          xp: newXp,
                          hp_base: newHpBase
                      }).then(() => {"""

replace_save = """                  btnGuardar.onclick = () => {
                      const newLvl = parseInt(pCard.querySelector('.input-lvl').value) || 1;
                      const newXp = parseInt(pCard.querySelector('.input-xp').value) || 0;
                      const newHpBase = parseInt(pCard.querySelector('.input-hpbase').value) || 0;
                      const newHpCoef = parseFloat(pCard.querySelector('.input-hpcoef').value) || 0;
                      const newHpActual = parseInt(pCard.querySelector('.input-hpactual').value) || 0;

                      const newHpMax = Math.floor(newHpBase + (newHpCoef * newLvl));

                      db.ref(`campaña/jugadores/${nombre}`).update({
                          level: newLvl,
                          xp: newXp,
                          hp_base: newHpBase,
                          hp_coefficient: newHpCoef,
                          hp_max: newHpMax
                      }).then(() => {
                          return db.ref(`campaña/jugadores/${nombre}/combatStats`).update({
                              hp_max: newHpMax,
                              hp_actual: newHpActual,
                              hp_base: newHpBase
                          });
                      }).then(() => {"""

if search_save in html:
    html = html.replace(search_save, replace_save, 1)
    with open('pantalla_dm.html', 'w') as f:
        f.write(html)
    print("Patched save logic")
else:
    print("Could not find save logic")
