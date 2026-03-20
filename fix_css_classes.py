import re

def fix_css_classes(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Make sure panel-cyber, cyber-panel, etc in CSS are updated too
    content = content.replace('.cyber-panel', '.limbus-container')
    content = content.replace('.panel-cyber', '.limbus-container')
    content = content.replace('.btn-cyber', '.btn-tactico')
    content = content.replace('.card-cyber', '.limbus-container')
    content = content.replace('.modal-cyber', '.limbus-container.modal')
    content = content.replace('.form-cyber', '.limbus-container')

    # cyber-panel-title -> limbus-title or similar
    content = content.replace('.cyber-panel-title', '.limbus-title')

    with open(filename, 'w') as f:
        f.write(content)

fix_css_classes('hoja_personaje.css')

def fix_html_classes(filename):
    with open(filename, 'r') as f:
        content = f.read()

    content = content.replace('cyber-panel-title', 'limbus-title')

    with open(filename, 'w') as f:
        f.write(content)

fix_html_classes('hoja_personaje.html')
