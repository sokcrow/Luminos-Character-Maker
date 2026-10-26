# Fase 5: perfiles audiovisuales conectados

> Validación histórica: los nuevos harness de las Fases 0–6 fueron temporales y se retiraron al cerrar la entrega, según el README. Los comandos de prueba de este documento describen esa revisión; la evidencia queda en la [ejecución integrada](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/39180398710).

Esta entrega continúa sobre #990 (`d2fa930bb1fe5037de2623848b03f9cfd3e1f961`) e incluye toda la cadena de Fases 0–4. No fusiona ni despliega esa cadena.

## Experiencia

El combate conserva el menú radial, el HUD, la formación y las decisiones humanas. Las Skills generan trazos de corte, perforación o golpe; los ataques a distancia muestran un proyectil entre los sprites visibles. Fire Bolt, Ray of Frost, Eldritch Blast y Sacred Flame tienen perfiles específicos. Magic Missile y las curaciones conocidas se enlazan con sus familias visuales. Una habilidad desconocida siempre conserva una presentación genérica. Los perfiles no modifican alcance, daño, defensa, costes ni selección de objetivos.

Los impactos se presentan después del resultado de reglas, con énfasis de cámara breve que mueve únicamente el campo y sus capas. El HUD permanece fijo. Los perfiles seleccionados muestran una banda breve con el nombre de la habilidad una vez por acción, sin tapar el centro del campo. Guard y Evade utilizan sus resultados existentes. Las curaciones y salvaciones tienen comandos de presentación propios; una salvación exitosa muestra resistencia/evasión en lugar de un impacto de daño.

«Opciones» contiene sonido, volumen, efectos completos/ligeros/desactivados y reproducción normal/rápida. Son preferencias de cada navegador, sin escritura a Firebase. La reproducción rápida acorta las esperas de presentación y Coins; no introduce otra simulación. Movimiento reducido conserva los resultados y el HUD sin efectos móviles no esenciales. Los efectos pueden desactivarse conservando el sonido.

## Contratos

- `combat-v073-animation-profiles.js` separa el manifiesto visual del catálogo de reglas. Selecciona por claves canónicas de habilidad, defensa, familia y alcance declarado.
- `combat-v073-audiovisual.js` consume cues del mismo journal que reproduce el Player. No usa RNG, calcula reglas, cambia coordenadas canónicas ni escribe a Firebase.
- Los eventos recibidos por sí solos no disparan efectos transitorios: la reproducción tardía, silenciosa o reconectada puede omitir cues sin repetir audio, proyectiles o cut-ins. Los cues nuevos son aditivos; un cliente previo continúa aplicando el estado del DM.
- Los efectos SVG son originales y viven en una capa DOM sin interacción. No se añade otro canvas, RAF permanente, descarga de red ni motor de partículas global.
- El sonido utiliza recetas originales de osciladores Web Audio. Solo se habilita tras interacción confiable. Un navegador sin audio, permiso de reproducción o contexto disponible termina la ronda normalmente.
- Hay límites de 14 nodos en calidad completa, 6 en ligera y 6 voces simultáneas. Los efectos se cancelan al cambiar de generación, terminar la ronda, hidratar, desconectar el consumidor, ocultar la pestaña o cambiar viewport. Las voces se desconectan al finalizar o silenciarse; el contexto se libera al cambiar de encuentro o cerrar el visor.
- Los participantes ocultos y Blinded no revelan nombres, ubicaciones, trayectorias ni sonidos mediante esta capa.

## Recursos y alcance

Esta V1 usa efectos vectoriales, perfiles, sonido sintetizado y los sprites existentes. No importa ni copia recursos de Project Moon o de Archive. Los dibujos y recetas de audio se crean en este repositorio. Los sprites de personaje sin atlas siguen usando las poses genéricas de Fase 4; no se afirma que existan animaciones de frames únicas para cada personaje ni perfiles artesanales para todo el catálogo. El registro visual de hechizos existente continúa siendo la autoridad de sus iconos y Units, sin reemplazarlos por VFX decorativos.

## Verificación

La matriz conserva Fases 0–4 y agrega pruebas de perfiles y sustituciones, privacidad, reducción de movimiento, texto seguro, límites/limpieza de nodos y voces, audio no disponible y equivalencia de reglas/RNG con distintas presentaciones. El recorrido de navegador usa el Fire Bolt canónico desde Spells con dos Players y DM, captura el proyectil/impacto y compara la ronda normal con reproducción rápida, efectos desactivados y audio no disponible. También conserva los recorridos de recarga, retraso, derrota y recuperación del DM.

Las pruebas de navegador usan Auth y RTDB locales, no Firebase de producción. El acabado artístico de cada personaje/Skill, las mediciones en dispositivos de referencia y la aceptación de una versión desplegada siguen siendo trabajo posterior; no se sustituyen por estas pruebas automatizadas.
