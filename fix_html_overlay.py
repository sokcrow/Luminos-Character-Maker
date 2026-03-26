with open('hoja_personaje.html', 'r') as f:
    content = f.read()

# Let's see if the limbus-hud-overlay is correctly structured
if "limbus-hud-overlay" in content:
    print("limbus-hud-overlay exists. Let's inspect it.")
    import re
    match = re.search(r'<div id="limbus-hud-overlay"[^>]*>.*?(?=</div>\s*</div>\s*</div>\s*</div>)', content, re.DOTALL)
    if match:
        # print(match.group(0)[:500])
        pass
    else:
        print("Could not easily extract overlay.")
