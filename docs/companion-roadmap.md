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

## Batch A — Foundation

Primer commit:

- Entrada independiente `/companion/`.
- Shell móvil y navegación inferior.
- Detección de teléfono; escritorio recibe una pantalla de derivación.
- Manifest PWA, modo standalone y orientación vertical.
- Service worker limitado a recursos estáticos del shell.
- Slots explícitos para Inicio, Economía, Contratos, Stash y Perfil.
- Ningún listener de economía, contratos, inventario o combate.

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

El PR permanece en Draft durante todos los batches. No se marca Ready for review hasta completar integración funcional, revisión de reglas y pruebas en dispositivo real.
