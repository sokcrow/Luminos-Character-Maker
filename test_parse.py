import re

with open('hoja_personaje_clean.js', 'r') as f:
    content = f.read()

# Verify that there is no setAttrs or on('clicked') left
import sys

matches = re.findall(r"on\('clicked:", content)
print(f"Found {len(matches)} matches for on('clicked:")
if len(matches) > 0:
    for m in re.finditer(r"on\('clicked:([^\']+)", content):
        print(f"  {m.group(1)}")
