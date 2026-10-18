# Fase 3: escenario por capas y formación inicial

Base: Fase 2, PR #988 (`28feb4c03d212f748131a44b9d70c106f518e314`). Esta entrega no fusiona ni despliega la aplicación o las reglas.

## Dirección

Campo plano con profundidad de presentación: horizonte industrial frío, fachadas, suelo con líneas de fuga y reflejos discretos, sombras de contacto y primer plano en los bordes. Los cuatro SVG son originales y locales; no se importan recursos de Project Moon ni el renderer de Archive. Forest y #933 pertenecen a otra iniciativa y no son dependencias.

Las capas lejanas siguen la cámara a diferentes ritmos. El suelo sigue exactamente la transformación del campo; los pies permanecen anclados a las coordenadas existentes. La escala de los sprites y el orden de superposición dependen de su profundidad y del desplazamiento visual durante ataques. El HUD mantiene su tamaño. El movimiento reducido elimina el paralaje diferencial y las transiciones de las capas.

## Flujo del DM

En la preparación del encuentro, «Colocar formación inicial» abre una selección de combatiente. El DM elige un nombre o toca un combatiente, toca el suelo y termina la colocación. Ratón y toque comparten el mismo flujo. Se conserva `x/y` en porcentajes del campo y `positionPinned:true`; Speed no reemplaza esa formación. El guardado utiliza la sesión Firebase existente y se ve en los Players, también después de recargar.

La formación inicial se coloca **antes de cualquier plan o READY y antes del primer sellado**. La operación no es movimiento de turno: no gasta recursos, no cambia alcance ni añade alturas, terreno difícil, cobertura o navegación. La colocación entre rondas y el movimiento táctico requerirán su contrato de reglas e interfaz. No se añaden decisiones automáticas para humanos.

La aplicación comprueba fase/planes/READY y una transacción conserva los demás campos del combatiente. Las reglas validan la operación nueva `stagePlacement`: límites del suelo, fase de preparación, ausencia de autoridad, planes y READY. Esto rechaza una colocación que compita con el sellado o con el READY de otra sesión. Solo el DM puede escribir combatientes. Las escrituras de checkpoints existentes conservan su compatibilidad.

## Integración

- `js/combat-v073-stage.js`: dirección de capas, profundidad, conversión inversa del punto de pantalla y formación inicial.
- `css/combat-v073-stage.css` y `assets/combat-stage/*.svg`: presentación compartida por el camino WebGL y el fallback DOM.
- Fuente editable: carga el adaptador, comunica cámara, aparición/cambio de formación y desplazamientos; regeneración mediante `npm run build:combat-live`.
- Se conserva el único canvas existente. Los fondos nuevos son DOM, debajo de sprites/VFX; el fondo externo anterior no se solicita en esta escena. El primer plano decorativo no recibe eventos.
- Blinded oculta todas las capas de escenario. Los permisos de información de combatientes permanecen en el runtime existente.
- Sin frames ni cámara enviados por Firebase; sin cambios en fórmulas, cola, costes o RNG. No se cambia el protocolo de reproducción de Fase 2.

## Validación y límites

`test:combat-phase3` verifica conversión entre tamaños/traslaciones de viewport, orden por profundidad, transformaciones de cámara y movimiento reducido, límites de colocación y conservación de vitales. La suite Auth/RTDB añade escrituras reales del DM y denegaciones por Player, READY, sellado y coordenadas fuera del suelo.

Dos escenarios adicionales de Playwright usan el botón real del DM, selección y clic en el suelo, comprobación desde Player, recarga, assets locales decodificados y capturas de escritorio, vertical y horizontal. También comprueban el fallback del renderer. Las seis regresiones online anteriores siguen ejecutándose.

Las capturas utilizan sprites de prueba. No certifican arte final de personajes ni todos los menús móviles. El acabado del HUD, las poses por Skill, la certificación completa de Spells/objetos/reacciones y la medición de FPS en dispositivos de referencia siguen siendo entregas posteriores. Una calle industrial es la primera escena; cambiar escenarios desde un selector del DM aún no forma parte de esta entrega.
