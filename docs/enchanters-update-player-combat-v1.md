# Enchanter's Update — Tercera y última entrega V1: jugador + combate

**Estado:** implementación en rama apilada sobre [Entrega 2](./enchanters-update-studio-v1.md) y [Core V1](./enchanters-update-core-v1.md). Requiere revisión, fusión ordenada y aceptación manual en una sesión Firebase/Combat real.

## Lo que se cierra en esta entrega

### Inventario y hoja del jugador
- `hoja_personaje.html` carga el Item Enchantment Runtime e Item Magic Runtime.
- `js/inventory-hud-v2.js` muestra `+1/+2/+3` como distintivo mágico diferenciado del Quality/Tier físico.
- Nombre del objeto encantado, herramienta de detalle, resumen del foco `+N` en canal autorado y requerimiento de sintonización.
- La visualización no inventa precios AHN ni altera los cálculos de economía.
- Un Item mundano con la misma definición no hereda el encantamiento del ejemplar mágico.

### Equipamiento autoritativo en Battle Viewer
- `js/item-enchantment-combat-link.js` resuelve `itemEquipmentRefs` + `inventario_activo` del Player autenticado en **Item Instances activos**, sin aceptar IDs de Stash, copias inexistentes o cantidad cero.
- `combat-v073-live-adapter.js` transporta armas, armadura, escudos, accesorios y sintonización desde la fuente Player hacia Combat. La firma de rehidratación incluye encantamientos, equipo y Attunement para reflejar cambios.
- Runtime V074 e inserción de scripts del Battle Viewer cargan el núcleo mágico y el enlace de equipo.

### Skills, armas y cálculo de combate
- Solo Skills autoradas como **habilidades de arma** (p. ej., `isItemSkill`, `sourceType: "weapon"`, `requiresWeapon`) son elegibles para usar encantamiento de arma.
- El jugador puede elegir una instancia de arma entre las equipadas al planificar esas Skills. Si hay una sola compatible, se resuelve automáticamente.
- Si la Skill autorada fija `sourceItemInstanceId`, `weaponInstanceId`, `weaponSlot` o `weaponDefinitionId`, sus restricciones se preservan; otro Item no puede suplantarla.
- El plan envía un ID de arma solamente después de validarlo contra las fuentes autoritativas. El Battle Viewer vuelve a comprobarlo al compilar la acción; el Combat Action Resolver lo comprueba contra el equipamiento actual en el momento de ejecutar.
- La Skill no obtiene un bono de otra arma, del Stash, de un hechizo o de una instancia inventada.
- `CombatEngine.applyPassiveModifiers` incorpora los Traits mágicos de Items equipados al runtime de combate real. Los estados existentes conservan su comportamiento y no se añaden Trait/Status de encantamiento permanentes al personaje.
- `getOffensiveLevel` ahora pasa la Skill contextual al resolver el nivel; por ello el foco ofensivo del arma no se aplica a Skills no relacionadas.
- El foco defensivo de la armadura y el poder de guardia del escudo usan los canales de Combat ya definidos. Otros focos siguen siendo los canales admitidos por Core V1 y sus motores correspondientes, sin introducir fórmulas nuevas.

## Contratos preservados

- **Material, Quality, Condition, upgrades físicos, fabricación e Item definition permanecen independientes.**
- Solo una magia focal por Item Instance (+1..+3); el DM necesita confirmar reemplazo/eliminación y guardar en el Studio.
- Estado mágico, Attunement y propietario se leen del inventario/Player canónico.
- El enlace de batalla falla de manera segura cuando la Skill no acredita el arma o el equipamiento no está disponible.
- No se muestran datos técnicos o paneles de depuración al jugador.

## Validación ejecutada (sin tests persistentes)

- Sintaxis JS de 12 módulos.
- Pruebas usando el **CombatEngine real**: +2 Offensive Level en la Skill de la espada, ningún bono para otra arma o hechizo y +3 Defensive Level por armadura.
- Pruebas de autorizaciones: dos armas distintas, referencia falsa, arma no equipada, especificación de arma autorada incompatible, Skills no sujetas a arma y plan autenticado del jugador.
- Battle Viewer Loadout/Action Adapter verifican una Skill con arma válida y rechazan referencias arbitrarias.
- Simulación de hidratación de Player Inventory → Combat Live Adapter → CombatEngine manteniendo encantamientos y sintonización.
- Simulación del HUD del jugador: espada encantada muestra nombre y distintivo, espada mundana no.
- No se añaden suites o herramientas de test persistentes, conforme a la política del README.

**Pendiente de aceptación:** verificación manual en navegador con jugadores y DM reales, Firebase compartido y batalla real. Las pruebas de arriba no sustituyen esa aceptación.

## Fuera del alcance de Enchanter V1, deliberadamente no inventado

- Multiplicadores AHN de +1/+2/+3 y costes de materiales.
- Recetas, estaciones, probabilidades de fallar al encantar, consumo de gemas, compatibilidad elemental/resonancia concreta.
- Objetos malditos aleatorios, afijos aleatorios y tablas de tesoro mágico: **Magic Loot Update**.
- Catálogo masivo de nuevos encantamientos o reglas elementales aún no diseñadas.

Estas características requieren decisiones de reglas independientes; no deben integrarse implícitamente a la actualización final del núcleo, Studio e inventario/combat.


## Auditoría de integración (8 de octubre de 2026)

- **DM Studio CI:** el harness Playwright vuelve a cargar los módulos de Enchanter reales; los 5 checks de PR #949 pasaron tras corregir los 6 timeouts.
- **Referencias al equipamiento:** guardar encantamiento en un Item Instance equipado actualiza el puntero de equipamiento; un fallo de guardado restaura tanto el objeto como el puntero original. Prueba con el editor real: 5 aserciones satisfactorias.
- **Battle Viewer:** el CombatEngine real verifica arma concreta, nivel ofensivo +2, armadura +3 condicionada por sintonización, retirada de bono al desintonizar y bloqueo al desactivar el equipamiento. Contratos de persistencia comprobados.
- **Jugador:** acciones de sintonización y retirada desde el inventario, usando el runtime mágico existente; dos flujos de UI simulada comprobados.
- **Base main:** las aserciones obsoletas de Proficiency que bloqueaban smoke tests independientes se corrigieron y fusionaron en PR #958 sin alterar reglas.
- **Integración:** esta rama reúne las tres entregas sobre una única PR contra `main`. Su fusión debe esperar el CI de la combinación actual y aceptación manual DM/jugador + Firebase + Battle Viewer.
