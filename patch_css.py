import re

with open('hoja_personaje.css', 'r') as f:
    content = f.read()

# Replace the complicated sibling selector with a simpler one that targets the root level state
content = re.sub(
    r"\.sheet-limbus-main input\[name=\"attr_tab\"\]\[value=\"([a-z]+)\"\] \~ \* \.sheet-phone-screen \.sheet-tab-\1,",
    r"input.sheet-state-tab[value=\"\1\"] ~ .sheet-phone-screen .sheet-tab-\1,",
    content
)

content = re.sub(
    r"\.sheet-limbus-main input\[name=\"attr_tab\"\]\[value=\"shop\"\] \~ \* \.sheet-phone-screen \.sheet-tab-shop",
    r"input.sheet-state-tab[value=\"shop\"] ~ .sheet-phone-screen .sheet-tab-shop",
    content
)

with open('hoja_personaje.css', 'w') as f:
    f.write(content)
