# Director según el prototipo aprobado

Referencia obligatoria: `Limbus_Teatro_Musica_Cast_Canonico_PROTOTIPO.html`.
SHA-256 del archivo recibido: `25c24d86576228c7375453991903860933c47e5ddca1e172fd5195f8633ee025`.

La estructura principal y las reglas visuales de Teatro y Audio se extrajeron de los dos srcdoc del archivo. Viven en `director-prototype-templates.js` y `director-prototype-{theatre,audio}.css`. Las reglas están acotadas a los diálogos para no modificar el visor ni las páginas de jugadores. No se ejecutan los scripts de demostración ni se copian personajes, canciones sintetizadas, imágenes incrustadas o escenas de muestra.

## Teatro

- Cabecera Actores → Escribir → Escena; columnas de personajes jugadores/NPC, escena y registro, y herramientas. En móvil: Elenco / Registro / Dirección, con el diseño de la referencia.
- Las tarjetas abren el compositor independiente con retrato. El formulario original conserva sus listeners, expresión, idioma y cola de publicación. Acción utiliza el tipo canónico actuar.
- Gestionar elenco abre En escena / Biblioteca. Se conservan los controles reales para añadir, mostrar/ocultar y retirar sin eliminar del catálogo, además del editor de personajes.
- Fondo y título/lugar abren los controles existentes de escenarios. Las notas son locales al dispositivo y encuentro, claramente indicadas. Exportar descarga el registro visible; Limpiar registro pide confirmación y afecta únicamente al log del encuentro.
- Cerrar Director, Ver escena y Escape vuelven al visor. El diálogo queda fuera del details original, se oculta mediante su ciclo nativo y el escenario original vuelve a su sitio. No hay un segundo renderer ni copia de los IDs del escenario.

## Audio

Misma cabecera Música / Efectos / Mis archivos, biblioteca lateral, catálogo, mezclador y reproductor inferior de la referencia. El contenido procede del catálogo registrado y R2. Favoritos y mezcla son locales; reproducir, pausa, pista anterior/siguiente, repetición y posición se comparten mediante la sesión existente. La subida sigue usando el Worker privado y sus permisos, con el límite de 25 MiB. No cambian las claves del servicio ni se necesita volver a desplegar el Worker por este PR.

## Comprobaciones

Correcciones de revisión: el transporte inferior reanuda el ID compartido, incluso tras recargar con una canción R2 pausada; una pista completada sin repetición reinicia su posición; los controles de parada publican una señal `cue` de acción `stop` y detienen ambiente y efectos puntuales en los clientes. Esta señal requiere desplegar las reglas RTDB actualizadas de este PR en campaña global y encuentros aislados. No se desplegaron desde esta tarea. Los participantes deben cargar la versión nueva del cliente para atender la señal de parada.

Prueba DOM específica: `node tests/director-prototype-dom-smoke.mjs`. Comprueba estructura de referencia, separación de jugadores y NPC con datos reales del fixture, apertura/cierre/cancelación/reapertura, vuelta al visor con un único escenario, publicación única, Acción y controles de audio/R2. Se mantienen las regresiones de actores retirados, IDs asignados, catálogo R2, firmas, permisos y reloj compartido.

Prueba visual y funcional: `npx playwright test tests/dm-theatre-director-workspace.spec.mjs --workers=1`. Cubre 360×800, 390×844, 844×390, 768×1024, 1280×720 y 1920×1080. Guarda capturas de elenco, registro, compositor, música y archivos; verifica que el cierre esté dentro del viewport y reciba el clic, y recorre los controles reales.

Limitación del entorno local: Chromium termina con SIGTRAP incluso con una página mínima; la descarga estándar del navegador tampoco entrega un archivo válido. No se afirma validación visual local ni equivalencia píxel a píxel. La matriz se entrega para ejecutarse en GitHub Actions y revisar sus capturas antes del merge. El PR se entrega en borrador por esta comprobación pendiente. No se publica ni fusiona automáticamente.
