# Luminos-Character-Maker

Luminous Character Maker.

## Abrir el combate

La entrada directa es [combate.html](combate.html), con la misma cuenta que las fichas. El DM puede abrir un encuentro, añadir personajes y enemigos desde **Encuentro**, resolver las acciones elegidas por los jugadores y finalizar con un resultado. El Centro de Mando y el panel del DM también enlazan esta entrada.

[Encuentro separado](mirror.html) prepara combates independientes para Mirror Dungeon. En online, el creador elige el grupo y comparte su enlace; el anfitrión puede jugar con su personaje y resolver la ronda sin una cuenta DM adicional. En local, se prepara un personaje y el encuentro se guarda en el navegador de ese dispositivo. Ambos usan el mismo motor y VIEW. Desde **Encuentro** se añaden aliados y enemigos de la biblioteca. Este acceso proporciona los combates; el recorrido y los eventos de mazmorra son sistemas separados.

Cada encuentro separado tiene una copia de sus personajes, inventario, biblioteca y estado. Su daño, gasto de recursos, resultados y botín no se escriben en las fichas ni en el encuentro de historia. Online se guarda bajo `campaña/encuentros/<id>`; local usa almacenamiento del dispositivo y no necesita Firebase durante el combate. Conserva el enlace para reabrirlo. Las páginas y recursos visuales deben estar disponibles para cargar la aplicación.

Publica `database.rules.json` de esta versión para habilitar los encuentros separados y los planes con objetos. El DM autoriza los objetos disponibles mediante el inventario activo; las acciones globales admitidas tienen una lista explícita. READY y sus planes se confirman juntos. Las reparaciones de metadatos conservan READY cuando las copias efectivas del mazo no cambiaron. Los objetos planificados se resuelven con el motor canónico y consumen su instancia del inventario activo cuando producen efecto. El sellado comprueba nuevamente a los participantes y la selección en una transacción, y todos los cierres usan la misma resolución de efectos y botín. Un Clash que acumula 20 empates consecutivos termina en estancamiento: ambas acciones se cancelan sin ganador, daño ni recuperación de SP.

`npm run package:combat-release` prepara las páginas, recursos, reglas y un manifiesto de integridad para publicar la versión integrada. No despliega ni modifica la campaña. Consulta [acceso y publicación](docs/combat-phase6-playable-release.md).

## Política de pruebas

El repositorio no mantiene una suite de tests permanente. Cuando una tarea necesite validación automatizada, los tests se crean de forma temporal para esa implementación o corrección y se eliminan antes de completar el cambio. No deben agregarse tests, workflows de test ni dependencias de testing persistentes al repositorio.
