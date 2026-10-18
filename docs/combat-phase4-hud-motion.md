# Fase 4: HUD de producto y poses genéricas

Base integrada: #989, `db1fefa39f90fbe62392b15862e316df535c6c5c`, que contiene #986/#987/#988. Esta rama continúa sobre esa implementación completa; no fusiona ni despliega aplicación o reglas.

## Experiencia

El HUD muestra el personaje propio, HP/SP, Speed, Stagger, efectos actuales y selección de Action Slots. La información propia permanece en pantalla y respeta las restricciones existentes. El texto técnico del prototipo se sustituye por mensajes de fase comprensibles. El DM abre «Encuentro» cuando necesita preparar o administrar el combate; el panel comienza cerrado y la recuperación del DM sigue abriéndolo cuando necesita intervención.

En escritorio se conserva el menú radial. En pantallas estrechas o bajas se utiliza el mismo menú y sus mismos callbacks en una disposición compacta. Las categorías ajustan ancho/alto al viewport, los detalles desplazan su contenido y la confirmación permanece accesible. La elegibilidad de Spells y los servicios canónicos de objetos, economía y reacciones se conservan.

Al seleccionar un objetivo en móvil, una lista contextual ofrece los Action Slots que el runtime ya declaró válidos, con botones de al menos 44 px. Cada botón llama al selector de objetivos existente: no decide ni valida otra vez el resultado. La confirmación de Clash y su previsión siguen usando las reglas existentes.

Durante la resolución móvil, una lectura en pantalla muestra participantes, habilidad, potencia y Coins. Sustituye el HUD flotante pequeño para evitar depender del zoom del campo. En escritorio se conservan los HUD flotantes originales. Los participantes ocultos y Blinded no obtienen nombres o números adicionales a través de esta lectura.

## Animaciones y límites de reglas

`js/combat-v073-hud-motion.js` consume eventos y comandos de presentación. Las poses genéricas incluyen preparación/ataque, lanzamiento, golpe, Guard, Evade, Counter, Stagger y derrota. Utilizan desplazamiento y escala del sprite, compatibles con la composición WebGL existente y su fallback DOM. No son todavía atlas de frames ni animaciones específicas de cada personaje o Skill.

El módulo de pasos admite observadores opcionales y el cue `actionStart`, también publicado para acciones que no recorren la ruta normal de Coins. Un fallo del observador no cambia ni interrumpe la resolución. El journal conserva el orden de reglas; el cue adicional solo describe la presentación. Los Players reciben los eventos aceptados y reproducen los cues del DM; nunca ejecutan daño, costes o tiradas desde el HUD.

Las poses y el HUD no escriben Firebase ni consumen RNG. La posición inicial de Fase 3 continúa siendo canónica; el gesto de un golpe no mueve al combatiente en las reglas. La preferencia de movimiento reducido desactiva la presentación animada de pasos y elimina las transiciones no esenciales. Se conserva el feedback textual y el mismo estado final. Cada cliente puede usar esa preferencia de forma independiente.

## Validación

- Las pruebas de Fase 0–3 permanecen en la matriz.
- Fase 4 compara estado, RNG y journal con observador normal, ausente y fallido; comprueba reproducción de presentación sin mutaciones, privacidad y movimiento reducido.
- Navegador real con Auth/RTDB locales: menús y detalles, límites del viewport, selección táctil, confirmación, READY, lectura de Coins, animación genérica, regreso a planificación y mismos vitales entre DM y Players. Incluye la ruta real de Guard y la preferencia de movimiento reducido.
- Capturas de escritorio, vertical y horizontal, preparación y resolución. Se utilizan sprites de prueba.

La CI certifica la integración en una base aislada de Auth/Database, no una partida en Firebase de producción. No se entrega aquí una URL desplegada. Sigue pendiente el hito de versión integrada accesible para aceptación del usuario, junto con el acabado artístico, perfiles por Skill, la matriz completa de Spells/objetos/reacciones y las mediciones de rendimiento en dispositivos de referencia.
