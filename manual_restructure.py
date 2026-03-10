import re

with open('hoja_personaje.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure tabs display logic is removed from header
# Delete old tabs
content = re.sub(r'<div class="sheet-tabs">.*?</div>\n\s*<div class="sheet-main-content">', '<div class="sheet-main-content">', content, flags=re.DOTALL)

with open('hoja_personaje.html', 'w', encoding='utf-8') as f:
    f.write(content)
