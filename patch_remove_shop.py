import re

with open('hoja_personaje.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the shop tab entirely
content = re.sub(
    r'<!-- Shop Tab -->\s*<div class="sheet-tab-content sheet-tab-shop" id="shop-app">.*?</div>\s*</div>\s*</div>\s*</div>',
    '',
    content,
    flags=re.DOTALL
)

with open('hoja_personaje.html', 'w', encoding='utf-8') as f:
    f.write(content)
