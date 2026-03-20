import re

with open('index.html', 'r') as f:
    content = f.read()

# Extract styles
style_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
if style_match:
    with open('styles/layout/main.css', 'w') as f:
        f.write(style_match.group(1).strip())

# Replace style block
content = re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="styles/layout/main.css">', content, flags=re.DOTALL)

# Find script block
script_match = re.search(r'<script>\s*const firebaseConfig.*?</script>', content, re.DOTALL)
if script_match:
    script_content = script_match.group(0)

    # Extract firebase config
    firebase_match = re.search(r'const firebaseConfig = {.*?};\s*firebase\.initializeApp\(firebaseConfig\);\s*const db = firebase\.database\(\);', script_content, re.DOTALL)
    if firebase_match:
        with open('src/core/firebase-config.js', 'w') as f:
            f.write(firebase_match.group(0).strip())
            f.write('\n\nexport { db };\n')

    # Extract DOMContentLoaded logic
    logic_match = re.search(r'document\.addEventListener\(\'DOMContentLoaded\'.*', script_content, re.DOTALL)
    if logic_match:
        logic_code = logic_match.group(0)
        # remove the closing script tag
        logic_code = re.sub(r'</script>', '', logic_code).strip()
        with open('src/features/login.js', 'w') as f:
            f.write("import { db } from '../core/firebase-config.js';\n\n")
            f.write(logic_code)

# Replace script block
content = re.sub(r'<script>\s*const firebaseConfig.*?</script>', '<script type="module" src="src/core/firebase-config.js"></script>\n    <script type="module" src="src/features/login.js"></script>', content, flags=re.DOTALL)

with open('index.html', 'w') as f:
    f.write(content)
