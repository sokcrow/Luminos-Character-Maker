css_append = """

/* --- PHONE UI REDESIGN --- */

/* Reset main wrapper */
.sheet-limbus-main {
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
    min-width: 0;
}

.sheet-limbus-main::before {
    display: none;
}

/* Phone Wrapper */
.sheet-phone-wrapper {
    max-width: 400px;
    height: 800px;
    margin: 0 auto;
    background-color: #000;
    border: 12px solid #222;
    border-radius: 30px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.8), inset 0 0 10px rgba(0,0,0,0.5);
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Phone Notch / Status Bar */
.sheet-phone-statusbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 20px;
    font-size: 12px;
    color: #fff;
    background: rgba(0, 0, 0, 0.5);
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    pointer-events: none;
}

.sheet-phone-statusbar::after {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 20px;
    background: #222;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
}

/* Screen Area */
.sheet-phone-screen {
    flex: 1;
    overflow: hidden;
    position: relative;
    padding-top: 30px; /* Space for status bar */
    padding-bottom: 50px; /* Space for navbar */
    display: flex;
    flex-direction: column;
    background-size: cover;
    background-position: center;
    transition: background 0.3s;
}

/* Wallpaper Logic */
input.sheet-state-bg[value="bg1"] ~ * .sheet-phone-screen {
    background-image: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url('https://i.imgur.com/someLimbusBg.jpg'); /* Need a real URL or keep it dark */
    background-color: #111;
}
input.sheet-state-bg[value="bg2"] ~ * .sheet-phone-screen {
    background-image: linear-gradient(rgba(0,10,20,0.8), rgba(0,10,20,0.95)), linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px);
    background-size: cover, 20px 20px, 20px 20px;
    background-color: #001122;
}
input.sheet-state-bg[value="bg3"] ~ * .sheet-phone-screen {
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px), #1a1a1a;
}

/* Home App Grid */
.sheet-tab-home {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.sheet-app-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    padding: 20px;
    width: 100%;
}

.sheet-app-btn {
    background: transparent !important;
    border: none !important;
    color: #fff;
    display: flex !important;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-family: inherit;
    text-transform: none;
    transition: transform 0.2s;
}

.sheet-app-btn:hover {
    transform: scale(1.1);
}

.sheet-app-icon {
    width: 60px;
    height: 60px;
    background: rgba(20, 20, 20, 0.8);
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    backdrop-filter: blur(5px);
}

.sheet-app-btn span {
    font-size: 12px;
    font-weight: bold;
    text-shadow: 0 1px 3px #000;
}

/* Theme Colors Logic */
input.sheet-state-theme[value="red"] ~ * .sheet-app-icon { border-color: var(--red-limbus); color: #ff6666; }
input.sheet-state-theme[value="blue"] ~ * .sheet-app-icon { border-color: var(--cyan-tech); color: var(--cyan-tech); }
input.sheet-state-theme[value="green"] ~ * .sheet-app-icon { border-color: var(--green-success); color: var(--green-success); }
input.sheet-state-theme[value="gold"] ~ * .sheet-app-icon { border-color: var(--border-accent); color: var(--border-accent); }

/* In-App Headers */
.sheet-app-header {
    background: rgba(0,0,0,0.8);
    padding: 10px 15px;
    border-bottom: 2px solid var(--border-accent); /* Override via JS/CSS var if needed */
    backdrop-filter: blur(10px);
}

.sheet-app-header h2 {
    margin: 0;
    font-size: 1.2em;
    text-align: center;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 2px;
}

input.sheet-state-theme[value="red"] ~ * .sheet-app-header { border-bottom-color: var(--red-limbus); }
input.sheet-state-theme[value="blue"] ~ * .sheet-app-header { border-bottom-color: var(--cyan-tech); }
input.sheet-state-theme[value="green"] ~ * .sheet-app-header { border-bottom-color: var(--green-success); }
input.sheet-state-theme[value="gold"] ~ * .sheet-app-header { border-bottom-color: var(--border-accent); }

/* In-App Scroll Body */
.sheet-app-body-scroll,
.sheet-app-body {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    /* Hide scrollbar for webkit */
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}
.sheet-app-body-scroll::-webkit-scrollbar,
.sheet-app-body::-webkit-scrollbar {
    display: none;
}

/* Navbar */
.sheet-phone-navbar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50px;
    background: #0a0a0a;
    display: flex;
    align-items: center;
    justify-content: center;
    border-top: 1px solid #222;
}

.sheet-home-btn {
    background: transparent !important;
    border: none !important;
    color: #fff;
    font-size: 24px;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
}

.sheet-home-btn:hover {
    opacity: 1;
}

/* Visibility Fix for New Structure */
.sheet-tab-content { display: none !important; height: 100%; flex-direction: column; }
.sheet-state-tab[value="home"] ~ .sheet-phone-wrapper .sheet-tab-home,
.sheet-state-tab[value="stats"] ~ .sheet-phone-wrapper .sheet-tab-stats,
.sheet-state-tab[value="equipment"] ~ .sheet-phone-wrapper .sheet-tab-equipment,
.sheet-state-tab[value="skills"] ~ .sheet-phone-wrapper .sheet-tab-skills,
.sheet-state-tab[value="abilities"] ~ .sheet-phone-wrapper .sheet-tab-abilities,
.sheet-state-tab[value="parts"] ~ .sheet-phone-wrapper .sheet-tab-parts,
.sheet-state-tab[value="profile"] ~ .sheet-phone-wrapper .sheet-tab-profile,
.sheet-state-tab[value="apego"] ~ .sheet-phone-wrapper .sheet-tab-apego,
.sheet-state-tab[value="settings"] ~ .sheet-phone-wrapper .sheet-tab-settings {
    display: flex !important;
}

/* Adjust existing large UI elements to fit phone width */
.sheet-limbus-main .sheet-header {
    grid-template-columns: 1fr;
    padding: 15px;
}

.sheet-attributes-grid {
    flex-direction: column;
}
.sheet-attr-group {
    width: 100%;
}

.sheet-hp-sp-row {
    flex-direction: column;
    gap: 10px;
}

.sheet-stagger-bar {
    flex-wrap: wrap;
}

.sheet-vitals-hud {
    flex-direction: column;
}

.sheet-part-view-bar {
    flex-direction: column;
    align-items: stretch;
}
.sheet-part-view-left, .sheet-part-view-center, .sheet-part-view-right {
    flex: auto;
    width: 100%;
    margin-bottom: 5px;
}
"""

with open('hoja_personaje.css', 'a', encoding='utf-8') as f:
    f.write(css_append)
