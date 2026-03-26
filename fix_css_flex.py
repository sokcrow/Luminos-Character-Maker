with open('hoja_personaje.css', 'r') as f:
    content = f.read()

# Make sure limbus-hud-overlay has display flex when active but hidden by default.
# In the JS we used `.style.display = "flex"`.
# Ensure we don't have !important overriding it.
if "display: none !important;" in content and "limbus-hud-overlay" in content:
    print("Found display: none !important for limbus-hud-overlay. Fixing.")
