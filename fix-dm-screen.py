import re

with open('src/features/dm-screen.js', 'r') as f:
    content = f.read()

content = re.sub(r'const firebaseConfig = {[\s\S]*?};\s*', '', content)
content = re.sub(r'firebase\.initializeApp\(firebaseConfig\);\s*', '', content)
content = re.sub(r'const db = firebase\.database\(\);\s*', '', content)

with open('src/features/dm-screen.js', 'w') as f:
    f.write(content)
