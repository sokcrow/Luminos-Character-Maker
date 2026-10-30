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


## Correcciones de revisión P1/P2

Los IDs persistentes del compositor de jugador pueden publicar sin una instancia
DM en escena. El motor resuelve por ID exacto en actores/base_datos_npcs y no
crea una instancia ni un sprite huérfano. Las entradas nuevas de la cola llevan
un actorScope opcional: scene impide que una instancia retirada se resuelva como
otra identidad del catálogo; assigned conserva el flujo del jugador. Las entradas
directas antiguas sin ese campo siguen siendo compatibles. No requiere migración.

Cambiar explícitamente de hablante actualiza el personaje vigilado y permite
recuperarse de una retirada. La reconstrucción automática del selector lleva una
marca de evento para que su fallback a Narrador no cambie silenciosamente el
hablante de una composición invalidada.

Regresiones DOM ejecutadas: asignados de ambas fuentes sin elenco, ID distinto de
la instancia del DM, cola directa jugador hasta publicación y archivo únicos,
instancia retirada con un ID coincidente en catálogo, selección A→B y retirada de
A/B, y recuperación explícita como Narrador. La regresión del selector también
se incluye en los seis tamaños de la suite Playwright; su ejecución visual local
continúa pendiente por el problema de arranque de Chromium ya documentado.
