# Bestiario / Compendio de criaturas — base de implementación

**Estado:** especificación de continuidad. **PR:** #1074. **Fecha:** 2026-10-29.
**Decisión:** conservar `prototipo-bestiario.html` como referencia visual y de interacción. No sustituir aún el Compendio de producción ni cambiar los catálogos canónicos.

## Propósito

El Compendio es la **memoria persistente del personaje** acerca de criaturas que encontró, estudió y enfrentó en Limbus. No es la hoja privada del DM ni un listado de movimientos desbloqueado por defecto. El jugador debe reconocer los peligros reales de una criatura; un Spellcaster se define también por los **hechizos que mostró, lanzó o utilizó contra el jugador**, no por su arma secundaria.

El prototipo actual ofrece un marco de UX: clasificación, listado, retrato, ficha, Traits, resistencias, pestañas Skills / Spells, fichas ampliables y diseño móvil. **No debe describirse como la integración final**: el evento de observación de prueba y `localStorage` no constituyen detección autorizada ni progreso sincronizado.

## Contrato de información de cada criatura

La identidad estable será el ID de Unit de la biblioteca canónica (no el ID efímero del combatiente del encuentro). Cada ficha distingue:

1. **Visible sin tirada**: apariencia observada y descripción física burda, tipo visible e indicios claros (armadura, daga, señales de magia, etc.), sin deducir estadísticas ocultas.
2. **Conocimiento narrativo desbloqueado**: historia, costumbres, hábitat, organización y relación con regiones/periferias de Limbus. No trasladar sin adaptación el lore de cavernas o pueblos genéricos de D&D. Ejemplo: bandas de kobolds que sobreviven mediante asaltos, saqueos y emboscadas en callejones y periferias; **no afirmar que todos los individuos comparten ese estilo de vida**.
3. **Combate observado**: Skills, Spells y otras técnicas *realmente ejecutadas*, con su evidencia y nivel de identificación.
4. **Conocimiento técnico descubierto**: nombre, Coins, efectos, condiciones, alcance, etc. Solo los detalles efectivamente desbloqueados, sin copiar automáticamente el statblock completo.
5. **Datos biológicos y loot**: resultados de observación, extraer/cosechar/autopsias, pertenencias y conocimiento anatómico según los contratos existentes. Mantener independientes la información del cadáver y la del Compendio.

Todo enemigo nuevo debe contar con descripción visible y texto contextual para conocimiento (aunque pueda permanecer oculto para jugadores); su sprite local debe estar registrado y validado antes de marcarlo «completo». Permitir borradores explícitamente incompletos para trabajo editorial sin fingir que están terminados.

## Skills y Spells: misma interfaz de descubrimiento, orígenes separados

- **Skills**: usar los IDs y definiciones de la biblioteca de Skills del Combat Master. Mantener las tarjetas legibles con su detalle de Coins/efectos.
- **Spells**: usar IDs canónicos de `spellIds`/`mechanics.spellIds`, el catálogo de Spells y sus variantes de lanzamiento. No interpretarlos como Skills físicas ni mezclarlos con daga u otras armas.
- Consultar ambas listas es una **acción de lectura**. No gastar Coins ni alterar el combate al abrir el Compendio.
- Una Skill/Spell que pertenece al repertorio secreto de una Unit **no debe aparecer descubierta antes de que haya evidencia**.
- Tras ver un conjuro, crear una entrada **Manifestación arcana observada**; tras sufrirlo, registrar **Impacto/efecto experimentado**. Ninguno de esos eventos implica que se sepa automáticamente su nombre, nivel, poder, Coins, alcance o efecto exacto.
- Una identificación posterior, mediante habilidad/regla aplicable, desbloquea el detalle autorizado y la tarjeta ampliada. Evitar presentar todo el statblock tras la primera exposición.
- Traits pasivos y resistencias tampoco se revelan automáticamente por estar en el catálogo; deben tener su propia fuente de evidencia o desbloqueo.
- Un conjuro observado puede constituir conocimiento general del **spellId** y también quedar ligado a la criatura que lo usó; no duplicar sin necesidad datos canónicos de definición.

### Estados propuestos (para acordar en integración)

`unknown → witnessed` (uso visto) y/o `experienced` (efecto recibido); `identified` es una **dimensión de conocimiento** posterior, no sinónimo de «sufrido». Almacenarlos como evidencia acumulativa: `seen`, `hit`, `identified` y metadatos de origen. Un mismo hechizo puede ser presenciado sin golpear al personaje o golpearlo sin identificación precisa.

La fuente de verdad de un evento deberá contener identificador único, encuentro, actor que ejecutó, ID de Unit canónico, `actionId`, familia `skill|spell`, resultados y destinatarios/observadores validados. Deduplicar para no registrar dos veces el mismo evento ni otorgar conocimientos mediante replays.

## Historia, identificar y consultas

- La descripción **visible** se obtiene sin Historia si el personaje efectivamente vio la criatura.
- **Historia (INT)** recupera contexto de la criatura y lo guarda en su Compendio. Conservar la mecánica actual de **5 Coins** y sus reglas existentes de intentos; no inventar umbrales nuevos en esta fase.
- Para identificar **magia**, estudiar el uso de Arcana y otras competencias apropiadas a la naturaleza de la criatura o el fenómeno. Definir habilidades, umbrales y oportunidades de intento en una fase específica; **no sustituir automáticamente Historia por Arcana** para todo.
- **Consultar Compendio** y **Recordar/Identificar** son operaciones diferentes. Consultar no consume una acción/tirada solo por leer algo ya aprendido; la integración final con Planning/Combat Master debe determinar cuándo se puede intentar una nueva tirada.

## Integración pendiente — fuera de este PR de prototipo

1. **Contrato de eventos autorizado:** enlazar los eventos reales de Combat Master / Theatre (lanzamiento, objetivo, impacto, observadores) con la identidad del personaje. Filtrar visibilidad real, no suponer que todos vieron todo. No confiar en un `CustomEvent` disparado por un cliente como prueba de verdad.
2. **Persistencia por personaje:** almacenar conocimiento bajo la estructura canónica del Compendio en Firebase (actualmente `campaña/jugadores/{playerId}/compendium`) y apoyarse en `js/loot-knowledge-runtime.js`; estudiar migración de esquema, versiones, deduplicación y privacidad por jugador antes de escribir. Recuperar conocimiento entre dispositivos y encuentros.
3. **Fuentes canónicas:** cargar Units/Skills/Spells sin crear tres listas paralelas. Integrar nuevas fichas del DM y validar referencias en la creación de actores/Units.
4. **Desbloqueos y reglas:** Historia, identificación de magia, acciones de análisis y conocimiento postcombate; sincronizar el cambio con la UI y con permisos.
5. **Arte y presentación:** auditar sprites locales y URLs externas, estados `missing/remote/local/invalid`, migrar recursos reales; reemplazar placeholders geométricos/figuras parecidas a **piezas de ajedrez** por siluetas neutrales o sprites de criatura. No inventar monstruos ni usar iconos ajenos como si fueran el enemigo.
6. **Pruebas:** combate multiusuario DM + jugadores; Spellcaster que use Fire Bolt / Scorching Ray, ataques de área, impactos no recibidos, observador fuera de escena, reenlaces, reload, reconexión y sincronización entre móvil/desktop; verificar que no aparecen habilidades jamás vistas.

## Criterios de aceptación del Compendio definitivo

- [ ] Descubrimiento específico por personaje y encuentro, con fuente verificable.
- [ ] Lanzamientos y daños de Spells quedan correctamente observados o experimentados y se conservan entre sesiones.
- [ ] Skill, Spell, Trait y resistencia no se revelan por mera presencia en el loadout del enemigo.
- [ ] Identificar desbloquea solo la información autorizada; consultar nunca gasta una tirada.
- [ ] Historia registra descripción y contexto de Limbus; textos visibles sin tirada.
- [ ] Un Spellcaster muestra sus **Spells** en sección funcional con el mismo nivel de detalle visual que Skills.
- [ ] Funciona con el catálogo real del Combat Master sin listas duplicadas.
- [ ] Navegación móvil viable con pestañas y objetivos táctiles adecuados, sin overlays apilados.
- [ ] No se muestran fichas de criatura como piezas de ajedrez cuando falta un sprite.
- [ ] Sprites auditados; las URL externas no equivalen a archivos locales.
- [ ] Pruebas de seguridad/sincronización multiusuario antes de habilitarlo en producción.

## Estado actual

El PR conserva el prototipo aislado y ahora incorpora contenido editorial en las 35 definiciones de los cinco catálogos canónicos. Cada criatura tiene aspecto físico, contexto, comportamiento y texto para estudio corporal. El prototipo obtiene su descripción del catálogo; ya no mantiene un texto privado para el kobold.

La estructura de contenido y el contrato con Observation Level están documentados en [Contenido y observación](compendium-content-observation.md). No se implementan todavía nuevas consultas, desbloqueos de lore, puente autorizado de combate, migración de registros Firebase existentes ni cambios de tiradas. El prototipo continúa separado del Compendio productivo.

