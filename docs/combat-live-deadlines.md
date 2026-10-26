# Animación en vivo: DM y seis jugadores

## Fallo reproducido

El Teatro calcula la escritura visible desde `startedAt` y el tiempo transcurrido (`js/theatre-engine.js`). Cada actualización vuelve a la posición actual del texto.

Combate ya envía `timing.playAt`, pero el consumidor esperaba la duración completa de cada animación local antes de avanzar. Su agrupación de Coins paralelas solo funcionaba dentro del mismo lote. Al separar ambas Coins en dos sobres, el segundo lado empezaba 300 ms tarde desde el primer intercambio. Animaciones locales más largas acumulaban retraso y activaban el descarte de efectos atrasados.

## Corrección

Los consumidores con timeline compartida avanzan por las horas de servidor. El reloj de presentación ordena la preparación del HUD y deja comenzar las Coins paralelas aunque lleguen en lotes distintos. Los efectos locales pendientes no bloquean los siguientes comandos. El cierre espera las tareas visuales con su timeout existente y comprueba la identidad del consumidor antes de desbloquear Planning. Los turnos sin timeline conservan su reproducción secuencial.

Se actualiza la URL de los módulos en el bootstrap real para invalidar versiones en caché. No cambia el esquema de Firebase ni requiere nuevas reglas.

## Pruebas

- `node tests/combat-shared-clock-smoke.mjs`: DM y seis clientes independientes, ocho intercambios, Coins en lotes distintos, hasta 210 ms de entrega, relojes desajustados y un efecto local de 2200 ms. Exige todos los comandos dentro de 150 ms del DM y el mismo estado final. La versión anterior falla con 300 ms en la segunda Coin del primer intercambio; la corrección pasa.
- `node tests/combat-playback-six-viewers-recovery-smoke.mjs`: errores visuales, pérdida de lotes, suscripción cancelada, reintentos y recuperación final.
- `node tests/combat-playback-catchup-smoke.mjs`: atraso real de transporte y aplicación de estados al recuperar conexión.
- `node tests/combat-presentation-transport-smoke.mjs`: publicación incremental, confirmaciones no bloqueantes, barreras durables y duplicados.
- `npm run check:combat-live`: verifica el empaquetado existente.
- `node tests/combat-six-browser-deadlines.mjs`: siete contextos Chromium, fábrica de presentación y motor Coin extraídos de la fuente de producción, encoder/consumidor/reloj reales, entrega simulada y Coins separadas. Seis viewports: 360×800, 390×844, 844×390, 768×1024, 1280×720 y 1920×1080. Exige todos los comandos en orden, máximo 400 ms respecto al DM, DOM real y HP final idéntico. Guarda capturas y métricas como artefactos del workflow.

## Límites de aceptación

La prueba Chromium es una integración aislada del renderizador, con HUD espacial simplificado y transporte simulado. No constituye una sesión autenticada contra Firebase, una prueba de carga del servidor ni una certificación del Battle Viewer completo. La reproducción local del fallo y las cuatro suites Node pasan. Chromium no estaba instalado en el entorno de trabajo y la descarga estándar falló; su ejecución queda a CI salvo que se documente una ejecución posterior. La sesión real DM + seis jugadores sobre las reglas desplegadas sigue siendo la aceptación de producción. No se garantiza simultaneidad durante una desconexión, suspensión de pestañas o bloqueo del dispositivo.
