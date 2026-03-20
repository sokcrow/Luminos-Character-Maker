import re

def process_html(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Also clean neon from JS inline styles
    content = content.replace("span.style.color = 'var(--red-neon)';", "span.style.color = 'var(--limbus-red)';")
    content = content.replace("span.style.textShadow = '0 0 5px var(--red-neon)';", "span.style.textShadow = 'none';")

    with open(filename, 'w') as f:
        f.write(content)

process_html('hoja_personaje.html')
process_html('pantalla_dm.html')

def process_css(filename):
    with open(filename, 'r') as f:
        content = f.read()

    content = content.replace('var(--red-neon)', 'var(--limbus-red)')
    content = content.replace('var(--red-limbus)', 'var(--limbus-red)')
    content = content.replace('var(--cyan-tech)', 'var(--limbus-cream)')
    content = content.replace('var(--green-success)', 'var(--limbus-gold)')
    content = content.replace('var(--border-accent)', 'var(--limbus-gold)')

    with open(filename, 'w') as f:
        f.write(content)

process_css('hoja_personaje.css')
