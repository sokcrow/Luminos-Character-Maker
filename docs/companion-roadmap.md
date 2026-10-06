# Limbus Companion — roadmap de integración

## Objetivo

Limbus Companion es una superficie exclusiva para teléfono conectada al mismo Firebase de Limbus. No es una versión responsive de la ficha ni del Battle Viewer.

La PC conserva el runtime de juego. El Companion concentra servicios personales y administrativos compatibles con móvil.

## Límites funcionales acordados

- Combate, mapa, targeting, timeline y runtime pesado: solo PC.
- Inventario activo, equipamiento, consumo y movimiento de objetos: no pertenecen al Companion.
- Stash: visible desde Companion en modo de consulta solamente.
- Firebase Auth y Realtime Database siguen siendo la fuente compartida de identidad/estado.
- La restricción de teléfono es una decisión de UX, no una regla de seguridad de Firebase.
- En teléfono, Companion se diseña para pantalla completa y orientación horizontal.
- Si el navegador no permite forzar fullscreen/orientación, la UI pide al usuario girar el dispositivo en lugar de comprimir la interfaz en portrait.

## Batch A — Foundation

Incluido:

- Entrada independiente `/companion/`.
- Shell móvil y navegación propia.
- Detección de teléfono; escritorio recibe una pantalla de derivación.
- Manifest PWA con `display: fullscreen` y orientación `landscape`.
- Entrada táctil para solicitar Fullscreen API y Orientation Lock cuando el navegador los soporta.
- Gate de orientación: el Companion no renderiza su interfaz principal comprimida en portrait.
- Layout horizontal que utiliza el ancho completo del teléfono y respeta safe areas.
- Service worker limitado a recursos estáticos del shell.
- Slots explícitos para Inicio, Economía, Contratos, Stash y Perfil.
- Ningún listener de economía, contratos, inventario o combate.
- Botón **Celular** en la hoja del jugador que abre el Companion a pantalla completa.
- Modo `surface=desktop` para reutilizar exactamente el mismo Companion dentro de la superficie fullscreen de escritorio.
- El botón **Terminal** legacy permanece temporalmente durante la migración.

Sub-batch A.1 pendiente:

- Centralizar la configuración Firebase existente sin duplicarla.
- Sesión Firebase usando el proyecto actual.
- Resolución UID -> jugador aprobado.
- Inicio y cierre de sesión dentro del Companion.

Este scaffold no requiere cambios en `database.rules.json`.

## Batch B — Datos de solo lectura

- Dashboard con resumen personal.
- Saldo y movimientos económicos en lectura.
- Contratos del jugador.
- Stash en lectura solamente.
- Montaje/desmontaje de listeners por vista para evitar listeners huérfanos.

Si este batch descubre que una lectura debe restringirse más por usuario, el cambio de reglas se entregará separado para revisión manual antes de desplegarse.

## Batch C — Seguridad y operaciones

- Endurecimiento de permisos económicos.
- Operaciones autoritativas para transacciones que modifiquen saldo.
- Reconexión/errores/offline.
- Notificaciones/presencia cuando la base esté estable.
- Pruebas simultáneas teléfono + PC.

## Regla de integración

Esta foundation puede integrarse a `main` como base estable. Firebase/Auth, datos reales y seguridad continúan en PRs posteriores, evitando mantener una rama de foundation abierta durante toda la migración.
