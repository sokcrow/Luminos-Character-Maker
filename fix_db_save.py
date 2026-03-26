with open('pantalla_dm.html', 'r') as f:
    content = f.read()

import re

# We need to make sure the splash art and the 13 resistances we added in the DM combat modal
# are actually being saved when the user clicks btn-save-stats.

# Let's find the btn-save-stats click handler
save_stats_regex = r'(\.getElementById\("btn-save-stats"\)\s*\.addEventListener\("click",\s*\(\)\s*=>\s*\{.*?updates\[`campaña/jugadores/\$\{activePlayerIdForModal\}/combatStats`\]\s*=\s*\{[^\}]*\};)'

match = re.search(save_stats_regex, content, re.DOTALL)
if match:
    block = match.group(1)

    # Let's append the splash art and resistance variables at the top of the block
    new_vars = """
            const splashUrl = document.getElementById("dm-player-splash-url") ? document.getElementById("dm-player-splash-url").value : "";
            const resInputs = document.querySelectorAll(".dm-res-input");
            const newRes = {};
            resInputs.forEach(input => {
                newRes[input.dataset.type] = parseFloat(input.value) || 1;
            });
"""
    # Insert new_vars right after `if (!activePlayerIdForModal) return;`
    block = block.replace('if (!activePlayerIdForModal) return;', 'if (!activePlayerIdForModal) return;\n' + new_vars)

    # Append the updates for splash_art and resistances right before the updates are sent
    new_updates = """
            if (splashUrl) updates[`campaña/jugadores/${activePlayerIdForModal}/splash_art`] = splashUrl;
            updates[`campaña/jugadores/${activePlayerIdForModal}/resistencias`] = newRes;
"""

    block = block.replace('updates[`campaña/jugadores/${activePlayerIdForModal}/combatStats`] =\n              {', new_updates + '            updates[`campaña/jugadores/${activePlayerIdForModal}/combatStats`] =\n              {')

    content = content.replace(match.group(1), block)
    with open('pantalla_dm.html', 'w') as f:
        f.write(content)
    print("Fixed save to firebase.")
else:
    print("Could not find block.")
