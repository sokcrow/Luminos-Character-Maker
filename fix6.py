import re

with open('hoja_personaje.js', 'r') as f:
    content = f.read()

content = content.replace(
    'if (el.tagName === "INPUT" && document.activeElement !== el) el.value = data.class;',
    'if (el.tagName === "INPUT") { if (document.activeElement !== el) el.value = data.class; }'
)

content = content.replace(
    'if (el.tagName === "INPUT" && document.activeElement !== el) el.value = data.race;',
    'if (el.tagName === "INPUT") { if (document.activeElement !== el) el.value = data.race; }'
)

content = content.replace(
    'if (el.tagName === "INPUT" && document.activeElement !== el) el.value = data.background;',
    'if (el.tagName === "INPUT") { if (document.activeElement !== el) el.value = data.background; }'
)

content = content.replace(
    'if (el.tagName === "INPUT" && document.activeElement !== el) el.value = data.identity;',
    'if (el.tagName === "INPUT") { if (document.activeElement !== el) el.value = data.identity; }'
)

with open('hoja_personaje.js', 'w') as f:
    f.write(content)
