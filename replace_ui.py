import re

with open('dm-combat-creator.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace block around Coin Count and Weight to add Range, Targeting Type and AoE Pattern
search_block = """
            <div style="display:flex; gap: 5px; margin-bottom: 10px;">
                <label style="flex: 1;">
                    Coin Count: <input type="number" id="sb-coin-count" value="1" min="1" max="5" style="width: 100%; background: #222; color: white; border: 1px solid #555;">
                    <small style="color: #888; font-size: 10px; display: block; margin-top: 2px;">Número de monedas (golpes/caras) del ataque.</small>
                </label>
                <label style="flex: 1;">
                    Weight: <input type="number" id="sb-weight" value="1" min="1" style="width: 100%; background: #222; color: white; border: 1px solid #555;">
                    <small style="color: #888; font-size: 10px; display: block; margin-top: 2px;">A cuántos objetivos golpea (1 es single-target).</small>
                </label>
            </div>
"""

replace_block = """
            <div style="display:flex; gap: 5px; margin-bottom: 5px;">
                <label style="flex: 1;">
                    Coin Count: <input type="number" id="sb-coin-count" value="1" min="1" max="5" style="width: 100%; background: #222; color: white; border: 1px solid #555;">
                    <small style="color: #888; font-size: 10px; display: block; margin-top: 2px;">Número de monedas (golpes/caras) del ataque.</small>
                </label>
                <label style="flex: 1;">
                    Weight: <input type="number" id="sb-weight" value="1" min="1" style="width: 100%; background: #222; color: white; border: 1px solid #555;">
                    <small style="color: #888; font-size: 10px; display: block; margin-top: 2px;">A cuántos objetivos golpea (1 es single-target).</small>
                </label>
                <label style="flex: 1;">
                    Range: <input type="number" id="sb-range" value="1" min="1" style="width: 100%; background: #222; color: white; border: 1px solid #555;" oninput="this.value = Math.max(1, parseInt(this.value) || 1)">
                    <small style="color: #888; font-size: 10px; display: block; margin-top: 2px;">Alcance en tiles de la habilidad.</small>
                </label>
            </div>

            <div style="display:flex; gap: 5px; margin-bottom: 10px;">
                <label style="flex: 1;">
                    Targeting Type:
                    <select id="sb-targeting-type" style="width: 100%; background: #222; color: white; border: 1px solid #555; padding: 2px;" onchange="document.getElementById('sb-aoe-pattern').disabled = (this.value !== 'AoE');">
                        <option value="Focused Attack">Focused Attack</option>
                        <option value="Focused Volley">Focused Volley</option>
                        <option value="Unfocused Volley">Unfocused Volley</option>
                        <option value="Indiscriminate">Indiscriminate</option>
                        <option value="AoE">AoE</option>
                    </select>
                </label>
                <label style="flex: 1;">
                    AoE Pattern:
                    <select id="sb-aoe-pattern" style="width: 100%; background: #222; color: white; border: 1px solid #555; padding: 2px;" disabled>
                        <option value="Self">Self</option>
                        <option value="Radius">Radius</option>
                        <option value="Cone">Cone</option>
                    </select>
                </label>
            </div>
"""

content = content.replace(search_block, replace_block)

with open('dm-combat-creator.html', 'w', encoding='utf-8') as f:
    f.write(content)
