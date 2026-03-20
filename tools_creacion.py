import re

with open('creacion_personaje.html', 'r') as f:
    content = f.read()

# Extract styles
style_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
if style_match:
    with open('styles/menus/character-creation.css', 'w') as f:
        f.write(style_match.group(1).strip())

# Replace style block
content = re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="styles/menus/character-creation.css">', content, flags=re.DOTALL)

# Find script block containing config and db
script_match = re.search(r'<script>\s*const firebaseConfig.*?</script>', content, re.DOTALL)
if script_match:
    # Just remove it, since we'll use the module
    content = content.replace(script_match.group(0), '')

# Find main script block
main_script_match = re.search(r'<script>\s*document\.addEventListener\(\'DOMContentLoaded\', \(\) => \{(.*?)\}\);\s*</script>', content, re.DOTALL)

if main_script_match:
    main_script_content = main_script_match.group(1)

    # We need to split the data constants from the logic.
    # The data constants are `racesData`, `backgroundsData`, `professionsData`, `psychologicalBackgroundsData`
    # Let's try to extract them automatically

    # Find the data section (which ends before `const modValues = {`)
    mod_values_idx = main_script_content.find("const modValues = {")
    if mod_values_idx != -1:
        data_content = main_script_content[:mod_values_idx].strip()
        logic_content = main_script_content[mod_values_idx:].strip()

        with open('src/features/character-data.js', 'w') as f:
            f.write(data_content)
            f.write("\n\nexport { atributosLista, skillsTree, classesData, backgroundsData, professionsData, psychologicalBackgroundsData, racesData };\n")

        with open('src/features/character-maker.js', 'w') as f:
            f.write("import { db } from '../core/firebase-config.js';\n")
            f.write("import { atributosLista, skillsTree, classesData, backgroundsData, professionsData, psychologicalBackgroundsData, racesData } from './character-data.js';\n\n")
            f.write("document.addEventListener('DOMContentLoaded', () => {\n")
            f.write(logic_content)
            f.write("\n});\n")
    else:
        # If we can't find modValues, just dump everything into character-maker.js
        with open('src/features/character-maker.js', 'w') as f:
            f.write("import { db } from '../core/firebase-config.js';\n\n")
            f.write("document.addEventListener('DOMContentLoaded', () => {\n")
            f.write(main_script_content)
            f.write("\n});\n")

    content = content.replace(main_script_match.group(0), '<script type="module" src="src/features/character-maker.js"></script>')

with open('creacion_personaje.html', 'w') as f:
    f.write(content)
