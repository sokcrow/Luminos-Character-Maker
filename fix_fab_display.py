import re

def fix():
    with open('hoja_personaje.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Right now floating actions container is under #theatre-view-player ? Actually we put it right before #player-combat-hud.
    # The buttons in the screenshot show Phone, Heart, Inventory, Shop... but they don't seem to have the Base.png background because Base.png might be an invalid path in playwright or it's transparent.
    # Wait, the screenshot shows the buttons in the top right! They have the icons, but they are smaller and the "Shop" button has an orange square around it.

    # Ah, the Shop button is glowing because of the drop shadow, but it's a square box because it's rendering an SVG that might have a square background? Or drop shadow is applied to the button instead of SVG.
    # No, the screenshot shows the Shop button has the Base.png frame glowing.

    # Wait, the 56x56 frame is Base.png. The Shop button in the screenshot HAS the Base.png background! The other buttons don't have it visible. Why? Because the Base.png might not have loaded? But Shop button has it.

    # Let's fix the drop-shadow issue on hover. In RULEBOOK 5: "Apply filter: drop-shadow ONLY to the .svg-icon on hover/active states so the glow follows the vector shape, not a square box."

    with open('hoja_personaje.css', 'r', encoding='utf-8') as f:
        css = f.read()

    css = css.replace(
""".btn-icon-base:hover,
.btn-icon-base:active {
    filter: drop-shadow(0 0 4px #FFD700);
}""", "")

    css = css.replace(
""".btn-icon-base:hover .svg-icon,
.btn-icon-base:active .svg-icon {
    filter: drop-shadow(0 0 4px #FFD700);
}""", "")

    if '.btn-icon-base:hover .svg-icon' not in css:
        css += """
.btn-icon-base:hover .svg-icon,
.btn-icon-base:active .svg-icon {
    filter: drop-shadow(0 0 6px #FFD700);
}
"""

    with open('hoja_personaje.css', 'w', encoding='utf-8') as f:
        f.write(css)

fix()
