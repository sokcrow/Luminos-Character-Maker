# Loot Corpse: contrato del HUD y motor canónico

La UI `js/player-postcombat-loot.js` utiliza `js/loot-live-postcombat-runtime.js`, `js/loot-postcombat-runtime.js`, `js/loot-check-runtime.js` y `js/item-inventory-runtime.js`. No genera botín de forma independiente.

## Flujo

1. El DM finaliza un encuentro como `victory` y el motor congela las Loot Instances. El menú del jugador solo aparece cuando hay restos de la victoria en la cola de `campaña/loot_encounters`.
2. El jugador selecciona un cadáver y solicita una reserva de `campaña/loot_claims/<lootInstanceId>` (una por cadáver). Solo el propietario puede interactuar. La reserva caduca a los 90 segundos y se renueva mientras la UI está abierta; al cerrar, cambiar o pulsar «Soltar cadáver», se libera.
3. El jugador elige **Buscar, Cosechar, Extraer, Desmontar, Examinar o Autopsia**. Los checks se animan en el cliente; la resolución autoritativa se recompone en el DM a partir del resultado de las monedas y del estado guardado.
4. **Buscar** recupera el botín de bolsas y pertenencias conforme a los resultados del check. Hoy es una operación *revelar y recuperar*; no existe una transacción separada «revelar, luego tomar». El loot no descubierto nunca se pinta en la cuadrícula.
5. El apartado **Cuerpo** comienza oculto y solo muestra la lista de recursos disponibles/agotados tras un check exitoso de **Examinar** o **Autopsia**. Los recursos ya recuperados también se muestran al personaje que los obtuvo.
6. Lo obtenido se acredita en Active Inventory / Stash, Ahn y Compendium a través del runtime existente. Si no hay capacidad, se conserva una **entrega pendiente**, reclamable más tarde.
7. La cola se puede retirar desde la vista del DM; su cierre retira el acceso al menú.

## TH Check de anatomía

El umbral se calcula en `LuminousLootPostCombatRuntime.checkDefinition`.

| Acción | Sin competencia en Medicina | Con Medicina o conocimiento explícito |
| --- | --- | --- |
| Buscar | Sin penalización | Sin penalización |
| Cosechar | DC base +8 | DC base |
| Extraer (órganos/delicados) | DC base +8 | DC base |
| Autopsia | DC base +8 | DC base |
| Examinar | Sin penalización | Sin penalización |
| Desmontar | Sin penalización | Sin penalización |

`Medicine` debe estar en estado `proficient` o `expertise`; `half` no elimina la penalización. Una clase/trait también puede conceder conocimiento a través de un **grant explícito**. Ejemplos de datos que entiende el runtime:

```js
player.lootKnowledge = { anatomy: true };
player.traits = [{ id: "anatomist", grants: { lootKnowledge: { autopsy: true, extract: true } } }];
player.classFeatures = [{ id: "field_surgeon", lootKnowledge: { anatomy: true } }];
```

Son ejemplos de estructura, NO traits/clases nuevos ni grants concedidos automáticamente por nombre. Las definiciones reales tienen que suministrar esa metadata al personaje. El motor no adivina conocimiento solo a partir del nombre de la clase.

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

Se realizaron comprobaciones aisladas de sintaxis, permisos simulados de ocupación, visibilidad del cuerpo, umbrales de Medicina y reducción/idempotencia de SP. **Falta** una prueba integrada con Firebase y el DM autenticado, incluyendo dos clientes simultáneos y pruebas visuales en móvil.