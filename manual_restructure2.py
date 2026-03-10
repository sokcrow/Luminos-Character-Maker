import re

with open('hoja_personaje.html', 'r', encoding='utf-8') as f:
    content = f.read()

# I want to make sure I get the header and put it inside the "vitals" or "profile" app.
# Looking at the current structure, everything is inside <div class="sheet-main-content"> right now.

# Let's manually replace the structure to ensure we have the exact layout.
# We will use the existing `hoja_personaje_restructured.html` as a template, since it successfully extracted the blocks.

with open('hoja_personaje_restructured.html', 'r', encoding='utf-8') as f:
    restructured_content = f.read()

# Let's write that over hoja_personaje.html instead, because it seemed more correct based on the python script.
with open('hoja_personaje.html', 'w', encoding='utf-8') as f:
    f.write(restructured_content)
