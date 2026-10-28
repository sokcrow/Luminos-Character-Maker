# Director de Teatro: integración del menú

El botón Director abre la superficie completa. En escritorio, elenco a la
izquierda, escenario y registro al centro, acciones a la derecha. En móvil y
tablet se navega por Elenco, Escena y Acciones. Biblioteca, Escenas y Ajustes
conservan los controles reales; el compositor y Actor Studio son contextuales.

## Contratos conservados

- Biblioteca persistente, instancias de escena y sprites visibles son distintos.
- Añadir no muestra; ocultar no elimina; retirar conserva biblioteca e historial.
- Las rutas de escena y registro proceden de `LuminousTheatreState.getPaths()`.
- El escenario se mueve al abrir/cerrar, sin clonarlo ni crear otro renderer.
- El registro usa la suscripción existente de `theatre-intervention-ux-core.js`
  y sus reglas de presentación e iconos maestros. No añade una suscripción al log.
- El pergamino tiene máscara heptagonal con punta abajo; las imágenes no giran.
- El compositor conserva su handler y la cola original. Retirar invalida la
  composición abierta y las intervenciones pendientes antes de publicarse.
- La visibilidad se actualiza en una transacción que verifica la existencia de
  la instancia; preparar/revelar expresiones no puede recrear un actor retirado.
- El sexto visible desplaza al más antiguo conservando todas las instancias.
- Music Director reutiliza el runtime del PR #1048: véase audio-director.md.

## Validación y límites

Ejecutadas: sintaxis JS, diff sin errores, pruebas de workspace/Studio, envío,
compositor, cola, render móvil jugador, audio, reglas aisladas y la integración
DOM con Firebase en memoria. Esta última monta los módulos reales y comprueba
Mostrar/Ocultar, envío único, registro canónico, play/pausa, retirada, rechazo de
escrituras, 55 registros con nombres iguales y desplazamiento del sexto visible.
Los registros de prueba sólo existen en el fixture de pruebas.

La suite Playwright monta los mismos módulos en 360×800, 390×844, 844×390,
768×1024, 1280×720 y 1920×1080; captura Teatro y Music Director. El workflow
publica las capturas y trazas como artefactos. **No se completó localmente:**
Chromium y headless shell terminaron con SIGTRAP al arrancar, incluso en una
página vacía. No hay capturas locales aprobadas ni validación de layout afirmada.

Pendiente: completar esa matriz visual y la prueba multicliente autenticada
contra el emulador/entorno de pruebas Firebase, incluyendo reconexión y permisos
reales. No se desplegaron reglas ni se fusionó el PR. Los tests en memoria no
sustituyen esas verificaciones; el PR debe permanecer en borrador hasta resolverlas.
