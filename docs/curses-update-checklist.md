# Curse's Update — Implementation Checklist (V1 en desarrollo)

> **Estado: Fase A definida; primer tramo ejecutable sobre Items integrado y validado en CI.** La rama incluye Curse Runtime, Magic/Equipment bridges, Curse Studio del DM y tests. El PR permanece **Draft**: no están implementados aún todas las familias/objetivos ni hay servicios de Curse productivos.
>
> Fecha de línea base: **2026-10-12** · Repositorio: `sokcrow/Luminos-Character-Maker` · Dependencia: [Enchanter's Update #931](https://github.com/sokcrow/Luminos-Character-Maker/pull/931) (ya fusionado a `main`).

## Propósito

Curse's Update complementa Enchanter's Update aportando contratos para **maldiciones como entidades persistentes con origen, objetivo, activación, conocimiento y vías de resolución**. Una Curse **puede provocar** Status negativos, pero **no es** por defecto un Status. No se duplican Item Runtime, Status Engine, Trait Engine, Spell runtime, Combat Engine, Shops ni persistencia.

La **V1 definida por el propietario** cubre cinco objetivos (`item`, `creature`, `place`, `lineage`, `entity`) y cinco familias (`item`, `affliction`, `binding`, `ritual`, `pact`). La implementación es incremental: la **primera entrega funcional solo cubre Item Curses autónomas de atadura** y no representa la implementación completa del alcance. El contrato íntegro de Fase A está en [`curses-update-phase-a-contract.md`](./curses-update-phase-a-contract.md).

## Principios y límites heredados (NO son tareas completadas de Curse's Update)

- **Enchanter es la autoridad para la aplicación de Enchantments y sus propiedades `curse`/`bind`**. No alterar sus cálculos, economía ni reglas de Gem Anchors sin una decisión expresa del proyecto.
- `Bind` mágico **es un estado de la familia Curse en equipamiento**; no es el `bind` de Status Library que baja Speed. Necesitan namespace/contrato desambiguado.
- No confundir Curse normal, Bound Curse y desventaja inseparable de Relic. La revisión específica de Relics pertenece al futuro **Magic Items Update**.
- `Identify` **no revela** automáticamente la desventaja oculta. La verdad canónica y el conocimiento de cada observador van por separado.
- Curas de Status ordinarias no deben borrar mágicamente la fuente de Curse; comportamiento nuevo requiere autoría específica.
- `Remove Curse` existente no es garantía de purificación universal. Bind/Gem ligada/Relic conservan sus bloqueos.
- Nada de probabilidades, costes, DC/TH, escalados, recharge, castigos HP/SP/Sanity ni fórmulas universales no aprobadas.
- Nada de controles de debug, IDs internos, JSON crudo o paneles duplicados en la UI del jugador/DM.
- **Magic Loot**, afijos aleatorios, generación de objetos malditos en drops y el catálogo de Relics se mantienen **fuera del alcance V1**. Territorios, linajes, organizaciones y pactos **sí forman parte del alcance elegido**, pero sus adaptadores no existen todavía.

## Ledger inicial

| Pista | Marcadas [x] | Pendientes [ ] | Total |
|---|---:|---:|---:|
| Infraestructura preexistente verificada (referencia, NO trabajo del PR) | 13 | 0 | 13 |
| **Curse's Update V1 (tareas propias; diseño + ejecución + nuevos objetivos)** | **19** | **107** | **126** |

**Regla del tracker:** no trasladar las `[x]` de Enchanter a las tareas propias de Curse. Una tarea V1 pasa a `[x]` solamente al estar implementada y verificada en la rama del PR, con referencias a cambios/tests. Para decisiones de diseño, `[x]` solo al existir aprobación explícita registrada. Mantener este ledger actualizado cuando cambien tareas o alcance.

## Primer incremento real del PR #978 (2026-10-12)

**Código ya escrito en esta rama (no confundir con V1 completa):** `js/curse-runtime.js` implementa un catálogo inicial de la Binding Curse autónoma `cursed_binding`, instancia persistente separada de Enchantments, estados activo/suprimido/sellado/resuelto, operaciones de Apply/Suppress/Seal/Break/Transfer y bloqueo de desequipamiento ejecutable vía `js/item-equipment-bridge.js`. `js/item-magic-runtime.js` detecta maldiciones autónomas sin convertirlas en `bind` canónico; la hoja del Player y Battle Viewer cargan el nuevo runtime. El editor existente `js/dm-item-instance-editor.js` incluye Curse Studio, cambios preparados y guardado en el Item Instance original. `css/dm-item-instance-editor.css` incorpora la UI responsive.

**Evidencia:** `tests/curse-item-runtime-smoke.cjs` y `.github/workflows/curse-runtime-integration.yml`, [CI de Curse Runtime verde](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/38311384954). Dos pruebas Playwright se agregaron al suite del DM `tests/dm-item-instance-editor.spec.cjs` y **pasaron en Chromium real**: [DM Inventory Grant GUI](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/38311384748). También pasó [Inventory Runtime Validation](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/38311384860). Los componentes no certificados siguen abiertos como `[ ]`.

**Todavía NO implementado:** Curse sobre personajes, lugares, linajes o entidades colectivas; efectos negativos generales de HP/SP/Sanity; authoring abierto de todas las familias; operaciones colectivas; transferencia pagada/atómica entre dos inventarios; Curse UI para jugador más allá de detección/lectura existente; deploy productivo.

## Fase B — Incremento validado de catálogo y runtime

**Implementado:** `js/curse-catalog.js` centraliza definiciones versionadas, valida familias/objetivos/efectos/disparadores/resoluciones y rechaza propiedades o payloads no autorizados; `js/curse-runtime.js` implementa una interfaz inmutable con `canApply`, `applyItem`, `canResolve`, `resolveItem`, `instances`, `activeEffects` y `transferItem`. Guardas de instancia comprueban identidad de target, procedencia básica, estados, intensidad, sello y resolución; protección contra replay por `eventId` y contra maldecir stacks de cantidad >1. La UI real del DM muestra intensidad y desactiva Aplicar cuando el objeto no es elegible.

**Verificado:** `tests/curse-catalog-smoke.cjs`, `tests/curse-item-runtime-smoke.cjs`, regresiones de Bind/Arcana en [Curse Runtime Integration CI](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/38335190664) (verde). [DM Inventory Grant GUI](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/38335190661) pasó sobre la rama con estos contratos. La mejora posterior de intensidad visible en la UI tiene suite de navegador adicional en ejecución; no se confunde con la prueba de versión anterior.

**Pendiente B:** metadata completa de fuente, condiciones y provenance de Curse Instance; adapters ejecutables adicionales sobre Trait/Status/Spell/Creature. Declara cinco familias, pero solo `cursed_binding` para Item es contenido funcional publicado. Ver [documentación técnica B](./curses-update-phase-b-core.md).

## 0 — Inventario comprobado en `main` (solo referencia)

- [x] El catálogo de encantamientos reconoce propiedades `curse` y `bind`, y valida que no sean simultáneas en el mismo encantamiento. — `js/item-catalog-enchantments.js`, `js/item-enchantment-engine.js`
- [x] Curse de encantamiento conserva el modificador positivo x1.50 y Bind x1.25, sin convertirlo en daño universal. — `docs/enchanters-update-part-a-core.md`
- [x] La creación intencional de Curse usa +6 TH y materiales profanos compatibles; Bind usa +4 TH. — `docs/enchanters-update-part-b-resonance.md`
- [x] El valor de mercado base del objeto maldito es x0.60 frente al equivalente limpio, sin abaratar su fabricación. — `docs/enchanters-update-part-a-core.md`
- [x] Existen `detectCurse` e `identifyCurse` y el conocimiento del objeto está separado de su verdad canónica. — `js/item-magic-knowledge-runtime.js`
- [x] `Identify` puede indicar la presencia de Curse sin revelar su perjuicio oculto; la inscripción tiene tratamiento rúnico distinto. — `js/item-magic-knowledge-runtime.js`
- [x] El servicio `curse_analysis` identifica una maldición de objeto a través del conocimiento del jugador. — `js/item-enchanter-service-runtime.js`
- [x] El servicio `remove_curse` retira una propiedad `curse` normal en un encantamiento compatible; **no** es un sistema genérico de purificación. — `js/item-enchanter-service-runtime.js`
- [x] Bind mágico bloquea desequipar/desintonizar y puede bloquear un espacio de Attunement. — `js/item-magic-runtime.js`, `docs/enchanters-update-part-d-magic-items.md`
- [x] El motor contempla Curse persistente al agotar Magical Durability y recarga/preservación según perfil explícito. — `js/item-magic-runtime.js`
- [x] La durabilidad física y Magical Durability permanecen separadas; efectos de encantamiento e instancias se integran en inventario y combate. — `js/item-enchantment-engine.js`, `js/item-enchantment-combat-runtime.js`
- [x] La librería de Status dispone de efectos negativos independientes, incluido el Status `bind` que reduce Speed. — `js/status-library.js`
- [x] El Enchanter’s Update (#931) fue fusionado a `main` y dispone de bridges de combate para los triggers canónicos realmente implementados. — `docs/enchanters-update-checklist.md`, [PR #931](https://github.com/sokcrow/Luminos-Character-Maker/pull/931)

## Backlog de Curse's Update V1 (pendiente de diseño / implementación)

### A — Contrato y decisiones de diseño

- [x] Definir y aprobar alcance V1: los cinco objetivos elegidos por el propietario, con implementación por etapas.
- [x] Distinguir formalmente `Curse`, `Bind` mágico, Status negativo, debuff temporal y desventaja inseparable de Relic.
- [x] Definir qué familias de Curse entran a V1: Item, Affliction, Binding, Ritual y Pact.
- [x] Decidir si puede maldecirse un Item sin encantamiento normal y cómo se representa sin inventar slots de Enchanter.
- [x] Definir niveles/severidad de Curse independientes del Rank de Enchantment cuando corresponda; ninguna curva universal automática.
- [x] Definir permanencia, duración, desencadenantes, expiración y condiciones para una maldición sin regla global.
- [x] Definir reglas de acumulación, fuentes múltiples, refresh/reapply y conflictos entre Curses y efectos de equipo.
- [x] Definir inmunidad, resistencia, Saving Throws o Checks solamente mediante perfiles autorizados y sin DC inventados.
- [x] Definir qué sucede cuando la fuente muere, se destruye, se desequipa, cambia de propietario o se desconecta.
- [x] Aprobar políticas de supresión, ruptura, transferencia y remoción por tipo, antes de implementar servicios nuevos.

### B — Curse Catalog, Instance y Runtime

- [x] Crear un documento de contrato canónico de Curse V1 con esquema, vocabulario y ejemplos aprobados. — `docs/curses-update-phase-a-contract.md`
- [x] Crear registro versionado de definiciones de Curse con ID estable, nombre, descripción, familias y targets elegibles. — `js/curse-catalog.js`, `tests/curse-catalog-smoke.cjs`
- [x] Separar definición de Curse de instancia activa, estado de conocimiento y Status secundarios. — Catálogo `js/curse-catalog.js`, instancias `js/curse-runtime.js`, conocimiento `js/item-magic-knowledge-runtime.js`
- [ ] Definir un `Curse Instance` con ID propio, origen, fuente, objetivo, timestamps, condiciones y provenance.
- [x] Implementar validación cerrada de familias, tipos de efecto, triggers, duración, recursos y referencias. — Schema fail-closed; efectos/duración/recursos sin adapter se rechazan, [CI verde](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/38335190664)
- [ ] Reutilizar Trait/Status/Spell/Item effect adapters donde sean compatibles; no introducir un segundo motor de efectos.
- [x] Definir contratos de activación `canApply`, `apply`, `resolve`, `suppress`, `remove` y consulta sin mutaciones accidentales. — `canApply/applyItem/canResolve/resolveItem` con operaciones whitelisted y consultas puras; eliminar no autorizado para la Curse publicada
- [x] Implementar control explícito de stacking, prioridad de fuentes y deduplicación por evento e instancia. — maxIntensity, regla de stacking, prioridad determinista, `eventIds`, target instance ID y validación de duplicados
- [x] Separar namespace de `item_magic_bind` del Status `bind` sin renombrar o romper el Status existente. — `equipment_lock` en Curse Runtime y guardia independiente en Equipment Bridge; Enchanter `bind` intacto
- [x] Evitar ejecutar scripts arbitrarios, funciones persistidas o payloads no autorizados desde las definiciones de DM. — Validador de definición y de instancia, whitelist de keys y `tests/curse-catalog-smoke.cjs`

### C — Integración con Item Curses y Enchanter

- [ ] Conservar los modificadores, TH, costos, reglas de Gems, restricciones de Bind y economía originales de Enchanter.
- [ ] Exponer un adaptador desde `magic.enchantments[].properties` a la taxonomía Curse sin migración destructiva.
- [ ] Respetar exclusión actual `bind` + `curse` en una misma referencia; no habilitar combinaciones sin diseño aprobado.
- [ ] Autorizar por definición cuáles son Curse removibles, Bound o perjuicios inseparables; fallar en cerrado.
- [ ] Corregir el alcance de `remove_curse` para seleccionar una Curse identificada de forma determinista, sin retirar la primera por defecto en objetos con varias.
- [ ] Preservar enlace Gem Anchor, restricciones de extracción y destrucción obligatoria de Item ante retirada de Gem ligada por Bind.
- [ ] Garantizar que la maldición persistente no reaparece duplicada por equipar, transferir, guardar/cargar o abrir inventario.
- [ ] Verificar que Curse no modifica automáticamente `Magic Hit`, enchants instalados, Physical Durability o Magical Durability.
- [ ] Conservar conocimiento individual por observador al transferir Items y mostrar solo información legítimamente descubierta.

### D — Affliction Curses en personajes

- [ ] Definir contrato aprobado de Curses directas sobre personajes/creaturas separado de `itemCurses` heredado.
- [ ] Implementar almacenamiento de Curse Instances en Player/NPC, con fuente, activación y provenance.
- [ ] Permitir aplicación explícita por una habilidad, Spell, ritual o autoría DM validada, sin aplicación universal.
- [ ] Conectar efectos de Curse a HP, SP, Sanity y otros recursos solo mediante payloads definidos y resolutores existentes.
- [ ] Hacer que una Curse genere Status canónicos como consecuencia sin convertirse en ese mismo Status.
- [ ] Evitar que limpiar Bleed/Burn/Sinking u otro Status destruya inadvertidamente la Curse de origen.
- [ ] Resolver modificación de stats, topes, buffs/debuffs y stacking mediante efectos canónicos y sin valores inventados.
- [ ] Definir comportamiento ante descanso corto/largo y progresión del tiempo sin cura automática genérica.
- [ ] Definir reglas comprobables para incapacitación, muerte, resurrección, restauración y personajes temporalmente ausentes.
- [ ] Aplicar el mismo contrato a unidades del DM y jugadores, respetando autoridad y visibilidad.

### E — Curse Knowledge, detección e identificación

- [ ] Mantener separados `Curse detected`, `Curse identified`, `drawback known` y comprensión del ritual cuando aplique.
- [ ] Extender el modelo de conocimiento a Curse Instances sobre personajes sin compartir secretos entre observadores.
- [ ] Mantener la distinción entre `Identify` ordinario y lectura/análisis dedicado de Curse.
- [ ] Definir Check/TH, SP, intentos repetidos y acceso a expertos solamente a partir de reglas aprobadas.
- [ ] Preservar color y escritura rúnica púrpura/roja para Curse no comprendida, sin exponer contenido interno.
- [ ] Mostrar origen, condiciones, severidad y métodos de cura solo en capas autorizadas por el conocimiento.
- [ ] Evitar filtraciones por tooltips, comparación de Items, historial, Battle Viewer, servicios y sincronización.
- [ ] Agregar vistas de resultado `no curse found`, `curse detected` y `curse decoded` distinguibles y comprensibles.

### F — Remoción, supresión, ruptura y transferencia

- [ ] Conservar `remove_curse` existente como operación limitada a Curse elegibles de encantamientos.
- [ ] Diseñar y aprobar si V1 incorpora `Suppress Curse` (temporal) y sus condiciones de reactivación.
- [ ] Diseñar y aprobar si V1 incorpora `Break Curse` con requisitos específicos por definición.
- [ ] Diseñar y aprobar si V1 incorpora `Transfer Curse`, qué targets son válidos y qué consecuencias persisten.
- [ ] Definir medidas de resistencia a limpieza y de preservación propias sin permitir que un Item ignore automáticamente todas las curas.
- [ ] Bloquear rutas normales sobre `Bind` mágico, Gem ligada y desventajas inseparables de Relic.
- [ ] Impedir que una cura ordinaria de Status elimine `Curse Instance` o reviva permanentemente estados temporales sin autorización.
- [ ] Autorizar y cotizar servicios únicamente cuando proveedor, conocimiento, recursos y objetivo sean elegibles.
- [ ] Separar preview, consentimiento, consumo de materiales, resultado y posible devolución ante fallo.
- [ ] Registrar historia, provenance, supresión y remoción irreversible de forma reproducible e idempotente.

### G — Combate, teatro, descansos y acciones

- [ ] Inventariar triggers de combate ya ejecutables y mapear solo Curse effects con bridge real.
- [ ] Implementar triggers de Curse aprobados en turn start/end, hit, damage received y otras fases sin simular hooks inexistentes.
- [ ] Proteger Multi-Coin: deduplicar activaciones por unidad de evento aprobada, no asumir una activación por Coin.
- [ ] Respetar guardas de muerto, equipo elegible, Attunement, recursos, Reaction y consumos explícitos de cada definición.
- [ ] Integrar acciones/Checks/Spells que apliquen o disipen Curse sin bypass de costo o Action Economy.
- [ ] Extender al teatro y Scene Time sin generar Curse nuevas durante render o por inspección pasiva.
- [ ] Resolver desgaste/recarga explícitos de Magical Durability y costes HP/SP/Sanity según autoridad existente.
- [ ] Definir y probar orden determinista entre Curse, Status, Traits, Enchantments, defensa y daño.
- [ ] Producir mensajes narrativos de juego útiles sin mostrar payloads técnicos.

### H — Curse Studio del DM

- [x] Integrar un editor Curse Studio en los flujos reales del DM sin duplicar el editor de Item o Character. — `js/dm-item-instance-editor.js`, `css/dm-item-instance-editor.css`, [Chromium CI aprobado](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/38311384748).
- [ ] Crear catálogo legible de Curse con filtros por familia, target y estado, sin IDs técnicos en interfaz de juego.
- [ ] Permitir crear/editar definiciones con módulos de efectos validados, no JSON/script arbitrario.
- [ ] Permitir aplicar, inspeccionar, suprimir y retirar Curse Instances con confirmación y autorizaciones DM.
- [ ] Respetar efectos sobre inventario, equipamiento y personajes con preview de consecuencias y conflictos.
- [ ] Crear autoría de especialistas y servicios de Curse reutilizando Shops/Workshops/Enchanter donde corresponda.
- [ ] Registrar acciones DM y origen de cada maldición sin revelar secretos en vistas de jugadores.
- [ ] Verificar desktop/mobile y ausencia de overlays, botones flotantes o paneles debug.

### I — Interfaz y experiencia del jugador

- [ ] Presentar Curse en detalles de Items según conocimiento y sin añadir etiquetas a maldiciones aún desconocidas.
- [ ] Presentar aflicciones detectadas del personaje en un lugar accesible y distinto de Status temporales.
- [ ] Permitir inspeccionar síntomas, causas conocidas y efectos activos con términos propios de juego.
- [ ] Permitir acciones autorizadas de análisis, servicio, ritual y consulta desde los menús existentes.
- [ ] Bloquear opciones imposibles con explicación funcional, sin permitir controles decorativos o acciones fantasma.
- [ ] Mostrar resultados, costos, riesgos y restricciones confirmadas antes de consumir recursos.
- [ ] Verificar diseño responsive y que menús, HUD, slots y acciones no queden tapados o inutilizables.
- [ ] Validar teclado, etiquetas accesibles y mensajes sin mostrar identificadores/debug internos.

### J — Persistencia, sincronización y autoridad

- [ ] Versionar y migrar con compatibilidad hacia atrás sin alterar Item Instances ya encantados.
- [ ] Persistir Curse Instances y conocimiento de cada observador por separado, sin duplicación tras load/rehydrate.
- [ ] Preservar Curse sobre Items en inventario activo, stash, equipado, transferencias y servicios diferidos.
- [ ] Preservar Curse personales al entrar/salir de combate y al cambiar entre hoja y DM.
- [ ] Realizar mutaciones sensibles desde runtime/autoridad real, no desde proyecciones del UI.
- [ ] Garantizar idempotencia, rechazo de replay y selección exacta de Instance target en aplicación/cura.
- [ ] Separar transacciones sobre jugador/Item/proveedor, prevenir saldo/materiales negativos y rollback parcial.
- [ ] No dar por segura la economía por las validaciones de Enchanter: auditar permisos heredados `campaña/jugadores/{player}`.
- [ ] Validar conflictos de dos clientes, propietario equivocado, versión obsoleta y reconexión antes de habilitar servicios pagados.

### K — Pruebas de regresión y aceptación

- [ ] Tests de esquema y validación de Curse con entradas malformadas y scripts rechazados.
- [ ] Regresión de Curse x1.50, Bind x1.25, +6/+4 TH y mercado x0.60 en Items existentes.
- [ ] Regresión `bind` Status Speed vs `bind` mágico de Item/Attunement sin colisiones.
- [ ] Regresión Identify/Detect/Curse Reading y filtraciones por UI/conocimiento.
- [ ] Regresión remove_curse seleccionando la fuente exacta, múltiples Curses, Bind y desventajas inseparables.
- [ ] Regresión de Gem Anchor ligada, extracción y destrucción de Item según reglas previas.
- [ ] Tests Character Curse -> Status generado -> Status curado -> Curse de origen persistente.
- [ ] Tests de múltiples fuentes, orden de efectos, duplicados, condiciones y expiración.
- [ ] Tests de duración, descanso, muerte, reingreso a combate, sincronización y save/load.
- [ ] Tests Battle Engine sobre trigger real, Action Economy, Multi-Coin y recursos.
- [ ] Tests Player/DM de Curse Studio y flujos de conocimiento y eliminación desde UI real.
- [ ] Tests Firebase Auth/RTDB emulados para propiedad, transacción, reintentos, rollback y dos clientes.
- [ ] Validar que los checkboxes de implementación no se cierren por tests escritos pero no ejecutados.
- [ ] Validar no-regresión de Enchanter, inventario, Status Library, Magic Items y Loot.

### L — Gate de cierre del PR

- [ ] Aprobar el contrato Curse V1 y documentar decisiones de diseño antes de publicar definiciones.
- [ ] Marcar implementadas solo las tareas con código y pruebas verificables, no por herencia de Enchanter.
- [ ] Completar CI y pruebas reales de navegador Player/DM/Battle Viewer.
- [ ] Verificar seguridad y atomicidad de servicios de Curse sobre datos reales o emulados pertinentes.
- [ ] Validar accesibilidad, UX responsive y ausencia total de controles debug visibles.
- [ ] Registrar limitaciones de deploy, flags y permisos sin confundir merge con activación en producción.
- [ ] Exigir revisión final del alcance: Curse's Update no puede introducir de contrabando Magic Loot, Relics o sistemas ambientales diferidos.

### M — Objetivos colectivos, territoriales y heredables (aceptados para V1)

- [ ] Definir target resolver para `place` con identidad de estructura, área y duración de pertenencia sin mutar Curse por render.
- [ ] Definir asociaciones `lineage` desde árbol genealógico real y autorización de heredabilidad.
- [ ] Definir pertenencia a `entity` para organizaciones y pactos, con altas, bajas y cambios de membresía.
- [ ] Definir Curse colectiva con instancia fuente y proyección de consecuencias por miembros elegibles.
- [ ] Definir Curse individual transferida/heredada desde colectiva que no desaparezca por abandonar el grupo.
- [ ] Autorizar objetivos de Ritual Curse sin inventar automáticamente círculos, DC ni materiales.
- [ ] Implementar API de Curse Instance autónoma para criaturas con control de recursos y Stats existente.
- [ ] Implementar contrato de Curse para `place` sin duplicar Theatre/Scene Time ni tiles de combate.
- [ ] Implementar contrato de Curse para `lineage` y propagación solo cuando su definición lo autorice.
- [ ] Implementar contrato de Curse para `entity` y membresías, incluidos pactos vinculantes.
- [ ] Mostrar Curse colectivas conocidas en vistas correspondientes del DM y Player sin revelar secretos.
- [ ] Probar altas/bajas de membresía, herencia, traslados, destrucción de la fuente y persistencia.
- [ ] Verificar que todo tipo de objetivo respete estados activo/suprimido/sellado/resuelto y sus métodos autorizados.
- [ ] Agregar pruebas de persistencia, autoridad e idempotencia para cada objetivo no-Item.

## Diferidos expresamente: no bloquear V1

- La propagación automática ambiental entre áreas, contagio epidemiológico o maldiciones generadas por tablas aleatorias no está autorizada por el solo hecho de incluir Places y Lineages: requiere contratos particulares.
- Tablas de drop, affixes aleatorios, maldición procedural de loot (Magic Loot Update).
- Relics Rank IV/V, mantenimiento de Relic e identificación excepcional (Magic Items Update).
- Rebalance o migración masiva de hechizos, Traits o familias de Status no relacionadas.
- Deploy o habilitación de pagos de Curse sin aprobación de seguridad de Shops/P2P.

## Notas de evidencia para futuras revisiones

- `docs/enchanters-update-checklist.md` y partes A–D documentan reglas canónicas ya fusionadas.
- `js/item-magic-knowledge-runtime.js` separa `detectCurse` e `identifyCurse`; `identifyItem` no expone el perjuicio.
- `js/item-enchanter-service-runtime.js` implementa `curse_analysis` y `remove_curse` para el camino compatible de Enchanter; elige el primer `curse` aplicable, por lo que la selección explícita de múltiples maldiciones es trabajo nuevo.
- `js/item-magic-runtime.js` maneja Item Curse/Bind/persistencia; `js/status-library.js` define el Status `bind` como reducción de Speed.
- La aceptación 350/350 de Enchanter corresponde a su implementación acotada; **no demuestra que Curse's Update tenga código propio ni que el backend pagado esté habilitado en producción**.

## Criterios para propuestas nuevas

Cualquier definición o mecanismo nuevo necesita: contrato de objetivo + disparador + efecto + persistencia + visibilidad/conocimiento + resolución/contraefecto + costo cuando aplique + regresión en runtime real. Si falta un requisito, permanece como propuesta no publicada.
