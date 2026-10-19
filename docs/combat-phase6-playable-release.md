# Fase 6: acceso y versión jugable integrada

La entrega reúne las Fases 0–5 sobre `main` y añade `combate.html`: acceso directo con la cuenta existente, administración del encuentro por el DM y participación de personajes vinculados. El visor sigue siendo `Battle-viewer.html`, el mismo que utilizan el Centro de Mando y las fichas. No hay una simulación paralela ni jugadores controlados por IA.

## Cómo usarla una vez publicada

1. Abre `combate.html` en el mismo sitio donde están las fichas. También hay enlaces desde el Centro de Mando y la pestaña Combate del panel del DM.
2. Entra con tu cuenta habitual. El DM puede **Abrir encuentro**; el jugador espera a que el DM active Combate. Una cuenta sin personaje vinculado recibe una indicación clara y no abre el visor.
3. En el visor del DM, abre **Encuentro**, añade personajes y enemigos de la biblioteca y coloca la formación inicial. Los jugadores entran automáticamente cuando se despliegan sus personajes.
4. Cada jugador elige habilidad y objetivo y marca **READY**. El DM resuelve; los jugadores reproducen sus resultados. El panel del DM debe permanecer abierto para resolver. Una recarga del DM durante la resolución requiere **Reanudar turno aquí**, como en la Fase 2.
5. Entre rondas, antes de elegir acciones, el DM puede seleccionar **Presentación sencilla** en el menú superior. Mantiene escena, HUD, reglas y checkpoints; suprime las animaciones dirigidas y los efectos audiovisuales adicionales para todos. **Completa** los reactiva respetando movimiento reducido. Es un retorno a presentación sencilla sobre el motor actual, no una carga del código histórico sin las correcciones online.
6. **Finalizar encuentro** permite elegir victoria, derrota o cancelación y conserva vitales y resultados. Durante una ronda sellada/en resolución, cierre, reapertura y cambio de presentación están bloqueados, al igual que añadir o quitar combatientes. El siguiente encuentro obtiene otra identidad y reinicia combatientes, reservas, salidas, planes, READY, autoridad y reproducción actuales; no borra fichas, inventario ni historial de botín. Reabrir un encuentro activo conserva su formación, vitales y visor, incluso si todavía necesita asignar su identidad.

El menú del encabezado está cerrado por defecto. La ficha del jugador y el panel completo del DM siguen accesibles desde ese menú. El cambio de presentación modifica únicamente preferencias visuales del encuentro; no cambia fórmulas ni permisos. Las operaciones se comprueban mediante transacciones contra el estado más reciente.

## Entrega publicable

`npm run package:combat-release` genera `artifacts/combat-release/` desde un checkout completo. No descarga recursos ni despliega nada. Incluye:

- `public/`: páginas, scripts, estilos, recursos existentes y todas las partes del runtime integrado; entrada `combate.html`.
- `release-manifest.json`: commit, hash del runtime y SHA-256 de cada archivo publicado.
- `database.rules.json`, `firebase.json` y `LEEME.txt`: reglas y procedimiento de publicación.

La validación temporal ejecuta el acceso nuevo sirviendo **ese directorio empaquetado**, con SDK de Firebase y Auth/RTDB emulados reales. Solo produce el artefacto `luminos-combat-playable-release` si pasan el recorrido de acceso, la conservación de un encuentro existente y las doce regresiones anteriores. Los nuevos harness y el workflow de validación se retiran de la entrega final según la política del README; la ejecución y sus artefactos conservan la evidencia.

La configuración incluida sigue apuntando a **luminous-system**, igual que las fichas existentes. No se crea ni se supone un Firebase de pruebas separado. Descargar o construir no modifica la campaña; abrirla autenticado y crear un encuentro sí utiliza el proyecto configurado. `js/combat-firebase-config.js` centraliza la configuración del acceso directo y del visor; las fichas históricas conservan sus configuraciones existentes. Si se prepara otro proyecto, deben cambiarse y verificarse también las configuraciones de esas fichas antes de usar sus enlaces.

Para una revisión local del paquete, desde su directorio:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory public
```

Abre `http://127.0.0.1:4173/combate.html`; usa HTTP, no `file://`. Para Firebase Hosting, el paquete contiene una configuración independiente. La publicación de reglas y hosting requiere una sesión de Firebase autorizada y se hace después de revisar la entrega. En otro hosting estático se publica `public/` completo y se actualizan las reglas por separado. Hay que servir todos los archivos de la misma entrega y evitar reutilizar en caché partes de otra versión.

## Evidencia y límites

- Contratos de Fases 0–6, integridad del bundle y regresiones previas.
- Navegador: inicio de sesión real mediante formulario, rechazo de contraseña incorrecta, creación desde un encuentro terminado con planes antiguos, despliegue desde biblioteca, DM y dos jugadores, dos rondas, presentación sencilla, bloqueo durante resolución, recarga, cierre, otro encuentro y salida de sesión.
- Capturas del acceso en móvil y del DM; estado final compartido, cero acciones de reglas ejecutadas por jugadores y cero peticiones a Firebase de producción en CI.

Esta evidencia no equivale a una publicación ni a una partida humana. Después de publicar, queda una aceptación breve con cuentas y dispositivos reales: permisos del proyecto desplegado, recursos externos de los personajes, pérdida de red, audio móvil y legibilidad en los teléfonos del grupo. Los sprites individuales y todo el catálogo de perfiles artísticos no son un requisito para el primer piloto.

## Resultado de la validación

[CI del producto integrado](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/39180398710), revisión `df20b044`: **14 casos de navegador aprobados** (dos del acceso y ciclo de encuentro, doce regresiones previas), además de los contratos de Fases 0–6. El artefacto [luminos-combat-playable-release](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/39180398710/artifacts/12156645429) contiene la versión publicable. Las capturas de DM y móvil se revisaron visualmente. El recorrido nuevo terminó dos rondas con los mismos vitales en DM y jugadores, sin errores de página ni solicitudes a Firebase de producción.

Se actualizó también el simulador de lectura de Firebase de la prueba de reacción de objetos encantados para el guardado seguro de READY al ganar Action Slots. Las **75 comprobaciones de inventario** ejecutables con Node pasan localmente. Esta corrección afecta únicamente a la prueba; no altera los archivos publicados del juego.

La última limpieza retira los 27 archivos nuevos de validación y los comandos temporales del paquete. Mantiene las pruebas que ya existían en `main`, actualizadas donde cambió su contrato. Las referencias de fases anteriores se conservan como historial de implementación. Los archivos del producto y las reglas son los mismos que en la ejecución integrada; publicación y aceptación humana siguen pendientes.
