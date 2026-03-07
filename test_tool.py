import re

with open("index.html", "r") as f:
    html = f.read()

match = re.search(r'\.tab-content\.active\s*\{.*?\}(?:\s*)', html, re.DOTALL)
if match:
    print("Found .tab-content.active at index", match.start())
else:
    print("Not found")
