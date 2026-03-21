import re

with open('index.html', 'r') as f:
    content = f.read()

# Remove the legacy player ID input
content = re.sub(r'<!-- Legacy Player ID input.*?</label>\s*<input type="text" id="auth-player-id".*?>\s*</div>\n', '', content, flags=re.DOTALL)

# Remove JS references to it
content = re.sub(r'\s*playerIdGroup\.style\.display = \'flex\';', '', content)
content = re.sub(r'\s*playerIdGroup\.style\.display = \'none\';', '', content)
content = re.sub(r'\s*const playerIdGroup = document\.getElementById\(\'player-id-group\'\);', '', content)

with open('index.html', 'w') as f:
    f.write(content)
