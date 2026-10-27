# Comparación de Clashes con nueve navegadores

## Escenario

Ocho cuentas de Player y una cuenta DM, cada una en un contexto Chromium aislado, abren la entrada real de combate y el Battle Viewer completo. Auth y RTDB funcionan en emuladores locales con `database.rules.json`; no se conecta a una campaña de producción. Los planes de los jugadores pasan por planificación y READY reales. Las dos acciones NPC de la fixture usan cartas obtenidas de sus manos reales y se publican por el canal de planificación del DM para fijar los mismos oponentes en ambas versiones; el sellado, las reglas, las tiradas y las animaciones usan el runtime de producción.

La carga contiene ocho combatientes jugador, dos NPC, tres Coins por Skill, ocho acciones de Player y dos acciones NPC opuestas. La semilla de reglas está fijada, las Skills de los tres tiers tienen la misma potencia y la iniciativa de la fixture conserva el mismo orden. Las animaciones usan sus duraciones normales, sin aceleración ni multiplicador. No se introduce retraso WAN artificial ni throttling de CPU. Los diez combatientes usan sprites SVG simples de la fixture; esta comparación no mide el coste de los assets de una campaña concreta.

Baseline de la optimización de Players: `cbba1548679606ed67a2d875ba27060920764dd1` (versión de escena compartida con P95 previo de 220,8 ms). La comparación histórica de escena usó `f4a66cddd3ea8a767f5b9614d5a2fc4e47b6d3e7`. El candidato usa el código actual del PR. Se ejecutan cuatro rondas independientes en orden **antes, ahora, ahora, antes**, con cuentas y viewports equivalentes. La comparación comprueba igualdad de semilla, secuencia de resultados del DM y estado final; una carga distinta no se presenta como mejora de rendimiento. La equivalencia excluye únicamente `actionApproach` de la lista de cues: es una nueva presentación de un acercamiento que ya ejecutaba el DM, sin reglas ni tiradas adicionales. Su latencia actual se muestra sin inventar una barra anterior.

## Comprobación visual

Las capturas del primer ensayo revelaron que recibir todos los cues no garantiza la misma escena: el zoom se limitaba al participante local, el resaltado se activaba fuera de la presentación en el DM y el acercamiento de ataques sin oposición no se transmitía. El candidato mueve el foco al renderer compartido, permite que los espectadores sigan el Clash y publica el acercamiento normal y Counter como presentación. Conserva sus duraciones fijas (520 y 220 ms).

La prueba del candidato exige en los nueve DOMs: cámara de combate en cada Clash, resaltado de ambos participantes y tokens realmente en movimiento. También exige el acercamiento de ataques sin oposición en cada visor. En todas las versiones contrasta cada resultado de Coin/poder/ganador y HP, SP, estados y escudos con el DM. Esto valida comandos, estado visual del DOM y capturas; no compara todos los píxeles de cada frame ni certifica fluidez.

## Qué se mide

- **Desfase visual frente al DM:** magnitud de la diferencia del primer `requestAnimationFrame` tras el inicio del cue, emparejado por identidad de evento. Incluye adelantos y retrasos. Es una oportunidad de pintar, no una lectura de píxeles de pantalla. El CSV conserva también el desfase con signo y el retraso positivo; un Player adelantado no se oculta como si estuviera sincronizado.
- **Tiempo entre frames:** intervalos de RAF durante la resolución. Es independiente del desfase entre visores; reducir uno no demuestra que el otro mejoró.
- **Recepción posterior al deadline:** llegada del lote al consumidor después de su hora prevista. Incluye el transporte local y la disponibilidad del hilo del navegador para atender el listener; no es una medida aislada de Internet.
- **Cola tardía:** inicio del cue después del mayor entre recepción y deadline. Excluye la espera intencional hasta la hora programada; incluye trabajo de aplicación de estados y presentación previo al cue.
- **Inicio a RAF:** espera hasta la siguiente oportunidad de pintar después de invocar la presentación.
- **Cobertura:** comandos omitidos y muestras sin RAF se registran aparte, nunca como cero milisegundos. Los percentiles describen las muestras observadas.

Mediana, P95 y máximo se calculan sobre datos crudos. P95 significa que el 95% de las muestras queda por debajo de ese valor. Se conservan los datos por Player, evento, fase y ejecución. Una pareja de capturas en vivo se toma en cada ronda; su coste forma parte del escenario medido en ambas versiones.

## Archivos

- `antes-ahora.png`: comparación del desfase en Clashes y del tiempo entre frames.
- `picos-por-fase.png`: fases ordenadas por el P95 de desfase actual, contrastadas con el baseline y con desglose de recepción, cola y RAF. Los percentiles de componentes no se suman.
- `summary.json`: validación de equivalencia, cobertura y estadísticas.
- `latency-samples.csv`: observaciones individuales para auditoría.
- `RESULTADO.md`: desglose de recepción, cola y RAF por fase.
- Cuatro `raw.json` y capturas del Battle Viewer real, incluyendo diagnósticos si una ronda falla.

## Interpretación

Nueve contextos Chromium comparten un runner CI. No son nueve dispositivos físicos ni nueve conexiones WAN. Los resultados sirven para comparar estas dos versiones bajo una carga reproducible y localizar fases problemáticas. No certifican el rendimiento de los teléfonos de los jugadores ni latencia de una campaña desplegada. La ejecución de esta comparación tampoco autoriza merge: el PR continúa como borrador.

## Presupuesto de Players

El workflow exige P95 de desfase absoluto en Clashes estrictamente menor de 100 ms. Con `COMBAT_BENCH_CLASH_BUDGET_MS=100` el reporte falla aunque resultados y escena sean correctos si se rebasa ese límite; no se ajusta la velocidad, calidad ni cantidad de animaciones. Se mide también el coste síncrono de applySnapshot, render, refreshPlayback, Stage y HUD por DM/Players. Los perfiles son inclusivos: sus duraciones no se suman entre APIs anidadas. Los cambios canónicos se aplican inmediatamente; solo su refresco DOM se agrupa por unidad/campo y se drena antes de cada cue, al finalizar o en el próximo RAF.
