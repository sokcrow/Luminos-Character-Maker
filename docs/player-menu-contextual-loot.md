# Menú del jugador y Botín contextual

Botín sale de la hamburguesa. El aviso sólo aparece con recuperaciones disponibles o pendientes, conserva el panel de saqueo y utiliza el ícono existente de harvest_kit.

El área contextual prueba cuatro esquinas dentro del viewport visual y las safe areas, reserva separación respecto a los controles detectados y se oculta mientras hay menús, terminal o ventanas abiertas. Si ninguna posición cabe, se oculta hasta que se libere espacio. Los nuevos HUD pueden registrarse como obstáculos mediante data-player-dock-obstacle.

Celular conserva Banco, Misiones, Mapa, Mail y Ajustes. Partes se retira del inicio. Perfil muestra retrato, nombre y el botón existente para cerrar sesión. Sus enlaces de datos antiguos permanecen ocultos e inertes para conservar la compatibilidad de otros módulos.

Notas permite crear, buscar, editar y eliminar notas con título, subtítulo y hasta 20 secciones. Guarda por personaje en notebookNotes, verifica la sesión antes de escribir y conserva un borrador local de cambios sin guardar separado por cuenta y personaje. Un fallo de guardado no elimina el borrador.

Codex conserva su contenido y navegación, pero pasa a Reglas, un acceso de la hamburguesa que abre una ventana propia con teclado y retorno de foco. No se reescriben sus reglas en esta entrega.

Apego, Historial y las mecánicas de Compendio no se rediseñan. Compendio se mantiene junto a los accesos del personaje y deja de usar Botín como ancla de inserción.

## Descripción del futuro ícono de Compendio

Libro abierto con una silueta de criatura al centro; contorno claro, lectura a 40 px y estética del registro de botones de Limbus. Acentos de latón/ámbar sobre fondo transparente. Debe diferenciarse del libro de hechizos y del historial: sin varita, destellos mágicos ni reloj. No se genera ni registra un recurso provisional. El botón actual conserva su etiqueta hasta aprobar el diseño del Compendio.

## Validación

Pasaron localmente:

- node tests/player-contextual-dock-smoke.mjs: colocación y separación, ventanas abiertas, ausencia de botín y ausencia de espacio en los seis tamaños TX-01 mediante simulación geométrica.
- node tests/player-notebook-persistence-smoke.mjs: persistencia por personaje, secciones, fallo de conexión, borrador, verificación de propietario y reintento.
- node tests/player-postcombat-loot-auth-smoke.mjs.
- node tests/player-notification-badge-smoke.mjs.
- Comprobación de sintaxis de los scripts modificados y git diff --check.

Las pruebas son temporales y se conservan sólo en el espacio de trabajo, conforme a la política del README.

Pendiente antes de considerar completa TX-01: ejecución del escenario de navegador player-notebook-contextual-dock.spec.mjs en Chromium y comprobación visual del flujo real con Firebase y recursos canónicos. El intento local de Playwright quedó bloqueado porque no existe el ejecutable de Chromium. Las pruebas simuladas no sustituyen esta validación. El PR se entrega en borrador.

## Corrección de acceso desde combate (#1073)

Se carga player-contextual-dock.js antes de player-postcombat-loot.js también en combate.html. Las tres entradas que consumen Botín (hoja_personaje.html, combate.html y mirror.html) comparten la misma dependencia y versión. El aviso reconoce el menú Encuentro abierto y los diálogos nativos de finalización; reserva separación respecto a las barras de Combate y Mirror. Al cerrar esos controles vuelve a comprobar la disponibilidad sin recargar la página.

La comprobación temporal de dependencias y orden en las tres entradas, autenticación de Botín y simulación geométrica en los seis tamaños TX-01 pasan. Sigue pendiente la validación visual real descrita arriba; no se declara completada por estas pruebas.
