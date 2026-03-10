import re

with open('hoja_personaje.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure we wrap everything after <div class="sheet-limbus-main"> in the phone wrapper correctly
start_main = content.find('<div class="sheet-limbus-main">') + len('<div class="sheet-limbus-main">')

new_header = """
    <!-- Global Phone Wrapper -->
    <div class="sheet-phone-wrapper">
"""

# Close phone wrapper before roll templates
end_screen = content.find('<!-- Roll Template -->')
if end_screen != -1:
    content = content[:end_screen] + "</div> <!-- End Phone Wrapper -->\n\n" + content[end_screen:]

# Apply
content = content[:start_main] + new_header + content[start_main:]

with open('hoja_personaje.html', 'w', encoding='utf-8') as f:
    f.write(content)
