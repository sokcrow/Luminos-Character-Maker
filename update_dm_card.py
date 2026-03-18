with open('pantalla_dm.html', 'r') as f:
    html = f.read()

search_html = """                      <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
                          <label style="color:#c49a00; font-size:12px;">Calc Max HP:</label>
                          <input type="number" class="input-hpmax" value="${hpMax}" style="width:60px; padding:3px; background:#222; color:#fff; border:1px solid #444; border-radius:3px; text-align:center;" readonly title="Calculado por la hoja">
                      </div>"""

replace_html = """                      <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
                          <label style="color:#c49a00; font-size:12px;">HP Coef:</label>
                          <input type="number" step="0.01" class="input-hpcoef" value="${hpCoef}" style="width:60px; padding:3px; background:#222; color:#fff; border:1px solid #444; border-radius:3px; text-align:center;">
                      </div>
                      <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
                          <label style="color:#0df; font-size:12px;">HP Actual:</label>
                          <input type="number" class="input-hpactual" value="${hpActual}" style="width:60px; padding:3px; background:#222; color:#fff; border:1px solid #444; border-radius:3px; text-align:center;">
                      </div>
                      <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
                          <label style="color:#c49a00; font-size:12px;">Calc Max HP:</label>
                          <input type="number" class="input-hpmax" value="${hpMax}" style="width:60px; padding:3px; background:#222; color:#fff; border:1px solid #444; border-radius:3px; text-align:center;" readonly title="Calculado por nivel, base y coef">
                      </div>"""

if search_html in html:
    html = html.replace(search_html, replace_html, 1)
    with open('pantalla_dm.html', 'w') as f:
        f.write(html)
    print("Patched innerHTML")
else:
    print("Could not find innerHTML")

search_updates = """                  if (document.activeElement !== hpBaseInput) hpBaseInput.value = hpBase;
                  if (document.activeElement !== hpMaxInput) hpMaxInput.value = hpMax;"""

replace_updates = """                  if (document.activeElement !== hpBaseInput) hpBaseInput.value = hpBase;
                  const hpCoefInput = pCard.querySelector('.input-hpcoef');
                  const hpActualInput = pCard.querySelector('.input-hpactual');
                  if (hpCoefInput && document.activeElement !== hpCoefInput) hpCoefInput.value = hpCoef;
                  if (hpActualInput && document.activeElement !== hpActualInput) hpActualInput.value = hpActual;
                  if (document.activeElement !== hpMaxInput) hpMaxInput.value = hpMax;"""

if search_updates in html:
    html = html.replace(search_updates, replace_updates, 1)
    with open('pantalla_dm.html', 'w') as f:
        f.write(html)
    print("Patched element updates")
else:
    print("Could not find element updates")
