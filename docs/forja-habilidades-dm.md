# Forja de Habilidades · Manual del Director

La **Forja de Habilidades** se abre desde **Panel del Director → Gestión de Combate → Forja de Habilidades**. Su función es crear Skills del juego sin escribir código ni editar datos internos.

## Qué motor utiliza

La Forja **no** tiene un motor aparte:

- **Editor:** `dm-skill-creator.html` y su capa `js/dm-skill-forge-ui.js`.
- **Reglas de las Skills:** `js/combat-skill-schema.js` (Schema v2).
- **Estados:** `js/status-library.js` y los Status Hooks del motor de combate.
- **Biblioteca compartida:** `campaña/base_datos_skills` (Firebase).
- **Skills del personaje:** `js/combat-skill-loadout-074.js`.
- **Ejecución real del combate:** `js/combat-v073-steps.js` y `combat/source/combat-v073-live.html`.
- **Defensas Clashable:** `js/combat-v073-clashable-defenses.js`.

## Cómo fabricar una Skill

1. Pulsa **Nueva Skill**.
2. En **Concepto**, escribe el nombre y elige una plantilla. Las plantillas configuran su clasificación y los ajustes adecuados.
3. En **Coins y poder**, fija el Base Power, Coin Power y la cantidad de Coins. Selecciona Coin normal o irrompible cuando corresponda.
4. En **Efectos**, pulsa **Añadir efecto** y selecciona cuándo ocurre, a quién afecta, cuál es su efecto y la cantidad. Las Coins pueden tener efectos distintos.
5. Si necesitas algo más específico, revisa **Detalles**. No es obligatorio modificar esos ajustes.
6. Comprueba la carta y pulsa **Guardar en biblioteca**. La Skill queda disponible para el equipamiento.

## Ejemplos

**Corte del Umbral** — ataque Tier I: Base Power 4, Coin Power +2, dos Coins. En la primera Coin, `[On Hit]` aplica Bleed con Potency 2 y Count 1 al objetivo.

**Muro de Ceniza** — selecciona **Guard Clashable**, Base Power 5 y Coin Power +3. En un Clash ganado eleva el siguiente Stagger Threshold del objetivo por el poder final de la defensa; al perder mitiga el ataque usando su poder defensivo.

**Respuesta Carmesí** — selecciona **Counter Clashable**, Base Power 6 y Coin Power +2. Gasta un Action Slot; si gana el Clash responde usando sus Coins restantes. No consume una Reaction adicional.

## Entregar una defensa a un personaje

En la cuarta etapa, después de guardar una Skill defensiva:

1. Selecciona un personaje real de la campaña.
2. Pulsa **Otorgar defensa**.
3. La defensa queda concedida al personaje y su unidad vinculada. Si ya tiene un combatiente desplegado, se sincroniza también con ese combatiente.
4. La Skill concedida no reemplaza ninguna de las tres Skills ofensivas del Deck.

La herramienta **no** crea combatientes desplegados ni inventa vínculos de personaje. Si la unidad está ausente o el vínculo es ambiguo, se bloquea la entrega y se comunica al Director.

Para un **ataque o conjuro**, utiliza el equipamiento del personaje en el Panel del Director: las tres Skills del Deck están sujetas a los requisitos de Tier y a las reglas del propio Loadout Manager.

## Notas de producción

El guardado y la entrega requieren sesión de Director y permisos Firebase. La vista previa de la carta **no es una simulación de daño**: en combate, el motor resuelve las tiradas, velocidad, modificadores, daño y Status Hooks. Los detalles de desarrollo nunca se muestran como parte de la experiencia normal.
