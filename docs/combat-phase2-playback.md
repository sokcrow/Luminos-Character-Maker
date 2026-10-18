# Fase 2: reproducción online de resultados

Base: Fase 1 (#987), a su vez dependiente de #986. Esta rama no despliega reglas ni aplicación a producción.

## Comportamiento

El jugador elige y confirma sus acciones mediante los menús existentes. El sistema valida y resuelve esas decisiones. La IA conserva su alcance sobre NPC/enemigos.

Al confirmar READY, el visor anuncia su versión de reproducción. Si todos los jugadores activos soportan `0.7.3-playback.1`, el DM sella un turno con reproducción de resultados. Si alguno utiliza el visor anterior, ese turno conserva la ejecución sembrada y los checkpoints de Fase 1. Un turno que ya anuncia reproducción nunca vuelve silenciosamente a ejecutar reglas locales por incompatibilidad: pide actualizar el visor.

En reproducción, solamente el DM ejecuta la cola. Publica lotes de resultados al terminar cada entrada y un lote de cierre. Los Players aplican valores absolutos y reproducen comandos visuales con Coins ya resueltas; no invocan el executor, daño, costes, tiradas ni efectos de impacto. El HUD aplica cada cambio antes de su comando visual. El cliente atrasado omite animaciones antiguas para alcanzar el estado confirmado.

## Contrato y persistencia

- `authority/current`: planes sellados, semilla, identificador/generación y sesión de pestaña DM; checkpoint con `seq`, `eventCursor`, `rngCursor`, digest, estado completo en `stateJson` y estado de reanudación en `executionJson`.
- `playback/current`: versión, generación y `batches/{seq}`. Es una rama separada del listener de autoridad y conserva solamente la generación actual.
- Cada sobre tiene versión, generación, secuencia, tiempo de servidor y `payload` JSON. El payload contiene eventos ordenados, cambios de estado, estado final del lote y referencia al checkpoint. La codificación conserva vacíos y nulls: RTDB los eliminaría de un objeto, impidiendo limpiar Status, listas pendientes o recursos agotados.
- Los cambios por evento omiten el estado anterior y las copias de unidades que no cambiaron. No se envían frames, partículas ni recursos gráficos.
- Lote, checkpoint, vitales e inventarios/recursos presentes en el runtime se escriben en una actualización atómica. No se reemplazan contenedores ausentes por valores vacíos. Los reintentos escriben valores absolutos.
- Las reglas de RTDB permiten publicar solamente al DM y rechazan cambiar el payload de un lote existente o mezclar generaciones. La misma escritura puede repetirse.
- El consumidor ordena lotes, espera huecos y deduplica antes de presentar. Un conflicto, versión incompatible o discontinuidad de eventos detiene la reproducción.

## Reconexión y autoridad

Una recarga del Player aplica el último checkpoint confirmado y escucha los lotes posteriores. No vuelve a resolver la Skill ni a consumir objetos. Si el DM ya terminó, el visor entra en la siguiente planificación con el estado final. Al hidratar de nuevo se restaura también `stateJson`, incluidos los Status vacíos.

El sellado de reproducción utiliza una transacción RTDB y una sesión por pestaña del DM. Dos pestañas no pueden iniciar el mismo turno. La siguiente acción espera a que se confirme la escritura anterior. Si la conexión de la pestaña autoritativa vuelve, la escritura pendiente puede continuar sin recalcular la acción.

Si se pierde la pestaña autoritativa, otra pestaña autenticada del mismo DM ofrece «Reanudar turno aquí». La recuperación reclama la autoridad mediante transacción, restaura el último estado confirmado, las entradas de cola consumidas, defensas reactivas y Grapple, y continúa con el cursor de RNG/eventos correspondiente. Una acción interrumpida sin confirmar se descarta y vuelve a resolverse desde ese límite; sus costes no se habían publicado. Los resultados ya confirmados no vuelven a ejecutarse. También puede recuperarse un turno sellado antes de comenzar.

Cada checkpoint y lote nuevo lleva la sesión del executor. Las reglas rechazan escrituras de la sesión anterior tras el relevo; los lotes existentes siguen siendo inmutables. El executor anterior comprueba su autoridad en los límites de pasos y se detiene. La transferencia requiere que el DM pulse el control: no se elige otro DM automáticamente. Un turno iniciado con una versión anterior que no guardaba el estado necesario pide continuar desde su pestaña original.

## Menús y presentación

Mientras se reciben resultados, Skills, selección de objetivos y READY permanecen bloqueados. El cierre confirmado vuelve a planificación. La desconexión muestra «Reconectando…» y la espera muestra «Esperando los resultados del DM…». No se añaden IDs, cursores ni controles de prueba a la interfaz.

Se reutiliza la presentación de Coins, Clash, Guard/Evade e impactos extraída en Fase 1. Los eventos de otras acciones conservan sus resultados y estado, pero su coreografía específica y el rediseño responsive pertenecen a Fase 4. Este cambio no certifica todos los recorridos de Spells, objetos, reacciones ni todos los dispositivos.

## Validación

- `npm run check:combat-live`: fuente editable y shards reproducibles.
- `npm run test:combat-phase0`: 37 comprobaciones existentes.
- `npm run test:combat-phase1`: equivalencia de reglas, estados y RNG con/sin presentación.
- `npm run test:combat-phase2`: orden, duplicados, llegada tardía, reanudación, vacíos, incompatibilidad y reproducción sin mutaciones/RNG.
- `tests/combat-phase0-auth-emulator.mjs`: Auth/RTDB reales locales, permisos negativos, dos transacciones DM, reintento atómico, rechazo de lotes alterados y escrituras de la pestaña relevada.
- `tests/combat-phase2-online.spec.mjs`: visores reales, dos Players y dos pestañas DM, menús de Skill→objetivo→READY, bloqueo durante resolución, presentación omitida, desconexión/recarga, cierre de la pestaña DM, reanudación desde el control real y redelivery. Exige cero ejecuciones de cola/tiradas en Players e igualdad final.

La evidencia de navegador se publica en el workflow Combat Phase 0 Baseline junto a la regresión de Fase 1. Las capturas usan sprites locales de prueba y no certifican los recursos artísticos finales.
