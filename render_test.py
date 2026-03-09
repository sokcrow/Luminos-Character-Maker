from bs4 import BeautifulSoup

with open('creacion_personaje.html', 'r') as f:
    soup = BeautifulSoup(f.read(), 'html.parser')

print("Options generated dynamically for perks in renderProfessions()")
# The code has this:
# let perksOptionsHtml = '<option value="" disabled selected>Selecciona UN Perk</option>';
# if (prof.perks) {
#    prof.perks.forEach(p => {
#        perksOptionsHtml += `<option value="${p.id}">${p.nombre}</option>`;
#    });
# }
