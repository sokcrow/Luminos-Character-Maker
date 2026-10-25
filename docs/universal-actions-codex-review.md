# Codex review — Unit Universal Actions integration

Revisar P0/P1 del flujo integrado sin fusionar. La implementación conecta política, autoridad, planificación, ejecución, intents independientes y recuperación; no es únicamente una base de política.

## Regresiones corregidas

- Identidad de reserva obligatoria en commit/cancel; normalización RTDB y Slot/acción exactos de Help.
- Cierre recuperable: `roundEndProgress` se captura/restaura junto al roster, cola y `resolvedKeys`. Concentración, daño/decaimiento de estados, Death Saves y fase IA posterior no se repiten al reanudar Turn End.
- Help recuperable: se persisten planes por Unit y se reconectan referencias de la cola por Unit/Slot comprobando el fingerprint. Skills idénticas en otros Slots no reciben el bonus.
- Integración con main conserva Death Saves/Downed, retirada tras estabilización y mazos V2. El bundle se regenera desde la fuente integrada.

## Evidencia local

`tests/unit-universal-action-recovery-smoke.mjs` ejecuta capture/restore y cierre de producción para Player/IA, recarga tras el primer checkpoint Turn End con Burn/Poison activos y comprueba que solo continúa la acción pendiente. También comprueba Help tras recuperación, Slots con Skills idénticas y sustitución de la acción.

Se ejecutan además política/runtime, intents independientes, autoridad, recuperación sealed/RNG/playback, regresiones reales PR1042, Downed, Death Save RNG, mazos V2, Clashable defenses y la suite GOAP completa.

## Nueva corrección: mazos IA y baseline de la siguiente ronda

- `planAiRoster` obtiene `actionOptions` para cada Slot y el GOAP filtra y limita candidatos por esa mano. La conversión retiene `deck`, `drawId` y `sourceSlotIndex`; no reasigna una carta a otro Slot al dejar huecos. La búsqueda mantiene el presupuesto compartido de recursos de toda la secuencia.
- `captureExecution` normaliza el marcador de cierre antes de crear el baseline; `restoreExecution` también normaliza marcadores de otra ronda, incluidos checkpoints anteriores a esta corrección. El avance de ronda reinicia el marcador.
- `unit-universal-ai-deck-smoke.mjs` usa DeckEngine, GOAP, adaptadores, serializador de autoridad y validador de sellado reales para IA aliada/enemiga; comprueba cartas por Slot, Skills no seleccionadas, drawIds, consumo/rotación y candidatos de Slots posteriores.
- `unit-universal-action-recovery-smoke.mjs` ejecuta el bloque de inicio de producción en ronda 2 tanto con baseline nuevo como con marcador heredado de la ronda 1. El timeline y la acción pendiente se ejecutan; un cierre legítimo de la misma ronda permanece omitido.
- La prueba de pertenencias NPC carga los módulos reales nuevos antes de extraer el dispatcher; no sustituye la comprobación del propietario por un mock.

## Diagnóstico de CI anterior

En el commit anterior, Unit Universal Actions (incluida la aceptación responsive) pasó. Otros workflows fallaron. Se reprodujeron **también en main `1629ce7a`**, sin cambios de este PR, las aserciones de `equipment-effects-live-smoke`, `native-enemy-physical-profiles-smoke` y `cave-sapphire-spiders-smoke`. Los logs además muestran fallos de inventario, del fixture XP del emulador de loot y del benchmark de combate. No se afirma que la CI global esté verde ni que estas incidencias estén corregidas en esta entrega.

## Focos de revisión restantes

Revisar efectos y presupuesto atómicos, reintentos concurrentes, ownership/READY, identidad de Help normal/Quick y recuperación en cada checkpoint. Reportar únicamente fallos reproducibles con ruta, causa y caso Player/IA.

Siguen pendientes la aceptación visual en los seis tamaños TX-01 y el despliegue/aceptación de reglas Firebase. Help conserva Speed; adelantarlo al aliado más rápido no está ratificado. No presentar estas validaciones pendientes como ejecutadas.

Aplicar GH-01: publicar, solicitar review y terminar sin esperar checks ni una nueva revisión.

## P2: condiciones de Help Quick

`useInstant` consulta `LuminousConditionRuntime.actionAvailability` antes de preparar el presupuesto, tocar el ledger o aplicar efectos. Usa `quick_action` para la variante Mastermind y conserva la razón canónica del rechazo. Las Universal Actions Free pasan también por el gate con `universalAction:true`.

La regresión falló antes del fix tanto en el runtime directo como en el procesamiento autoritativo real. Ahora se prueban Paralyzed, Petrified, Incapacitated y Confusion para Player/IA/remote: rechazo sin mutaciones de presupuesto/ledger, Help ni Misdirection; tras quitar el estado vuelve a ser válido. La prueba de intents confirma además receipt negativo idempotente y roster canónico intacto, con un caso sano de control que sí consume y aplica Help.
