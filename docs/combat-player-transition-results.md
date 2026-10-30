# Bloqueos del jugador entre duelos y turnos — 2026-10-29

## Hallazgo y corrección

La prueba usa **un DM y un jugador en navegadores separados**, Firebase Auth/RTDB emulados, `combate.html` para el DM y **la hoja completa `hoja_personaje.html` con su iframe real** para el jugador. Cada turno encadena dos duelos: dos Slots del jugador contra dos NPCs. Se ejercitan las monedas, intercambios de Clash, cierre de duelo, siguiente duelo y vuelta a planificación sin recargar.

Los picos aparecen en callbacks de Firebase de la **hoja padre**, después de `clashEnd`. Cambios separados de `sp` y `combatStats` despachan `luminous:player-data`; Traits vuelve a emitir `luminous:traits-refreshed`. Ambos eventos reconstruían desgloses/tooltips de Stats aunque el modal estuviera cerrado detrás del combate. En la prueba móvil, 20 entregas de datos hicieron ejecutar repetidamente esos consumidores:

- `player-trait-runtime.js`: 8.520 ms acumulados, incluyendo consumidores síncronos de `traits-refreshed`.
- `skill-trait-breakdown-patch.js`: 7.933 ms acumulados entre ambos eventos.
- `player-stat-tooltip-runtime.js`: 6.792 ms acumulados entre ambos eventos.

Estos tiempos **se solapan** por llamadas anidadas; no deben sumarse como tiempo total.

`player-stats-paint.js` conserva una sola solicitud pendiente por panel mientras Stats está cerrado y agrupa solicitudes en un microtask cuando está visible. Observar únicamente los atributos del modal permite pintar los datos actuales al abrirlo, sin observar todo el documento ni añadir polling. Se difiere la pintura del tray de Traits y de sus desgloses/tooltips. El personaje, las resoluciones de Traits y sus eventos siguen actualizándose inmediatamente. Las APIs de cálculo y la autoridad del combate no se modifican. Los contextos que no cargan el coordinador conservan su comportamiento previo.

## Comparación local

Base: `80643d7` de `main`. Dos turnos completos por ejecución, cuatro duelos por ejecución. Ambos roles conservan animaciones completas y el mismo RNG/planes. El equipo de prueba utiliza Chromium Headless 119.0.6045.0, SwiftShader y dos procesos separados. El Chromium 151 disponible mediante Playwright no arrancó en este entorno; se utilizó la alternativa 119 que sí ejecutó las páginas.

| Medida del jugador | Desktop antes | Desktop después | Móvil antes | Móvil después |
| --- | ---: | ---: | ---: | ---: |
| Viewport | 1280×720 | 1280×720 | 390×844 | 390×844 |
| Limitación de CPU por CDP | 1× | 1× | 4× | 4× |
| Mayor intervalo RAF | 633,3 ms | 150,0 ms | 3.233,2 ms | 333,3 ms |
| Mayor tarea larga de JS | 575 ms | 84 ms | 3.102 ms | 217 ms |
| Mayor espera de envío de puntero | 529 ms | 127 ms | 3.079 ms | 311 ms |
| Muestras RAF | 3.415 | 3.552 | 3.206 | 3.782 |
| Cues presentados / enviados por el DM | 204/204 | 204/204 | 192/204 | 204/204 |
| Errores de página | 0 | 0 | 0 | 0 |

La prueba móvil anterior falla el límite de respuesta de entrada de 1.000 ms. Ambas ejecuciones posteriores lo pasan. El P95 de intervalos RAF móviles permanece en 33,33 ms; el P99 pasa de 133,33 a 66,66 ms. **No demuestra 60 FPS sostenidos.** El envío de puntero mide el tiempo hasta el acuse de la entrada por el navegador, no la latencia física de un ratón/pantalla.

### Igualdad del combate

- Los 204 cues autoritativos de cada comparación son iguales por turno, secuencia, tipo, participantes, Coin y resultado.
- Los resúmenes de unidades completos (HP, SP, estados, estados pendientes, escudos y estado vital) son idénticos antes/después en ambos turnos y coinciden con el checkpoint del DM.
- Los 192 cues que sí presentó el móvil anterior coinciden con los mismos cues posteriores. Antes se omitían 12 cues al quedar fuera de plazo por el bloqueo: 8 `powerCoin`, 3 `clashContact` y 1 `clashOutcome`. Después presenta los 204, sin duplicados. El parche no cambia la política existente de recuperación de reproducción.
- SHA-256 de los resúmenes canónicos móviles, serializados con claves ordenadas y sin espacios, antes y después: `63d588c42b34c849dca121521552c56b8b5282ab0fd948a87a8d59318b64efb0`.

## Reapertura y regresiones

Después del combate se vuelve a Teatro y se comprueba abrir/cerrar Stats con datos modificados mientras estaba cerrado. Fuerza 10 → 14 produce el tooltip actual «Mod actual: +2» al abrirlo en **360×800, 390×844, 844×390, 768×1024, 1280×720 y 1920×1080**. Capturas inspeccionadas. Se conserva el layout previo de Stats; no es un rediseño de su escala móvil ni una aprobación general de su usabilidad.

Pruebas locales aprobadas: coordinador con 1.000 solicitudes ocultas/visibles, reapertura con el último dato y teardown; rendimiento de pestañas Stats; editor y compatibilidad de Background; catch-up; recuperación de seis consumidores; agrupación del HUD; sintaxis; integridad del bundle y `git diff --check`.

El harness temporal utiliza el bootstrap de producción, animaciones activas, cuentas aisladas, instrumentación por cue y trazas Chromium. El muestreo RAF y los hooks se instalan **después** de `document.write` del visor y se exige un mínimo de 100 frames y transiciones realmente observadas; una ejecución vacía no pasa. La comparación usa el fixture canónico del benchmark con dos Slots, dos NPCs, tres Coins por Skill y HP altos para sostener rondas; utiliza un PNG existente del repositorio, sin modificar datos de campaña. Se quitaron el test y configuración temporales antes de la entrega, conforme al README. No se añaden dependencias ni workflows de pruebas.

SHA-256 de los registros móviles completos: antes `c42ae9b56d5c5f85dc11485075c655dc087ac5792428a60a26405d7e845a0b19`; después `e648d446040b5d8d4d940d67bc01983e8fb80ca1ca486862e03d929cac8e30c1`.

## Límite de la conclusión

Se reprodujo y corrigió una fuente de bloqueo del hilo del jugador **en las transiciones descritas**, con pausas locales de hasta 3,1 s. No se reprodujeron exactamente los 10–15 s del equipo del usuario. La limitación de CPU no representa un teléfono físico, la fixture no es su personaje completo y esta comparación es una ejecución local antes/después, no un estudio ABBA ni una garantía sobre producción, WAN o todas las GPU. No se despliega ni fusiona automáticamente. Queda pendiente confirmar la misma mejora con su sesión real tras integrar y cargar esta versión.
