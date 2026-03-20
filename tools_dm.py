import re

with open('pantalla_dm.html', 'r') as f:
    content = f.read()

# Extract styles
style_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
if style_match:
    with open('styles/menus/dm-screen.css', 'w') as f:
        f.write(style_match.group(1).strip())

# Replace style block
content = re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="styles/menus/dm-screen.css">', content, flags=re.DOTALL)

# Find inline script
inline_script_match = re.search(r'<script>\s*const firebaseConfig.*?</script>', content, re.DOTALL)
if inline_script_match:
    inline_script_content = inline_script_match.group(0)

    logic_code = inline_script_content.replace('<script>', '').replace('</script>', '')
    logic_code = re.sub(r'const firebaseConfig = \{.*?\};\s*firebase\.initializeApp\(firebaseConfig\);\s*const db = firebase\.database\(\);', '', logic_code, flags=re.DOTALL)

    with open('src/features/dm-screen.js', 'w') as f:
        f.write("import { db } from '../core/firebase-config.js';\n")
        f.write(logic_code.strip())

    content = content.replace(inline_script_match.group(0), '<script type="module" src="src/features/dm-screen.js"></script>')

with open('pantalla_dm.html', 'w') as f:
    f.write(content)
