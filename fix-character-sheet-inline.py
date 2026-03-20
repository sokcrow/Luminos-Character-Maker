import re

with open('src/features/character-sheet-inline.js', 'r') as f:
    content = f.read()

# The regex in tools_hoja.py might have failed to remove it if there were newlines or spacing differences.
# Let's just remove the explicit lines.
content = re.sub(r'const firebaseConfig = {[\s\S]*?};\s*', '', content)
content = re.sub(r'firebase\.initializeApp\(firebaseConfig\);\s*', '', content)
content = re.sub(r'const db = firebase\.database\(\);\s*', '', content)

with open('src/features/character-sheet-inline.js', 'w') as f:
    f.write(content)
