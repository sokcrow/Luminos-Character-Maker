import re
import os

def clean_classes(html_content):
    # Remove specific classes
    classes_to_remove = ["cyber-panel", "panel-cyber", "form-cyber", "btn-cyber", "modal-cyber", "card-cyber", "form-cyber-container"]
    for c in classes_to_remove:
        html_content = re.sub(rf'\b{c}\b', '', html_content)

    # Also clean up empty class attributes that might be left behind
    html_content = re.sub(r'class="\s*"', '', html_content)
    html_content = re.sub(r'class=\'\s*\'', '', html_content)

    return html_content

def apply_limbus_container(html_content):
    # This is trickier since we need to identify main containers.
    # We can look for divs that were previously 'panel-cyber' or 'cyber-panel' and make them 'limbus-container'.
    # For now, let's try replacing them directly instead of just removing.

    # Actually, we should map them:
    # cyber-panel -> limbus-container
    # panel-cyber -> limbus-container

    html_content = re.sub(r'\bcyber-panel\b', 'limbus-container', html_content)
    html_content = re.sub(r'\bpanel-cyber\b', 'limbus-container', html_content)

    # For btn-cyber -> tab-btn or btn-tactico
    html_content = re.sub(r'\bbtn-cyber\b', 'btn-tactico', html_content)

    # We should also replace the main inventory wrapper in hoja_personaje.html
    # In the prompt, it says: "Asigna la clase .limbus-container a los div principales que agrupan el contenido (como el "INVENTARIO ACTIVO" de tu imagen)."

    # Let's clean "neon", "cyber", "glow", "rounded" from classes
    # If a class contains neon, cyber, glow, rounded, we should probably remove it.

    # Let's manually replace specific known instances for btn-cyber
    html_content = re.sub(r'class="([^"]*)(neon|cyber|glow|rounded)([^"]*)"', lambda m: 'class="' + m.group(1).replace('neon','').replace('cyber','').replace('glow','').replace('rounded','') + m.group(3) + '"', html_content)
    html_content = re.sub(r'class="([^"]*)(neon|cyber|glow|rounded)([^"]*)"', lambda m: 'class="' + m.group(1).replace('neon','').replace('cyber','').replace('glow','').replace('rounded','') + m.group(3) + '"', html_content)

    return html_content

def process_file(filename):
    if not os.path.exists(filename):
        print(f"File {filename} not found.")
        return

    with open(filename, 'r') as f:
        content = f.read()

    # Remove inline neon/glow styles
    content = re.sub(r'color:\s*var\(--red-neon\);?', 'color: var(--limbus-red);', content)
    content = re.sub(r'text-shadow:\s*0 0 5px var\(--red-neon\);?', 'text-shadow: none !important;', content)
    content = re.sub(r'box-shadow:[^;]+;', '', content)
    content = re.sub(r'border-radius:[^;]+;', '', content)

    # cyber-panel -> limbus-container
    content = re.sub(r'\bcyber-panel\b', 'limbus-container', content)
    content = re.sub(r'\bpanel-cyber\b', 'limbus-container', content)

    # btn-cyber -> btn-tactico
    content = re.sub(r'\bbtn-cyber\b', 'btn-tactico', content)

    # modal-cyber -> limbus-container modal
    content = re.sub(r'\bmodal-cyber\b', 'limbus-container modal', content)

    # card-cyber -> limbus-container
    content = re.sub(r'\bcard-cyber\b', 'limbus-container', content)

    # Replace inline colors that are neon-like
    content = re.sub(r'#0df', 'var(--limbus-cream)', content)
    content = re.sub(r'#00ffff', 'var(--limbus-cream)', content)
    content = re.sub(r'#ff4444', 'var(--limbus-red)', content)

    # Clean up classes containing neon/cyber/glow/rounded
    def clean_class_attr(match):
        classes = match.group(1).split()
        cleaned = [c for c in classes if not any(x in c for x in ['neon', 'cyber', 'glow', 'rounded'])]
        return f'class="{" ".join(cleaned)}"'

    content = re.sub(r'class="([^"]+)"', clean_class_attr, content)

    # Make sure inventory active and other main parts get limbus-container
    # <div class="inventory-left-panel"> could be a good candidate
    content = content.replace('inventory-left-panel', 'inventory-left-panel limbus-container')
    content = content.replace('shop-main-panel', 'shop-main-panel limbus-container')

    # We should also update sheet-limbus-main class
    content = content.replace('sheet-limbus-main', 'sheet-limbus-main limbus-container')

    with open(filename, 'w') as f:
        f.write(content)
    print(f"Processed {filename}")

if __name__ == "__main__":
    process_file('hoja_personaje.html')
    process_file('pantalla_dm.html')
