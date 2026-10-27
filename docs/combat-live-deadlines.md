# Sincronización de presentación: revisión previa al merge

## Fallos corregidos

El consumidor esperaba cada animación local antes de avanzar, aunque existía un reloj compartido. Las Coins de un mismo intercambio se serializaban al llegar en lotes separados. La primera corrección eliminó esa espera acumulativa.

La opción de cambiar la velocidad se eliminó por petición del usuario. El combate tiene un único ritmo fijo: no existe selector, preferencia de velocidad, multiplicador de animaciones/sonido/CSS ni velocidad publicada en los turnos. Las preferencias antiguas del navegador y los metadatos de turnos anteriores no pueden acelerar o ralentizar la presentación. Sonido, volumen y calidad de efectos siguen siendo preferencias independientes.

Cada presentación también lleva una fase. Ambas Coins comparten fase; al avanzar se cancelan las esperas de la anterior. La presentación de producción propaga ese contexto por sus movimientos, pausas y callbacks de Coins, impidiendo cambios tardíos del HUD. La desconexión y el timeout cancelan esos contextos. No cambia resultados, RNG ni costes del combate.

El bootstrap aplica el cache-busting de Steps, playback, sync, audiovisual y su CSS después de todas las reescrituras antiguas. La fuente y los trece shards de combate conservan su verificación de integridad.

## Comparación y evidencia

La prueba inicial falló al exigir el mismo orden de arranque entre dos Coins simultáneas. Ahora cada cue se compara por identidad de evento, actor, fase y deadline. Permite invertir únicamente el orden entre actores dentro de una misma fase; mantiene el orden de cada actor y rechaza pérdidas, duplicados, fases cruzadas y desfases de más de 400 ms.

El estado terminal de la fixture se aplica primero al DM y se compara con él en los seis visores. Antes solo se contrastaban los jugadores entre sí. Los datos crudos se guardan antes de las aserciones para conservar evidencia aun cuando falle una comprobación.

## Validación

Pasan localmente:
- `combat-presentation-assertions-smoke.mjs`: Coins paralelas y casos negativos.
- `combat-presentation-phase-cancellation-smoke.mjs`: fábrica de presentación y derrota de Clash de producción, tiempos fijos aun con preferencias/metadatos antiguos de velocidad, sealer sin opciones de velocidad, cancelación antes de impacto/HUD y al cerrar y Coins paralelas.
- `combat-shared-clock-smoke.mjs`: DM y seis VMs, lotes separados, hasta 210 ms de entrega y un visual local de 2200 ms.
- `combat-playback-six-viewers-recovery-smoke.mjs`, `combat-playback-catchup-smoke.mjs` y `combat-presentation-transport-smoke.mjs`.
- Sintaxis de módulos y scripts inline; `node scripts/build-combat-live.mjs --check`.

El workflow prepara tres ejecuciones Chromium con transporte retardado y una con **siete cuentas Auth, SDK Firebase en cada navegador, RTDB Emulator y las reglas de producción del repositorio**. Comprueba también que los jugadores no puedan publicar resultados del DM. El modo Emulator exige hosts de loopback; no se conecta a la campaña real.

Comando Emulator:
```sh
COMBAT_FIREBASE_EMULATOR=1 npx firebase emulators:exec --project demo-combat-results --only auth,database --config combat-results-firebase.json 'node tests/combat-six-browser-deadlines.mjs'
```

Viewports: 360×800, 390×844, 844×390, 768×1024, 1280×720 y 1920×1080. Se monta el panel de opciones de producción y se comprueba que no exista el selector de velocidad, que sus tres controles restantes sean accesibles y que el panel quepa en cada viewport. Artefactos: capturas, resultados crudos y métricas.

## Puerta de merge

La ejecución anterior del commit e047027 pasó en su segundo intento con 97 ms de desfase, pero no valida esta revisión. **Las nuevas ejecuciones Chromium/Emulator quedan pendientes de CI; no se declaran aprobadas.** El contenedor local carece de un Chromium ejecutable y de un Java funcional.

Esta integración usa el renderizador real de Coins y la fábrica de presentación, con HUD espacial reducido y estado terminal inyectado. El transporte Emulator usa autenticación y reglas reales locales, pero **no es una aceptación del Battle Viewer completo, de las reglas desplegadas ni de una campaña real**. Esa aceptación completa sigue pendiente. Mantener el PR como borrador, sin merge, hasta completar la revisión y la validación requerida.
