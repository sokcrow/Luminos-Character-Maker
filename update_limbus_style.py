import re

def update_css():
    with open('hoja_personaje.css', 'r') as f:
        content = f.read()

    # 1. Update variables
    root_pattern = re.compile(r':root\s*\{[^}]*\}', re.DOTALL)
    new_root = """:root {
  --limbus-cream: #E8E4D9; /* Fondo principal interior */
  --limbus-brown: #3E2723; /* Texto inactivo, bordes gruesos exteriores */
  --limbus-red: #D32F2F; /* Línea perimetral interior fina */
  --limbus-gold: #FFD700; /* Bordes de estado activo/foco */
  --limbus-black: #0B0A0A; /* Fondos de pestañas activas y exterior */

  /* Sobrescribiendo tus variables existentes para no romper el HTML de golpe */
  --bg-main: var(--limbus-black);
  --bg-card: var(--limbus-black);
  --bg-dark: var(--limbus-black);
  --bg-panel: var(--limbus-cream);
  --text-main: var(--limbus-brown);
  --text-muted: #5D4037;
  --primary: var(--limbus-gold);
  --border-color: var(--limbus-brown);
  --border-accent: var(--limbus-gold);
  --red-limbus: var(--limbus-brown);
  --red-neon: var(--limbus-brown);
  --cyan-tech: var(--limbus-brown);
}

/* Forzar geometría estricta y matar el neón en todo el documento */
* {
  box-shadow: none !important;
  text-shadow: none !important;
  border-radius: 0 !important;
  font-family: 'Courier New', Courier, monospace; /* O una sans-serif muy limpia y cruda */
}

/* El Marco Limbus */
.limbus-container {
  background-color: var(--limbus-cream) !important;
  color: var(--limbus-brown) !important;
  border: 6px solid var(--limbus-brown) !important;
  position: relative;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 2px,
    rgba(62, 39, 35, 0.08) 2px,
    rgba(62, 39, 35, 0.08) 4px
  ) !important;
}

.limbus-container::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  border: 1px solid var(--limbus-red) !important;
  pointer-events: none;
  z-index: 10;
}

/* Estado Normal / Inactivo */
.tab-btn, .btn-tactico, .sheet-nav-btn {
  background-color: var(--limbus-cream) !important;
  color: var(--limbus-brown) !important;
  border: 1px solid var(--limbus-brown) !important;
  text-transform: uppercase !important;
  font-weight: bold !important;
}

/* Estado Activo / Seleccionado */
.tab-btn.active, .btn-tactico:focus, .btn-tactico.active, .sheet-nav-btn.active {
  background-color: var(--limbus-black) !important;
  color: var(--limbus-cream) !important;
  border: 1px solid var(--limbus-gold) !important;
  outline: none !important;
}
"""

    # We replace the root entirely or prepend the universal rule
    content = re.sub(root_pattern, new_root, content, count=1)

    with open('hoja_personaje.css', 'w') as f:
        f.write(content)


if __name__ == "__main__":
    update_css()
    print("Done")
