import re

with open('hoja_personaje.css', 'r') as f:
    content = f.read()

# Replace the phone wrapper to remove the border and fixed width in mobile
new_css = """

/* Make the phone wrapper take full width and height on mobile devices */
@media (max-width: 600px) {
    .sheet-phone-wrapper {
        max-width: 100%;
        height: 100vh;
        border: none;
        border-radius: 0;
        box-shadow: none;
    }
}
"""

if "max-width: 100%;\n        height: 100vh;\n        border: none;\n        border-radius: 0;\n        box-shadow: none;" not in content:
    content += new_css

    with open('hoja_personaje.css', 'w') as f:
        f.write(content)
