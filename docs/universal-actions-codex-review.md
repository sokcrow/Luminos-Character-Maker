# Codex review — Unit Universal Actions policy foundation

**Solicitud:** hacer REVIEW estricto del PR y del riesgo de integración contra el código actual. REPORTAR P0/P1 reales; no modificar ni fusionar sin orden posterior. Este PR es FOUNDATION, no end-to-end.

## Riesgos concretos en los archivos NUEVOS

1. El ledger se guarda directamente en Unit. ¿El round reset mediante check/snapshot de un turno posterior podría borrar el estado de otro cliente si se llama fuera de la autoridad? La validación de llamada autorizada NO vive aquí y deberá existir en el dispatcher.
2. check/reserve/commit NO valida slot máximo real, propiedad del Unit, target válido, READY, HP, ni consumición Quick. Determinar si algún consumidor existente podría llamar a estas APIs de forma insegura; documentar/añadir integración obligatoria antes del merge.
3. ¿El commit de la acción y el efecto de resolver se pueden desincronizar ante throw, network retry o muerte intermedia? Pedir transacción/idempotencia del intentId y manejo de receipt consistente.
4. Help sólo guarda targetId de la Unit, aún no targetActionSlotId. Verificar que el adaptador use identificador del Action Slot elegible y que el buff de +1 Final Power no se aplique a la Action equivocada o después de resolver.
5. Mastermind Quick Help: revisar comprobación de Trait real vs runtime ausente; no confiar en booleanos enviados por cliente. Dos Helps deben ir a DOS aliados distintos, uno Action normal y otro Quick; nunca tercera ayuda, nunca doble gasto. Mantener bonuses por Speed y Misdirection del Trait existente.
6. Si el target del Help normal está reservado y se usa Quick sobre ese mismo target, debe rechazarse. También cuando la Quick se usa primero y se intenta programar Help al mismo target. Caso de prueba.
7. Las 3 variantes de Liberate tienen el mismo cooldown; elegir un método distinto nunca elude la fase Combat.
8. Dos Universal Actions del mismo phase reserve al mismo tiempo por diferentes clients/requests; el ledger JS síncrono no sustituye una transacción remota. Verificar carrera autoritativa.
9. La política no resuelve que el unit haya muerto, esté escaped, en backup, incapacitated o fuera de Encounter: la autoridad debe abortar todas las acciones pendientes antes de ejecutar mutaciones.
10. Clasificación: Free Action inmediata Analyse/Find vs Quick Action inmediata del Trait vs Action Slot según fases. No asumir que toda Free tiene cap genérico, ni que todo Quick es Universal. Analizar cancelación previa a READY y fases después de READY.
11. IDs del estado: el ledger y las reservas viajan en JSON; serialización de Unit/Firebase no debe perder, reemplazar o compartir ledger de dos Units, ni hacer que otro controlador sobrescriba estado.
12. El policy utiliza un provisional timing "before_target_action" de Help todavía no ratificado por el usuario; flaggear si un integration PR lo impone sin aprobación.

## Paths actuales a inspeccionar en todo el repositorio

- js/team-action-economy.js: team.helpRemaining y consumeHelp establecen un límite por EQUIPO contrario a la nueva regla por Unit. También team.quickActionRemaining: contrastar con límite Quick por Unit de universal-action-economy.js.
- js/universal-action-economy.js: quickActionRemaining/reactionRemaining, scheduleAction y reset. Detectar doble ledger y doble gasto si se añaden flags de fase sin reconciliar.
- js/combat-action-schema.js, js/combat-action-adapters.js, js/combat-action-resolver.js, js/combat-action-queue.js: selectedAt / executesAt, Help modifier, targets por Slot, fase On Turn End, cancelación y fallback.
- combat/source/combat-v073-live.html: catálogo permanente y contextual, selectAction, renderCleanList/confirm, enterAnalyseMode, executeFindFreeAction, resolveHelpAction, resolveGrappleAttempt, resolveCalmAction, performLiberateCheck, resolveLiberateAction, resolveWakeUpAction, markRetreatAction, markEscapeAction, processTurnEndExitActions, processBackupRecovery, deploy/replacements.
- js/combat-v073-economy-menu.js y js/combat-v073-economy-review-fixes.js: renderGlobalList termina el flujo sin confirmar; clasificador observa economyCost en metadata pero el legacy trae cost texto, lo que puede clasificar Analyse y Find mal. Revisar click físico y mouse; mobile y desktop.
- js/combat-v073-plan-sync.js, js/combat-v073-remote-intents.js, js/unit-independent-actions.js: requestIndependentAction, unit authority, receipt, reintentos, timeout, sourceId de Globals sin id canónico, transacciones Quick.
- js/mastermind-archetype-runtime.js: prepareMastermindHelp reescribe cost a quick_action, lo que puede hacer imposible Help normal si no hay variante de camino; confirmar buff por Speed/trait y Misdirection.
- js/unit-ai-universal-actions.js, js/individual-goap-combat-ai.js y consumidores de actor/Unit: paridad Player/IA, no un selector exclusivo Player.
- tests/combat-v073-economy-menu-smoke.mjs y demás smoke: no confundir pruebas source.includes con ejecución end-to-end.

## Matriz de repro exigida (al menos)

- Unit jugador con 3 Slots: Help(A) + Attack + Escape válido; Help(A) + Grapple inválido por Combat phase; Calm + Liberate inválido; Retreat + Escape inválido.
- Unit IA aliada con 3 Slots: igual bloqueo; enemigo IA con 2 Slots: igual economía; backup/refuerzo no ejecuta planes desde fuera del campo.
- Liberate Sleight falla y no puede reintentar por Strength/Athletics en el mismo turno.
- Analyse y Find se confirman inmediatamente; limitados por turno/condiciones; no gastan Action Slot ni Quick Action.
- Dos jugadores y DM ven un único buff Help sobre el mismo Slot aliado, independientemente de la Speed; target invalidado cancela el buff.
- Rogue Mastermind verificado en Level 15: un Help normal y otro Quick en distintos aliados, sin tercera ayuda; no gastar segundo Quick por retransmisión, preservar bonus específicos.
- Double click, 2 intents idénticos, intents de rounds anteriores, pérdida de autoridad temporal, timeout, reconnect y retries: a lo sumo un efecto y un gasto; rechazo visible.
- Unit a 0 HP antes de turno/Turn End: ninguna acción pendiente sigue ejecutando efectos; no se escapa/retiro artificialmente después de caer.
- Reactions preparadas se gastan únicamente con Trigger real y handler; Skills/Spells Quick se ejecutan inmediatamente desde la misma Unit.
- Turn End Retreat rota backup/recovery una sola vez; Escape quita XP una sola vez y no vuelve como Backup.
- Móvil 360x800, 390x844, 844x390; tablet 768x1024; desktop 1280x720, 1920x1080. Todo control de actions/slots/targets clicable, sin paneles debug.

## Formato que necesito del review

- Solo P0 y P1 accionables; ruta y línea, causa, reproducción en Unit de jugador Y en Unit IA, impacto (seguridad/sync/gameplay/UI), fix mínimo y test que faltó.
- Distinguir bug confirmado, arquitectura todavía pendiente por el alcance parcial de este PR y decisión de diseño aún no ratificada.
- No marcar como "resuelto" un problema que está únicamente escrito en este documento, sin código implementado y verificado.
- No arreglar/fusionar por iniciativa propia, ni esperar al terminar Github Actions: la conversación continúa solo cuando el usuario lo solicite.
