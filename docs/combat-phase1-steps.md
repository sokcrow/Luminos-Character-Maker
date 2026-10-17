# Fase 1 — resolución incremental del combate live

Base: `eca1c66300de00342adc4adc94cbec1737a95f70`, PR #986 (Fase 0).
Esta rama depende de esa base; no sustituye su aceptación visual pendiente.

## Resultado y límites

El combate activo usa `js/combat-v073-steps.js` para calcular cada toss,
Clash, hit, Guard y Evade. Los wrappers públicos del HTML editable conservan
sus nombres y resultados. Counter sigue reaccionando después de cada hit,
invocando el mismo resolver incremental. Las salvaciones conservan su fórmula
canónica y registran un paso por target.

El núcleo no usa DOM, relojes, Firebase ni RNG visual. Recibe los helpers
canónicos como dependencias: no duplica fórmulas de daño, resistencias,
críticos, estados ni reglas homebrew. Resuelve un paso, aplica sus efectos y
solo entonces pide su presentación. No precalcula el resto de los hits: un
Counter puede derrotar al atacante y un hit puede dejar al target fuera de
combate antes de la próxima Coin.

No se han añadido batches de red, replay remoto, deduplicación ni nuevos
permisos Firebase. Continúan READY, planes sellados, semilla compartida,
ejecución local y checkpoints del DM. Esos cambios de transporte corresponden
a la Fase 2. Forest y el rediseño del HUD siguen fuera de esta fase.

## Propiedad de estado

| Capa | Responsabilidad |
| --- | --- |
| Authority `0.7.3-authority.9-step-rng` | Sello, RNG de reglas, serialización de acciones y checkpoints del DM |
| Steps `0.7.3-steps.1` | Orden incremental, una aplicación de efectos y eventos locales |
| Helpers live | Fórmulas y mutaciones canónicas de HP/SP, estados, shields y Stagger |
| Adaptador en `combatStepRuntime()` | HUD, tosses ya resueltos, movimiento y pausas |
| CoinEngine | Presenta `resolvedCoins` sin hacer otra tirada; mantiene su API anterior para Observation y otros usos |

## Orden y compatibilidad

- El orden live es Speed congelada y orden de cola, incluyendo parejas de
  Clash. Los temporizadores ya no deciden qué evento entra primero en la
  cadena autoritativa. El executor alternativo fuera del modo live conserva
  su comportamiento anterior.
- Dentro del Clash se conserva `A0, B0, A1, B1…`, también con cantidades
  distintas de Coins. Cada toss aplica Bleed; cada Heads consume Paralysis
  cuando corresponde. Grapple usa la misma pareja ordenada sin esos efectos.
- El hit aplica daño/healing una sola vez. Después resuelve estados existentes,
  On Crit, Tremor Burst, On Hit, Heads/Tails Hit y Counter, en ese orden.
  Los marcadores visuales no vuelven a causar daño.
- Guard conserva su excepción: no consume Bleed ni Paralysis. Evade no
  consume Bleed, sí Paralysis, y gana los empates. No se inventó una nueva
  regla para Unbreakable: se conserva su comportamiento/metadata actual.
- HP y SP se actualizan aunque falte su nodo de HUD. Cruzar umbrales consume
  y activa Stagger en el paso de HP. Antes dependía de temporizadores de la
  barra, cancelables por otro cambio de HP. Es una corrección deliberada de
  dependencia visual; las fórmulas y la ventana de Stagger se conservan.
- Los IDs de Concentration de un turno sellado usan semilla/cursor y una
  tirada autoritativa, sin hora local. Fuera del turno sellado se mantiene el
  comportamiento previo.

## Eventos locales v1

`LuminousCombatStepRuntime.events()` devuelve una copia JSON del último turno.
No escribe nada en Firebase ni dibuja diagnósticos. Se reinicia al empezar el
siguiente turno. Los eventos internos son inmutables.

Cada evento tiene `schemaVersion`, `engineVersion`, `round`, `roundId`,
`encounterId` (nullable hasta que exista una identidad de encounter canónica),
`seed`, `rngCursor`, `sequence` y `type`. Los eventos de acción incluyen
`actionId`, `ownerId`, `slotIndex` y `targetId`; los de Coin incluyen índice y
side. `actionId` es local al turno, con owner y slot. Una reacción Counter
reutiliza el slot de defensa; no es todavía un ID global de replay.

Eventos: RoundSealed, QueueEntryStarted/Finished, ActionStarted/Finished,
ActionCancelled, ClashStarted, ClashRoundResolved, CoinBroken, ClashFinished,
CoinRolled, HitResolved, HitEvaded, ShieldApplied, EvadeResolved, SaveResolved,
RoundEndEffects y RoundFinished. Las mutaciones añaden cambios de estado y
notificaciones derivadas DamageApplied, HealingApplied, StatusChanged,
UnitStaggered y UnitDefeated. Las notificaciones de HP representan el delta
neto del paso; `HitResolved.result` conserva el desglose de daño y absorción.
No equivalen todavía a un log completo que pueda reconstruir todo el encounter.

`LuminousCombatStepRuntime.setPresentationEnabled(false)` omite los callbacks
de presentación del núcleo. Es una API interna para integración y pruebas,
sin control visible de depuración. No altera la semilla ni las reglas. Las
transiciones externas de menú/turno y el refresco normal del HUD permanecen.

## Verificación reproducible

```sh
npm run check:combat-live
npm run test:combat-phase0
npm run test:combat-phase1
```

La referencia congelada `tests/fixtures/combat-phase1-legacy.json` contiene
las rutinas de orquestación anteriores, identificadas por commit. El harness
las ejecuta frente a las nuevas con los helpers reales del source, sustituyendo
solo rendering. Compara efectos, estado, tiradas y cursor para 30 combinaciones
de hits/semillas, más Clash asimétrico, Guard, Evade, Counter recursivo y
salvación. Los eventos nuevos deben coincidir entre presentación activa e
inactiva. Los invariantes de Stagger y HP/SP sin DOM tienen casos separados;
no se afirma que la corrección del temporizador replique ese defecto anterior.

`tests/combat-phase1-boundaries.mjs` verifica el orden live sin reloj,
presentar/repetir Coins sin consumir RNG, IDs de Concentration sembrados y
copias aisladas del journal.

El workflow de la base ejecuta además dos escenarios con Auth y RTDB locales:
DM + dos Players animados, y DM + dos Players con uno sin presentación.
Compara sus eventos, cursores y digests locales antes de recargar, además del
estado final del DM, permisos y persistencia. Evidencia:
`artifacts/combat-phase0/phase1-steps-animated.json` y
`phase1-steps-mixed.json`, junto a las capturas del browser.

La aceptación visual en la app desplegada y los recortes de HUD registrados
en Fase 0 siguen pendientes. No se despliegan reglas ni aplicación a producción.
