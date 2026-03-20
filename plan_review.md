1. Add strict Limbus Company visual design system.
2. Update global CSS variables to Limbus palette: `--limbus-cream`, `--limbus-brown`, `--limbus-red`, `--limbus-gold`, `--limbus-black`. Override old variables.
3. Remove global neon colors, box shadows, text shadows, and border radii using `* { box-shadow: none !important; text-shadow: none !important; border-radius: 0 !important; }`.
4. Create `.limbus-container` CSS class with thick brown borders, inner red thin border (via `::after`), and fine dark horizontal scanlines.
5. Update active/inactive state of tabs and tactical buttons to have strict contrast (cream/brown vs black/gold/cream).
6. Clean up HTML files (`hoja_personaje.html`, `pantalla_dm.html`): Remove all usages of neon, cyber, glow, rounded classes.
7. Assign `.limbus-container` class to main structure divs (like `inventory-left-panel`, `shop-main-panel`, `.panel-cyber` etc) to wrap them in the structural borders.
8. Complete pre commit steps to ensure changes are formatted and valid.
9. Commit and push the changes with the provided PR title and message.
