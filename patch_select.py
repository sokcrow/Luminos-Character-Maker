import re

with open("pantalla_dm.html", "r") as f:
    content = f.read()

injection = """
          // Lógica para poblar selectores de Forja
          const selectResultado = document.getElementById("receta-item-resultado");
          const selectsIngredientes = [1, 2, 3, 4, 5].map(i => document.getElementById(`receta-ingrediente-${i}-id`));

          let optionsHTML = '<option value="">Selecciona un ítem...</option>';
          if (items) {
             // Sort items alphabetically for easier selection
             const sortedItems = Object.keys(items).map(k => ({id: k, name: items[k].nombre})).sort((a,b) => a.name.localeCompare(b.name));
             sortedItems.forEach(itemObj => {
                 optionsHTML += `<option value="${itemObj.id}">${itemObj.name}</option>`;
             });
          }

          if (selectResultado) {
             const currentRes = selectResultado.value;
             selectResultado.innerHTML = optionsHTML;
             if (currentRes && items && items[currentRes]) selectResultado.value = currentRes;
          }

          selectsIngredientes.forEach(sel => {
             if (sel) {
                const currentVal = sel.value;
                sel.innerHTML = optionsHTML;
                if (currentVal && items && items[currentVal]) sel.value = currentVal;
             }
          });
"""

if "Lógica para poblar selectores de Forja" not in content:
    content = content.replace("dbItemsCache = items || {};", "dbItemsCache = items || {};\n" + injection)
    with open("pantalla_dm.html", "w") as f:
        f.write(content)
    print("Patch applied successfully.")
else:
    print("Patch already applied.")
