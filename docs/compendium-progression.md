# Progresión personal de observación y ramas

## Reglas implementadas

| Nivel | Daño directo | Elecciones totales |
| --- | ---: | ---: |
| 0 | 0% | 0 |
| 1 | +3% | 1 |
| 2 | +6% | 2 |
| 3 | +9% | 3 |
| 4 | +12% | 4 |
| 5 | +15% | 5 |

Cada elección corresponde a un nivel ganado y añade 10% a Materiales, Dinero o probabilidad de mejorar un objeto. Se pueden repartir las cinco elecciones. Los niveles de daño son automáticos y no consumen elecciones. Las elecciones son inmutables y se guardan por jugador y definición canónica de criatura; no por instancia de enemigo. No se añaden reducciones de TH.

Se conservan los siete hechos de Analyse: HP, SP, velocidad, acción, objetivo, resistencias y equipo. Se incorpora el nivel cero al cálculo previo: 0 hechos → 0; 1 → 1; 2–3 → 2; 4–5 → 3; 6 → 4; 7 → 5. Repetir un hecho no concede progreso. Se mantienen los modificadores, tiradas y límite gratuito de una vez por turno. El Compendio consulta el hecho concreto; el nivel numérico no revela otros datos.

## Persistencia y autoridad

`campaña/compendium_progress/{playerId}/units/{unitId}` guarda los hechos, nivel efectivo, base de ranger y elecciones. Es una capa de progreso del mismo Compendio que ya conserva las fichas de conocimiento bajo el jugador. Se usa un nodo separado porque la regla heredada permite al propietario escribir su ficha completa; esa regla no debe permitir inventar niveles con recompensas.

El DM confirma las observaciones. El propietario sólo puede añadir una elección válida a una casilla ganada, sin editar nivel, hechos, otras fichas ni elecciones anteriores. Calidad exige además una tabla de mejora publicada en la Unit. Se incluyen reglas equivalentes en el estado de encuentros separados.

La resolución de Analyse deja una entrega pendiente en el recibo autoritativo. Primero confirma el combate, luego persiste el hecho y finalmente confirma el recibo. Un reintento tras desconexión es idempotente. READY espera esa confirmación, igual que las entregas pendientes de objetos. No se utiliza localStorage como fuente de niveles en una sesión online.

Las criaturas vistas se registran en nivel cero. No se registran automáticamente reservas, criaturas escapadas ni invisibles que el actor no ha detectado. La ficha sigue mostrando los descubrimientos individuales; una observación ajena no sube tu progreso persistente. Se conserva la información global de combate antigua para compatibilidad, pero los controles personales consultan tu registro.

## Daño

El multiplicador se aplica a cada impacto directo de Skills y Spells, también impactos directos de daño fijo. El daño periódico, los efectos ambientales y riders identificados como estados no reciben una segunda aplicación. Afecta a objetivos enemigos con identidad canónica. No concede poder de Clash ni modifica la probabilidad de acierto.

Al sellar una ronda, la autoridad fija el porcentaje por jugador/criatura dentro del payload. La resolución y la reproducción utilizan ese mismo snapshot, evitando depender del momento en que llegue una actualización de progreso. Los paquetes del combate se regeneran desde la fuente y se comprueba su manifiesto.

## Recuperación corporal

Cada punto aumenta en 10% el rendimiento de una recuperación exitosa, hasta 50%. El bono se fija en el primer intento corporal de ese jugador en ese cadáver. Las fracciones se resuelven mediante una decisión determinista por cadáver/jugador/acción, conservando el rendimiento esperado sin generar unidades fraccionarias ni permitir repetir una tirada para cambiar el resultado.

El resultado siempre se descuenta de la misma reserva compartida de materiales intactos. No puede superar lo que queda, regenerar una parte destruida ni duplicar un órgano único. Los fallos no conceden materiales y se mantienen las restricciones anatómicas y de intentos existentes. Es una mejora de rendimiento por acción, no una multiplicación ilimitada de toda la capacidad del cadáver.

## Dinero y objetos valiosos

Antes de desplegar nuevos NPCs se fija un snapshot de las mejoras de los miembros del grupo presentes en la preparación. Como el cadáver tiene un único inventario, se utiliza el mejor bono elegible de cada rama entre esos participantes, sin sumar porcentajes de varios jugadores.

Dinero aumenta la cantidad generada hasta 50%; cero sigue siendo cero y los importes fijos explícitos del perfil no se modifican. Una vez desplegado el NPC no se vuelve a generar por cambios de elección, reconexiones, nuevas observaciones o reapertura del cadáver.

Calidad es una probabilidad de mejorar un objeto generado elegible, con estos requisitos:

- Debe existir un par explícito `lootProfile.observationUpgrades` con `fromItemId` y `toItemId`.
- La definición de destino debe ser del tier inmediatamente superior y no superar `lootProfile.maxRewardTier`.
- No utiliza `qualityTier` ni sube varios tiers.
- No cambia armas o equipo ya existentes. La sustitución sucede antes del combate, por lo que un NPC puede consumir el consumible mejorado y éste dejará de estar disponible en sus restos.
- Un marcador persistente impide encadenar o repetir la mejora.

Se añade una tabla acotada a los cinco kobolds y dos goblins actuales: Pocket Recovery Patch (Tier I) → Rapid Recovery Gel (Tier II), ambos del catálogo real, con máximo Tier II. Se mantiene la probabilidad base de que el consumible se genere; la mejora se decide sólo si existe el objeto elegible. Las demás criaturas sin tabla válida muestran esa elección desactivada. Las ramas de dinero/materiales tampoco se ofrecen cuando no son aplicables al perfil.

## Ranger

Se reutiliza el matcher de Enemigo Predilecto del runtime de clase, incluido el subtipo cuando se elige Humanoide. El nivel efectivo es el máximo entre observación conseguida y base 3, nunca la suma. No se fabrican hechos de observación para representar esa base. Los beneficios originales de clase se conservan; el éxito automático de Analyse no concede inmunidad a Ceguera.

El combate y los dos accesos principales del DM mantienen las concesiones al cambiar personajes o biblioteca. Una nueva Unit de la categoría elegida recibe la base sin asignación manual. No se instala un servicio servidor nuevo: si no hay sesión autoritativa abierta, se sincroniza al abrir la siguiente sesión del DM. Los cambios de categoría retiran la base anterior, conservando los hechos realmente aprendidos y las elecciones guardadas; sólo cuentan las casillas cubiertas por el nivel efectivo actual.

## Interfaz entregada

El Compendio productivo existente muestra nivel 0–5, porcentajes, elecciones previas y botones para gastar mejoras pendientes. Se evita invertir en ramas sin perfil válido. Leerlo no consume una tirada. La descripción física de una criatura vista se puede consultar; Historia guarda el contexto narrativo por separado cuando existe. Las definiciones locales sirven de fallback de texto para Units del catálogo, respetando los campos ya escritos por el DM en la biblioteca.

El Bestiario visual del prototipo todavía no sustituye este menú. Su puente completo de Skills/Spells/Traits y la presentación final de ramas siguen pendientes.

## Activación y trabajo pendiente

1. Publicar las reglas nuevas **antes** de habilitar los clientes actualizados; sin ellas no se pueden confirmar el progreso ni las elecciones.
2. Actualizar de forma autorizada los metadatos de los siete humanoides en Firebase (`maxRewardTier` y pares de mejora), conservando los ajustes del DM. No se ejecuta una migración sobre la campaña desde esta entrega.
3. Completar las tablas de mejora de otros perfiles cuando corresponda. Las criaturas que sólo proporcionan materiales no necesitan una tabla de objetos.
4. Integrar esta progresión en el diseño final del Bestiario y completar los desbloqueos específicos de Skills, Spells, Traits y estudios de conocimiento.
5. Validación visual TX-01 y prueba integrada DM/jugadores con Firebase/emulador, reconexión y Mirror. No se considera terminada con las pruebas simuladas.

No se convierten automáticamente los antiguos flags compartidos de un enemigo en conocimiento personal: no identifican quién aprendió cada dato. Cualquier migración retrospectiva de esos registros necesita evidencia o decisión del DM.

## Validación local

Pruebas temporales aprobadas: niveles y límites; reparto/inmutabilidad; idempotencia e independencia entre jugadores; concesiones reales de Ranger y categorías nuevas; snapshots de daño; resolución real de daño para Coins/Spells/daño fijo y exclusión periódica; acción real de recuperación, conservación del pool e intentos; generación de dinero y mejora de exactamente un tier sin reroll; expresiones reales de reglas para dueño/terceros/DM/casillas inválidas; renderer real de ramas y consultas personales frente a flags compartidos; sintaxis y manifiesto del bundle. No se incorporan tests permanentes, conforme al README.

Los tests de reglas evalúan las expresiones con snapshots simulados, no sustituyen el emulador Firebase. La comprobación del renderer no es una validación de layout. No hay Chromium disponible en este entorno para completar la prueba visual.
