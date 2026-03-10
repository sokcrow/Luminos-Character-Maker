import re

with open('hoja_personaje.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update default tab
content = content.replace('value="stats" />\n\n    <!-- Config Toggle', 'value="home" />\n    <input type="hidden" name="attr_theme_color" class="sheet-state-theme" value="red" />\n    <input type="hidden" name="attr_wallpaper" class="sheet-state-bg" value="bg1" />\n\n    <!-- Config Toggle')

# 2. Extract sections
def extract_div(content, class_name):
    pattern = r'<div class="[^"]*?\b' + class_name + r'\b[^"]*".*?'
    match = re.search(pattern, content, flags=re.DOTALL)
    if not match:
        return "", content

    start = match.start()
    # Find the closing tag
    div_count = 0
    i = start
    while i < len(content):
        if content[i:i+4] == '<div':
            div_count += 1
            i += 4
        elif content[i:i+6] == '</div>':
            div_count -= 1
            i += 6
            if div_count == 0:
                return content[start:i], content[:start] + content[i:]
        else:
            i += 1
    return "", content

tabs, content = extract_div(content, 'sheet-tabs')
header, content = extract_div(content, 'sheet-header')
config_panel, content = extract_div(content, 'sheet-config-panel')
hp_sp_row, content = extract_div(content, 'sheet-hp-sp-row')
stagger_bar, content = extract_div(content, 'sheet-stagger-bar')
abno_parts, content = extract_div(content, 'sheet-abno-parts-container')

# Extract left and right from header
header_left, _ = extract_div(header, 'sheet-header-left')
header_right, _ = extract_div(header, 'sheet-header-right')

# Construct Phone Layout
phone_layout = f"""
<div class="sheet-phone-statusbar">
    <span class="sheet-phone-time">12:00</span>
    <span class="sheet-phone-icons">📶 100% 🔋</span>
</div>
<div class="sheet-phone-screen">
    <!-- Home Tab -->
    <div class="sheet-tab-content sheet-tab-home">
        <div class="sheet-app-grid">
            <button type="action" name="act_tab_profile" class="sheet-app-btn"><div class="sheet-app-icon">👤</div><span>Perfil</span></button>
            <button type="action" name="act_tab_vitals" class="sheet-app-btn"><div class="sheet-app-icon">❤️</div><span>Vitales</span></button>
            <button type="action" name="act_tab_stats" class="sheet-app-btn"><div class="sheet-app-icon">📊</div><span>Stats</span></button>
            <button type="action" name="act_tab_equipment" class="sheet-app-btn"><div class="sheet-app-icon">🎒</div><span>Equipo</span></button>
            <button type="action" name="act_tab_skills" class="sheet-app-btn"><div class="sheet-app-icon">⭐</div><span>Perks</span></button>
            <button type="action" name="act_tab_abilities" class="sheet-app-btn"><div class="sheet-app-icon">⚔️</div><span>Skills</span></button>
            <button type="action" name="act_tab_apego" class="sheet-app-btn"><div class="sheet-app-icon">🤝</div><span>Apego</span></button>
            <button type="action" name="act_tab_parts" class="sheet-app-btn sheet-show-parts-btn"><div class="sheet-app-icon">🧩</div><span>Partes</span></button>
            <button type="action" name="act_tab_settings" class="sheet-app-btn"><div class="sheet-app-icon">⚙️</div><span>Ajustes</span></button>
        </div>
    </div>

    <!-- Vitals Tab -->
    <div class="sheet-tab-content sheet-tab-vitals">
        <div class="sheet-app-header"><h2>Vitales</h2></div>
        <div class="sheet-app-body">
            {header_right}
            {config_panel}
            {hp_sp_row}
            {stagger_bar}
        </div>
    </div>

    <!-- Settings Tab -->
    <div class="sheet-tab-content sheet-tab-settings">
        <div class="sheet-app-header"><h2>Ajustes</h2></div>
        <div class="sheet-app-body">
            <div class="sheet-row">
                <div class="sheet-col">
                    <label>Fondo de Pantalla</label>
                    <select name="attr_wallpaper">
                        <option value="bg1">Limbus Dark</option>
                        <option value="bg2">City Grid</option>
                        <option value="bg3">CRT Noise</option>
                    </select>
                </div>
            </div>
            <div class="sheet-row">
                <div class="sheet-col">
                    <label>Color de Tema</label>
                    <select name="attr_theme_color">
                        <option value="red">Rojo Sangre</option>
                        <option value="blue">Azul Neón</option>
                        <option value="green">Verde Tóxico</option>
                        <option value="gold">Dorado Corporativo</option>
                    </select>
                </div>
            </div>
        </div>
    </div>
"""

# Find where to insert phone_layout
# Before `<div class="sheet-tab-content sheet-tab-stats">`
insert_point = content.find('<div class="sheet-tab-content sheet-tab-stats">')
if insert_point != -1:
    content = content[:insert_point] + phone_layout + content[insert_point:]
else:
    print("Could not find stats tab insertion point")

# Append header_left to Profile tab
profile_tab_start = content.find('<div class="sheet-tab-content sheet-tab-profile">')
if profile_tab_start != -1:
    content = content[:profile_tab_start + 49] + f"\n<div class=\"sheet-app-header\"><h2>Perfil</h2></div>\n<div class=\"sheet-app-body\">\n{header_left}\n" + content[profile_tab_start + 49:]
    # Close app body later? Profile tab already has content, we can just prepend.

# Append abno_parts to Parts tab
parts_tab_start = content.find('<div class="sheet-tab-content sheet-tab-parts">')
if parts_tab_start != -1:
    content = content[:parts_tab_start + 47] + f"\n<div class=\"sheet-app-header\"><h2>Partes</h2></div>\n<div class=\"sheet-app-body\">\n{abno_parts}\n" + content[parts_tab_start + 47:]

# Close the phone screen and add navbar
# We need to wrap everything from <div class="sheet-phone-screen"> to the end of tabs in </div> and then add navbar
# Find the end of sheet-main-content which is now effectively the end of tabs
main_content_end = content.rfind('</div><!-- Stats Tab Content -->') # wait, the comment might be misplaced
# Let's just find the closing tags of the sheet-limbus-main
# We'll replace the `<div class="sheet-main-content">` with `<div class="sheet-phone-body">`
content = content.replace('<div class="sheet-main-content">', '')

# At the end, before Roll Templates:
roll_template_idx = content.find('<!-- Roll Template -->')
if roll_template_idx != -1:
    nav_bar = """
</div> <!-- End Phone Screen -->
<div class="sheet-phone-navbar">
    <button type="action" name="act_tab_home" class="sheet-home-btn">🔲</button>
</div>
"""
    content = content[:roll_template_idx] + nav_bar + content[roll_template_idx:]

with open('hoja_personaje_restructured.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Restructured HTML written to hoja_personaje_restructured.html")
