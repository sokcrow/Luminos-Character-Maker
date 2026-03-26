import re
with open('pantalla_dm.html', 'r') as f:
    content = f.read()

# JS changes in renderListaActores filtering/badge
content = re.sub(r'const badgeColor = actorData\.tipo === "Jugador" \? "#0df" : "#ff4444";', 'const badgeColor = "#ff4444";', content)
content = re.sub(r'const badgeText = actorData\.tipo \|\| "NPC";', 'const badgeText = "NPC";', content)

# Remove the actor assignment render and logic completely
content = re.sub(r'function renderActorAsignacion\(\) \{[\s\S]*?\}', '', content)
content = re.sub(r'renderActorAsignacion\(\);', '', content)

# Remove edit behavior for type 'Jugador'
content = re.sub(r'if \(actorData\.tipo === "Jugador"\) \{[\s\S]*?\} else \{[\s\S]*?\}', '', content)

# Enforce type to NPC on save
content = re.sub(r'const tipo = document\.getElementById\("actor-tipo-jugador"\)\.checked\s*\?\s*"Jugador"\s*:\s*"NPC";', 'const tipo = "NPC";', content)

with open('pantalla_dm.html', 'w') as f:
    f.write(content)
print("Purged JS actor assignment logic from pantalla_dm.html")
