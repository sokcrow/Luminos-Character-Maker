# Loot Corpse: contrato del HUD y motor canónico

La UI `js/player-postcombat-loot.js` utiliza `js/loot-live-postcombat-runtime.js`, `js/loot-postcombat-runtime.js`, `js/loot-check-runtime.js` y `js/item-inventory-runtime.js`. No genera botín de forma independiente.

## Flujo

1. El DM finaliza un encuentro como `victory` y el motor congela las Loot Instances. El menú del jugador solo aparece cuando hay restos de la victoria en la cola de `campaña/loot_encounters`.
2. El jugador selecciona un cadáver y solicita una reserva de `campaña/loot_claims/<lootInstanceId>` (una por cadáver). Solo el propietario puede interactuar. La reserva caduca a los 90 segundos y se renueva mientras la UI está abierta; al cerrar, cambiar o pulsar «Soltar cadáver», se libera.
3. El jugador elige **Buscar, Sustraer, Cosechar, Extraer, Desmontar, Examinar o Autopsia**. Los checks se animan en el cliente; la resolución autoritativa se recompone en el DM a partir del resultado de las monedas y del estado guardado.
4. **Buscar** revela las pertenencias y el dinero restante **para todos los jugadores** si tiene éxito. No entrega objetos, no acredita Ahn y no consume existencias. En **Cadáver** cada casilla ocupada sin revelar muestra **???**, sin nombre, icono, cantidad ni tooltip que filtre su contenido. Las casillas vacías no se simulan como botín oculto.
5. **Recoger** es una elección posterior, sin nueva tirada: el propietario de la reserva selecciona una instancia revelada o el dinero revelado. Se retira únicamente esa pila o ese dinero y se actualiza el inventario compartido. Los demás objetos permanecen para el siguiente jugador. La autoridad rechaza objetivos ocultos, inexistentes o agotados.
6. El apartado **Cuerpo** comienza oculto y solo muestra la lista de recursos disponibles/agotados tras un check exitoso de **Examinar** o **Autopsia**. Los recursos ya recuperados también se muestran al personaje que los obtuvo.
7. Lo obtenido se acredita en Active Inventory / Stash, Ahn y Compendium a través del runtime existente. Si no hay capacidad, se conserva una **entrega pendiente**, reclamable más tarde.
8. La cola se puede retirar desde la vista del DM; su cierre retira el acceso al menú.

## TH Check por competencia de Skill

Cada acción usa una Skill específica. Si el personaje carece de Proficiency completa en esa Skill, el TH/DC aumenta **+8**. `half` no elimina la penalización; `proficient` y `expertise` sí. La regla usa la Skill **realmente seleccionada** y no penaliza siempre por faltar Medicina.

| Acción | Skill utilizada (atributo) | DC base | Sin Proficiency |
| --- | --- | --- | --- |
| Buscar | Investigation (INT) | 10 | 18 |
| Sustraer | Sleight of Hand (DEX) | 10 | 18 |
| Cosechar | Survival (WIS) | 10 | 18 |
| Extraer | Medicine (WIS) | 12 | 20 |
| Desmontar | Arcana (INT) | 10 | 18 |
| Examinar | Investigation (INT) | 10 | 18 |
| Autopsia | Medicine (WIS) | 12 | 20 |

Autopsia puede admitir Investigation como skill alternativa cuando el motor reciba explícitamente esa opción; en tal caso se aplica la competencia de Investigation.

Los grants explícitos de conocimiento por clase o Trait pueden eximir el +8 en su acción pertinente. Por ejemplo:

```js
player.lootKnowledge = { anatomy: true }; // cosechar, extraer, autopsia
player.traits = [{ id: "anatomist", grants: { lootKnowledge: { autopsy: true, extract: true } } }];
player.classFeatures = [{ id: "arcane_scholar", lootKnowledge: { salvage: true } }];
```

Estos son ejemplos del contrato, no Trait/Clase otorgados automáticamente por nombre. Conocer Medicina **no elimina** el penalizador de Survival al Cosechar: solo una Proficiency en Survival o un grant de conocimiento autorizado lo elimina.

### Examinar frente a Autopsia

- **Examinar** no mueve ítems ni extrae órganos: por check de Investigation revela hechos para el Compendium sobre equipo observado, zona/eventos del encuentro, botín previamente identificado y rarezas plausibles. Puede identificar el nivel defensivo con un margen de éxito de al menos 10 si está disponible.
- **Autopsia**, por check de Medicine, registra biología (materiales, tamaño, anatomía), recursos recuperables, sustancias valiosas, usos conocidos y comestibilidad. Con gran margen de éxito puede registrar Constitución si ese dato existe.
- La vista del HUD permite abrir el panel de recursos corporales después de un Examinar o Autopsia exitosos. Es una regla de visualización; no significa que Examinar por sí mismo haya extraído nada ni que cree loot.

## Sprite y sustracción

El HUD muestra la **imagen del combatant derrotado** utilizando su campo canónico `combatSprite`, `sprite_combate`, `visual.spriteUrl` u otros campos visuales existentes. El sprite se guarda en el índice del cadáver cuando el DM finaliza el combate, sin reemplazar la identidad ni los recursos de la Loot Instance. Sin sprite válido, la UI usa el emblema ✥.

**Sustraer** es una acción independiente de Buscar. Se resuelve con la Skill **Sleight of Hand (DEX)** y el check canónico de cinco Coins, DC base 10 (+8 TH sin competencia). Una vez por personaje y cadáver, aun si falla.

- En un éxito, el DM selecciona de manera reproducible una opción aleatoria entre los objetos que quedan (un ejemplar de cada stack) y la reserva de Ahn del cadáver.
- Si sale un objeto apilado, se entrega **una sola unidad** y el resto sigue en el cadáver; si sale Ahn, se entrega todo el monto disponible.
- La acción nunca genera un item nuevo ni vuelve a tirar el dinero. Conserva el mismo control de entrega, espacio, reservas de cadáver, intentos idempotentes y permisos de los demás checks.
- Sustraer no revela el resto del inventario ni equivale a elegir una casilla. Su límite sigue siendo una vez por personaje y cadáver, aun si falla.
- Buscar puede realizarse por separado una vez por personaje hasta que alguien revele las pertenencias. Lo revelado queda visible para todos sin nuevas tiradas.
- El botón **Recoger** sobre una pertenencia conocida permite elegir qué llevarse; la acción **Sustraer** conserva su selección al azar.

Las cerraduras, paneles, hackeo, forzar mecanismos con STR y minijuegos **no están implementados aquí**: serán un subsistema separado de interacciones con objetos del mundo.

## Regla de oro: el equipo usado existe en el cadáver

El equipo real del enemigo forma parte de su inventario saqueable. El tier, la riqueza, la zona y las probabilidades del botín adicional **nunca eliminan sus armas**. Si atacó con una daga y todavía la llevaba al morir, esa misma arma debe poder descubrirse y recogerse.

- Se conserva el equipo runtime si existe, incluidos identidad, cantidad, calidad, condición, desgaste y modificaciones. Una lista runtime explícitamente vacía tiene prioridad sobre el catálogo: no se repone equipo perdido.
- A falta de instancias runtime, se materializan las referencias del loadout mediante las definiciones canónicas de objetos. No se deducen armas a partir de nombres de ataques, sprites o texto.
- Los kobolds declaran su equipamiento: Dagger, Winged y Scale Sorcerer llevan daga; Sling lleva honda; Dragonheart lleva lanza. Las unidades guardadas sin ese campo utilizan el loadout canónico cuando todavía no existe un estado runtime que lo sustituya.
- El equipo permanece separado del botín aleatorio en la instantánea congelada, pero ambos entran una sola vez por instancia en el inventario compartido del cadáver.
- El equipo destruido, perdido, soltado, retirado o con cantidad cero no reaparece. La munición sigue su reconciliación existente. Los ataques naturales no generan armas inventadas.
- Los cadáveres ya finalizados conservan su estado y sus entregas; no se regeneran para aplicar este cambio.
- En estados anteriores a v3, un Buscar exitoso ya registrado revela para todos únicamente las pertenencias que todavía quedan. No se repite la tirada ni se reponen objetos o dinero consumidos; el historial y las entregas anteriores se conservan. La vista aplica esta compatibilidad al leer y el DM la persiste dentro de la siguiente acción autorizada. Un intento fallido o Sustraer no revela pertenencias.

## Sanidad tras combate

Al terminar con victoria o derrota, el SP del jugador pasa a `Math.trunc(sp / 2)`, conservando el signo. Ejemplos: `12 → 6`, `-12 → -6`, `11 → 5`, `-11 → -5`. Un encuentro cancelado no reduce SP.

La reducción se aplica una sola vez por Encounter al pasar por `LuminousCombatSession.claimEnd` y se persiste en `campaña/jugadores/<playerId>/sp` y `combatStats/sp_actual` antes del Loot. `lastPostCombatSanityEncounterId` evita duplicados si se reintenta la finalización.

## Concurrencia y seguridad

- Firebase valida que el jugador esté vinculado a su cuenta, participe en la victoria y que no sobrescriba una reserva ajena.
- El DM verifica la reserva vigente antes de aceptar cualquier acción o entrega pendiente.
- Los cambios de recursos finitos usan transacciones de la Loot Interaction State. Ningún usuario puede llevarse el mismo recurso dos veces.
- Cuando se cierra una pestaña sin liberar la reserva, la expiración permite retomarla sin bloquear para siempre el cadáver.
- Se deben publicar las nuevas `database.rules.json` junto con los scripts. Un PR sin reglas desplegadas no habilita las reservas de cadáveres.

## Verificación

Las regresiones cubren búsqueda sin transferencia, revelación compartida, recogida elegida, robo aleatorio sin revelar, exclusión de objetos agotados y conservación de armas/condición. `tests/loot-shared-belongings.spec.mjs` prueba el HUD real con Firebase Auth/RTDB emulados, DM y dos jugadores, cambio de propietario del cadáver, recarga y los seis tamaños exigidos por TX-01. Estas pruebas no despliegan ni modifican la campaña de producción.
