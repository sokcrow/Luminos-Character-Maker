import re

with open("pantalla_dm.html", "r", encoding="utf-8") as f:
    html = f.read()

# Buscamos el div `.theatre-controls` y movemos sus contenidos al modal `#dm-teatro-options`
# Actually, the user says "El botón de hamburguesa SVG y el modal emergente SON EXCLUSIVAMENTE para agrupar los controles del Teatro de la Mente del DM."

# Si nos fijamos, hay un <div class="theatre-controls"> que tiene dentro varias cosas.
# Y había un `#btn-toggle-dm-tools` que era un botón que decía "🛠️ Mostrar Controles DM".

print("Length of file:", len(html))
