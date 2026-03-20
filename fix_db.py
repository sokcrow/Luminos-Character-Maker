with open('src/features/character-sheet.js', 'r') as f:
    content = f.read()

content = "import { db } from '../core/firebase-config.js';\n" + content

with open('src/features/character-sheet.js', 'w') as f:
    f.write(content)
