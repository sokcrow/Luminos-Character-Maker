# Limbus — Universal Actions por Unit: contrato, P0 / P1 / P2

**ESTADO: BASE TÉCNICA, NO INTEGRACIÓN COMPLETA DEL COMBATE.** No fusionar el PR hasta cerrar prioridades P0 y validar los flujos online.

## Contrato canónico (~6 segundos por turno)

**La Unit es el contenedor y la unidad de reglas.** Controlador jugador, IA o DM sólo determina quién puede elegir/autorizar; la economía, los recursos y los bloqueos son idénticos. Cubrir jugadores, aliadas IA, enemigas IA, NPC, invocaciones, refuerzos y Backup.

1. Tener 1, 2 o 3+ Action Slots permite varias acciones distintas, no repetir Universal Actions. La disponibilidad de Slots y la oportunidad de uso por fase son restricciones INDEPENDIENTES.
2. Cada Universal Action normal reserva exactamente 1 Action Slot durante Planning y una oportunidad de su fase de ejecución; tras usarse queda bloqueada ese turno incluso si falló su Check. Antes de READY se permite cancelar o cambiar la reserva, sin gastar el uso definitivo. Tras READY no se modifica.
3. Una Unit sólo puede utilizar **una Universal Action de Combat Phase por turno**: Help, Grapple, Calm, o Liberate (cualquiera de sus tres métodos).
4. Una Unit sólo puede utilizar **una Universal Action de On Turn End por turno**: Wake Up, Retreat o Escape. Action Slots surplus/adicionales **no** conceden una segunda oportunidad de Turn End.
5. Las fases son independientes: Help + Attack/Skill + Escape es legal con suficientes Slots; Calm + Liberate NO es legal. Un Skill/Spell/Item/Trait ordinario no gasta el cupo de Universal Action por compartir Combat Phase.
6. Analyse y Find son Free, instantáneas durante Planning y una de cada una por turno, sujetas a condiciones reales. No gastan el cupo Combat ni Turn End.
7. **Quick Action significa ejecución inmediata al confirmar**, sin esperar READY, Speed ni Combat Phase. Consume un Quick budget de su propia Unit. Skills, Spells, Items y Traits también pueden ser Quick según metadata estructurada; Reactions son por Trigger, no por confirmación.
8. Help normal reserva un Action Slot y una Action específica de un aliado: +1 Final Power una sola vez, 1 Help normal por Unit/Turn. Timing exacto cuando el aliado actúa antes: propuesta provisional "antes de la Action objetivo"; esta excepción aún necesita ratificación del usuario, NO afirmar decisión definitiva.
9. Mastermind: Trait real **Master of Tactics** de Rogue Mastermind ya disponible a nivel 15 de su progresión Limbus. Permitir Help normal + **un Help adicional Quick**, dirigido a **otro aliado**, jamás tres Helps ni el mismo objetivo dos veces. Conservar bonus por Speed +1/+2/+3 adicionales y efecto Misdirection. Validar Traits desde Unit canónica del servidor, no desde flag del cliente.
10. Liberate usa una sola familia de cooldown para Sleight of Hand, Strength y Athletics; fallar un método no desbloquea otro. Escape no es Retreat. Find no es Loot.
11. Unit a 0 HP, retirada, escapada o inactiva cancela toda ejecución pendiente, buffs no aplicados, daños, salidas y efectos. Ningún target o habilidad puede resolverse por estar pendiente en la cola.
12. La autoridad procesa ledger + presupuesto + efecto + receipt de manera idempotente: el doble clic, retry, timeout, reconexión o dos clientes no pueden duplicar uso, buff ni gasto. Snapshot coherente para DM, jugador e IA; pantalla productiva, no HUD debug.

## Tabla de ejecución

| Universal Action | Ejecución | Coste | Resolución que debe conservarse |
| --- | --- | --- | --- |
| Analyse | Planning inmediato | Free 1/Turn | 5 Coins Power 4 + Perception/Insight; observa HP/SP/Speed/Slots/targets/resistencias/equipo; Blinded falla |
| Find | Planning inmediato | Free 1/Turn | Invisible previamente advertido, Perception vs Threshold; objetivo localizado |
| Help | Combat, vinculada a acción aliada | 1 Action Slot | +1 Final Power a un Slot específico, no a todo el aliado |
| Grapple | Combat según Speed | 1 Action Slot | 5 Coins Power 4 + Athletics vs Athletics/Acrobatics, captura Slots y Break Free; otros aliados del grappler +15% DMG |
| Calm | Combat según Speed | 1 Action Slot | CHA vs Frightened Threshold; éxito elimina Frightened |
| Liberate (3 variantes) | Combat según Speed | 1 Action Slot | Sleight TH12+Count, STR/ATH TH14+Count, self +4 |
| Wake Up | On Turn End | 1 Action Slot | Elimina Sleep al cierre |
| Retreat | On Turn End | 1 Action Slot | Regresa a Backup, reemplazo, +5 HP/-3 SP por turno en reserva con límites |
| Escape | On Turn End | 1 Action Slot | Abandona Encounter y no obtiene XP |
| Mastermind Quick Help | Planning inmediato | 1 Quick | Segundo Help a otro aliado, Trait real y buffs de clase |

**Separar:** economyCost, executionPhase, timing/trigger, target/cooldown y resolver. La UI de cost no es fuente de verdad: el texto decorativo "Free · 1/Turn" no debe convertirse automáticamente en Action por metadata ausente.

## Qué contiene este PR

- js/unit-universal-action-policy.js: módulo independiente de UI y Firebase que define fases, catálogo, variantes, check/reserve/cancel/commit/useInstant/snapshot y ledger serializable **por Unit**, no por controlador.
- tests/unit-universal-action-policy-smoke.mjs: prueba real headless de IA/jugador, 3 Slots, límites Combat/Turn End, Help normal y Mastermind Quick en targets distintos, cancelación previa, Free Action y rehidratación de Unit.
- Este PR NO conecta el módulo a la autoridad del Encounter ni resuelve la UX o el daño. Es la base a integrar; no afirmar que el sistema ya funciona en vivo. El smoke local de la política no reemplaza pruebas E2E.

### Flujo autoritativo a implementar

1. Resolver Unit canónica y encuentro/round; autenticar permisos controlador, HP/estado, target, slot y fase.
2. Planificar: reservar Slot y oportunidad por fase de forma atómica con intentId estable. Cancelar/cambiar antes de READY libera reserva; después de READY queda inmóvil.
3. Ejecución: volver a validar Unit, target y Slot; comprometer ledger una vez y llamar el resolver existente; si falla Check se consume; si la Unit murió/salió, se cancela el efecto pendiente.
4. Quick/Free: ejecutar instantáneamente con único receipt; Quick consume el presupuesto Unit en la misma transacción con el efecto. No permitir resultados optimistas locales que se dupliquen desde DM.
5. Reconexión/turno: preservar estado ledger al rehidratar, limpiar al avanzar round en autoridad, rechazar intents antiguos, compartir deltas con DM/Players en orden.

## P0 — Bloqueantes antes del merge

- **P0.1 — Identidad Unit universal:** unificar UnitId/actorId/combatId/roster; misma lógica para unidades IA aliadas, enemigas, jugadores, NPCs, invocaciones, reservas y refuerzos.
- **P0.2 — Integración de fase/economía:** conectar contrato a universal-action-economy, team-action-economy, combat-action-schema/adapters/queue. Eliminar Help limitado por EQUIPO (team.helpRemaining) y preservar presupuestos Quick/Reaction propios de Unit; evitar dos libros de gasto.
- **P0.3 — Autoridad transaccional:** serializar intenciones de Unit; revisar ownership, phase, valid Slot, READY, presupuesto, HP, target, duplicación intentId, reconexión y retorno de receipt. Nada se gasta solo desde UI.
- **P0.4 — Reparar Global Actions UI:** en combat-v073-economy-menu + economy-review-fixes y fuente Battle Viewer, garantizar seleccionar -> detalles/CONFIRMAR -> seleccionar target/Slot -> READY -> ejecución, y Free instantáneas sin menú muerto.
- **P0.5 — Dispatcher por fase:** Help/Grapple/Calm/Liberate con límite único Combat; Wake/Retreat/Escape al cerrar Turn; Analyse/Find Free, Quick instantánea, Reaction sólo por Trigger.
- **P0.6 — Resolver único por efecto:** reutilizar los handlers legacy de Grapple/Help/Calm/Liberate/Analyse/Find/Turn End (incluidos XP/Backup/Grapple bonus); no crear resolutores paralelos con reglas distintas.
- **P0.7 — Mastermind Trait:** integrar Master of Tactics real, permitir Help normal + Quick adicional con distinto aliado, preservar bonus Speed y Misdirection, consumir una Quick Action por Unit.
- **P0.8 — IA:** GOAP/AI deben reservar y gastar por la misma API/autoridad, tanto aliadas como enemigas, con 1–3 Slots.
- **P0.9 — Sincronización online:** DM y jugadores observan acciones/confirmaciones/fracaso consistentes; no duplicar clips o effects en recepción remota, incluso si el DM está temporalmente desconectado.
- **P0.10 — E2E:** tests funcionales de menús+resolver+autoridad, multiusuario, 0 HP antes de ejecución, Quick spam, doble intento, reset round, slots extra, faction de IA.

## P1 — Calidad y paridad

- **P1.1 Responsive TX-01** simultáneo: 360x800, 390x844, 844x390, 768x1024, 1280x720, 1920x1080; botones >=44px, accesibilidad táctil, mouse, scroll visible y navegación completa.
- **P1.2 Metadata canónica** para Skills/Spells/Items/Traits/Reaction: economyCost, executionPhase, targeting, no strings de coste como semántica.
- **P1.3 Observe/Invisibility**: Analyse/Find una vez, requisitos de Blinded/awareness, visibilidad por permisos en sincronización.
- **P1.4 Help**: +1 Final Power exactamente una vez al Slot correcto, sin retrospectividad ni bonus sobre acciones canceladas.
- **P1.5 Turn End**: Escape/Retreat/Backup no duplican XP, reemplazo ni recuperación; cancelar al morir y al terminar Encounter.
- **P1.6 UI de producción**: bloqueos claros "Reservada", "Usada", "No disponible"; iconos del registro real, sin logs, UUID, JSON o menús debug.
- **P1.7 Regresiones**: Battle Viewer 0.7.3/0.7.4, DMs, Theater y Reactions, Performance de Players desfasados.

## P2 — Mejoras posteriores

- **P2.1** Autoría declarativa para nuevas Universales; **P2.2** variantes de Trait que cambien límites autorizadamente;
- **P2.3** diagnósticos/replay de ledger sin UI debug; **P2.4** decisiones tácticas IA con metas;
- **P2.5** empate Speed, cambio de facción, refs a target borrado, backups parciales.

## Review y aceptación

Pedir a Codex revisar **P0/P1 reproducibles** con ruta, línea, caso jugador/IA, riesgo real, fix mínimo y prueba recomendada. Incluir especialmente scripts del combat Viewer legacy, plan-sync, remote-intents, unit-independent-actions, Mastermind y team economy. Detectar clases de fallo por bucles de confirmación, disponibilidad por equipo, doble gasto, rollback, targets inválidos, abortos por 0 HP y metadata inexistente.

El PR permanece **draft** hasta completar P0 y las pruebas online / mobile / desktop. No se autoriza merge. Respetar GH-01: publicar y solicitar review sin esperar workflows, jobs ni respuesta de Codex.
