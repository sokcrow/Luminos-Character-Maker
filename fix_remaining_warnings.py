import re

def fix_css_warnings(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Remove the whole definition or just fix it. Since we define the root, let's keep it safe.
    content = content.replace('--red-neon: var(--limbus-brown);', '')
    content = content.replace('var(--red-neon, #d93829)', 'var(--limbus-red)')
    content = content.replace('.cyberpunk-container', '.limbus-container')
    content = content.replace('/* Slightly rounded edges instead of full circle for tech look */', '')
    content = content.replace('.equip-slot.hover-glow-cyan:hover', '.equip-slot.hover-active:hover')

    with open(filename, 'w') as f:
        f.write(content)

fix_css_warnings('hoja_personaje.css')

def fix_html_warnings(filename):
    with open(filename, 'r') as f:
        content = f.read()

    content = content.replace('.form-cyber-container', '.form-container')
    content = content.replace('.form-cyber', '.limbus-container')
    content = content.replace('/* --- ESTILOS CYBERPUNK PARA FORJA Y MERCADO --- */', '/* --- ESTILOS LIMBUS PARA FORJA Y MERCADO --- */')
    content = content.replace('form-cyber-container', 'form-container')
    content = content.replace('form-cyber', 'limbus-container')

    with open(filename, 'w') as f:
        f.write(content)

fix_html_warnings('pantalla_dm.html')
