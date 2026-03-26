with open('hoja_personaje.css', 'r') as f:
    content = f.read()

import re

# We injected .limbus-hud-overlay { ... } into css.
# Let's just remove display: none !important from .limbus-hud-overlay if it exists
content = re.sub(r'\.limbus-hud-overlay\s*\{[^}]*display:\s*none\s*!important;[^}]*\}', '', content)

with open('hoja_personaje.css', 'w') as f:
    f.write(content)
