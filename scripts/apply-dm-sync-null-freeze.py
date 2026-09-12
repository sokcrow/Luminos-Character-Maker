from pathlib import Path

path = Path("pantalla_dm.html")
text = path.read_text(encoding="utf-8")
old = '''        const toggleMesaCrafteo = document.getElementById("toggle-mesa-crafteo");
        db.ref("campaña/estado_mundo/mesa_crafteo_activa").on("value", (snap) => {
            toggleMesaCrafteo.checked = !!snap.val();
        });
        toggleMesaCrafteo.addEventListener("change", (e) => {
            db.ref("campaña/estado_mundo/mesa_crafteo_activa").set(e.target.checked);
        });
'''
new = '''        const toggleMesaCrafteo = document.getElementById("toggle-mesa-crafteo");
        // Este control pertenecía al panel de crafteo legacy y puede no existir
        // desde que el editor se movió a la herramienta standalone. No debemos
        // registrar callbacks de Firebase ni eventos contra un nodo inexistente:
        // una excepción aquí aborta initializeDMApp() y se propaga desde RTDB.
        if (toggleMesaCrafteo) {
            db.ref("campaña/estado_mundo/mesa_crafteo_activa").on("value", (snap) => {
                toggleMesaCrafteo.checked = !!snap.val();
            });
            toggleMesaCrafteo.addEventListener("change", (e) => {
                db.ref("campaña/estado_mundo/mesa_crafteo_activa").set(e.target.checked);
            });
        }
'''
if old not in text:
    raise SystemExit("expected legacy crafting toggle block not found")
if text.count(old) != 1:
    raise SystemExit(f"expected exactly one legacy block, found {text.count(old)}")
path.write_text(text.replace(old, new), encoding="utf-8")
