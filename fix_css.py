with open('hoja_personaje.css', 'r') as f:
    content = f.read()

new_css = """
/* LIMBUS HUD OVERLAY STYLES */
.limbus-hud-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(5, 5, 5, 0.85);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
}

.limbus-hud-container {
    display: flex;
    flex-direction: row;
    width: 80vw;
    height: 80vh;
    background: #0B0A0A;
    border: 6px solid #3E2723;
    position: relative;
    box-shadow: 0 0 20px rgba(0,0,0,0.8);
}

.limbus-hud-container::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border: 1px solid #D32F2F;
    pointer-events: none;
    z-index: 2;
}

.limbus-left-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 2px solid #3a2515;
    background: linear-gradient(180deg, rgba(20,15,10,0.9) 0%, rgba(10,5,5,1) 100%);
}

.limbus-right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    background: repeating-linear-gradient(
        0deg,
        rgba(62, 39, 35, 0.08),
        rgba(62, 39, 35, 0.08) 1px,
        transparent 1px,
        transparent 4px
    );
}

.btn-close-limbus {
    position: absolute;
    top: 10px;
    right: 10px;
    background: #D32F2F;
    color: #E8E4D9;
    border: 2px solid #3E2723;
    padding: 5px 15px;
    font-family: 'Courier New', Courier, monospace;
    font-weight: bold;
    cursor: pointer;
    z-index: 10;
}

.btn-close-limbus:hover {
    background: #B71C1C;
    color: #FFD700;
}
"""

if ".limbus-hud-overlay {" not in content:
    with open('hoja_personaje.css', 'a') as f:
        f.write("\n" + new_css + "\n")
    print("Injected Limbus HUD CSS.")
else:
    print("CSS already injected.")
