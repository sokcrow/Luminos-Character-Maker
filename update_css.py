import re

with open('hoja_personaje.css', 'r') as f:
    css_content = f.read()

new_css = re.sub(
    r'\.hud-right-container, \.theatre-controls\s*{[^}]*}',
    '''.hud-right-container, .theatre-controls {
    position: fixed !important;
    bottom: 25vh !important; /* Se sienta exactamente sobre el wrapper del diálogo */
    right: 20px !important;
    display: flex !important;
    flex-direction: column-reverse !important; /* INVIERTE EL ORDEN: Crece hacia arriba */
    align-items: center !important;
    gap: 20px !important;
    z-index: 9999 !important;
    padding-bottom: 20px !important; /* Margen de respiro contra el cuadro de texto */
    margin: 0 !important;
}''',
    css_content
)

with open('hoja_personaje.css', 'w') as f:
    f.write(new_css)

with open('pantalla_dm.html', 'r') as f:
    html_content = f.read()

new_html = re.sub(
    r'\.hud-right-container, \.theatre-controls\s*{[^}]*}',
    '''.hud-right-container, .theatre-controls {
    position: fixed !important;
    bottom: 25vh !important; /* Se sienta exactamente sobre el wrapper del diálogo */
    right: 20px !important;
    display: flex !important;
    flex-direction: column-reverse !important; /* INVIERTE EL ORDEN: Crece hacia arriba */
    align-items: center !important;
    gap: 20px !important;
    z-index: 9999 !important;
    padding-bottom: 20px !important; /* Margen de respiro contra el cuadro de texto */
    margin: 0 !important;
}''',
    html_content
)

with open('pantalla_dm.html', 'w') as f:
    f.write(new_html)

print("CSS updated in both files.")
