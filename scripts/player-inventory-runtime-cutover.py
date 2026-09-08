from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def remove_balanced_div(source: str, id_value: str) -> str:
    marker = f'id="{id_value}"'
    marker_pos = source.find(marker)
    if marker_pos < 0:
        raise RuntimeError(f"missing HTML marker: {marker}")
    start = source.rfind("<div", 0, marker_pos)
    if start < 0:
        raise RuntimeError(f"missing opening div for {marker}")

    token_re = re.compile(r"<div\b|</div\s*>", re.IGNORECASE)
    depth = 0
    saw_open = False
    for match in token_re.finditer(source, start):
        token = match.group(0).lower()
        if token.startswith("<div"):
            depth += 1
            saw_open = True
        else:
            depth -= 1
            if saw_open and depth == 0:
                return source[:start] + source[match.end():]
    raise RuntimeError(f"unbalanced div for {marker}")


js_path = ROOT / "hoja_personaje.js"
js = js_path.read_text(encoding="utf-8")
start_marker = '    const invBtn = document.getElementById("btn-global-inventory");'
end_marker = '  // LÓGICA DE TIENDA DINÁMICA (COMPRAR / VENDER)'
start = js.find(start_marker)
end = js.find(end_marker, start)
if start < 0 or end < 0:
    raise RuntimeError("player inventory legacy JS markers changed")
legacy_chunk = js[start:end]
for expected in (
    "window.renderInventoryGrid = function",
    'window.addEventListener("item-move-action"',
    'window.addEventListener("item-load-action"',
    "playerInventoryListenerActive",
):
    if expected not in legacy_chunk:
        raise RuntimeError(f"expected legacy inventory code not found: {expected}")

replacement = (
    "    // Inventory modal lifecycle, rendering, actions and realtime are owned by\n"
    "    // LuminousInventoryHudV2 + the canonical Item Runtime stack.\n"
    "  } // Cierra el bloque de Mail / bootstrap; Inventory V2 lives in js/inventory-hud-v2.js\n\n"
)
js = js[:start] + replacement + js[end:]
js = js.replace(
    "  // --- Inventory Modal Logic ---\n  {\n    // Mail Tab Logic",
    "  // --- Mail listener setup (Inventory UI migrated to LuminousInventoryHudV2) ---\n  {\n    // Mail Tab Logic",
    1,
)
for forbidden in (
    "window.renderInventoryGrid = function",
    'window.addEventListener("item-move-action"',
    'window.addEventListener("item-load-action"',
    "playerInventoryListenerActive",
):
    if forbidden in js:
        raise RuntimeError(f"legacy player inventory code survived: {forbidden}")
js_path.write_text(js, encoding="utf-8")

html_path = ROOT / "hoja_personaje.html"
html = html_path.read_text(encoding="utf-8")
html = remove_balanced_div(html, "equipment-panel")
html = remove_balanced_div(html, "detail-equip-btn-container")
if 'id="equipment-panel"' in html or 'id="detail-equip-btn-container"' in html:
    raise RuntimeError("legacy inventory DOM survived cleanup")
for required in ('id="inv-active-grid"', 'id="inv-stash-grid"', 'id="inv-sintesis"', 'id="item-detail-card"'):
    if required not in html:
        raise RuntimeError(f"required Inventory V2/Synthesis DOM removed accidentally: {required}")
html_path.write_text(html, encoding="utf-8")

print("Player inventory legacy DOM/JS removed; Synthesis and canonical grids preserved.")
