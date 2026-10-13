# Curse's Update — Fase B · Curse Catalog, Instance & Runtime

**PR:** #978 · **Fase:** B (implementación incremental) · **Estado:** primer slice Item operativo; resto de objetivos pendientes.

## Contratos ejecutables reales

| Módulo | Papel |
|---|---|
| `js/curse-catalog.js` | Registro versionado y validador cerrado de definiciones. |
| `js/curse-runtime.js` | Instancias autónomas de Item; consultas puras, aplicación, límites, transición de estados y transferencia pura. |
| `js/item-magic-runtime.js` | Reconoce Curse autónomas en `isCursed`/`isMagicItem`, conservando los flags y Enchantments heredados. |
| `js/item-equipment-bridge.js` | Adaptador ejecutable de `equipment_lock` que bloquea unequip sin sustituir la propiedad mágica Enchanter `bind`. |
| `js/dm-item-instance-editor.js` | Curse Studio en el editor existente: cambios preparados, validación, intensidad, Guardar objeto y control de versión por snapshot. |

## Familias, objetivos y definiciones

El catálogo reconoce cinco familias: `item`, `affliction`, `binding`, `ritual`, `pact`; y cinco clases de objetivo: `item`, `creature`, `place`, `lineage`, `entity`.

**Reconocer estas categorías no significa que tengan ya efectos jugables.** Por ahora se publica **una** definición ejecutable:

`cursed_binding` — **Atadura maldita**. Familia: `binding`, objetivo: `item`, `trigger:passive`, perjuicio: `equipment_lock`, intensidad máxima 1, operaciones `suppress`, `seal`, `break`, `transfer`. No concede mejoras automáticas de stats, no se confunde con `bind` de Enchanter y no ocupa Enchantment Slots ni Gem Sockets.

`remove` no está autorizado para esta definición. `break` sí está autorizado y conserva un registro `resolved`; `seal`/`suppress` conservan la Curse existente sin ejecutar su bloqueo. `transferItem` ofrece una transformación pura de dos instancias, **NO** un servicio con persistencia atómica entre dos jugadores.

## Definición segura

`LuminousCurseCatalog.validateDefinition(def)` rechaza nombres/IDs inválidos, familia u objetivo desconocidos, combinaciones de efecto/objetivo sin adaptador, disparadores no ejecutables, escala y prioridad malformadas, operaciones de resolución desconocidas, campos no implementados, payloads ejecutables y ciclos.

**No hay autoría DM arbitraria ejecutable.** No se admite introducir JS, scripts, callbacks, efectos HP/SP/Sanity genéricos, duración ni SP inventado por la interfaz. Los próximos adapters se habilitarán únicamente al implementarse junto con pruebas.

## Instancias

`item.curseInstances` es independiente de `item.magic.enchantments`, `item.itemCurses` heredado y de `itemMagicKnowledge` por observador.

Cada instancia validada contiene `schemaVersion`, `instanceId`, `definitionId`, `family`, `targetKind`, `targetInstanceId`, `intensity`, `state`, `origin` y `appliedAt`; al resolverse, `resolvedBy`/`resolvedAt`. Puede incluir un historial acotado `eventIds` para impedir reejecución de un mismo evento.

Estados: `active`, `suppressed`, `sealed`, `resolved`. Resolver una Curse no borra el historial; las consultas de efecto solo consideran instancias completas, válidas y activas. Objetivo/código manipulados o historia malformada se rechazan.

## APIs públicas

- `listDefinitions(targetKind)` y `getDefinition(id)`: definiciones publicadas sin referencias mutables compartidas.
- `validateDefinition(def)` y `validateInstance(item,instance)`: guardas cerradas.
- `canApply(item,id,options)` y `applyItem(item,id,options)`: elegibilidad y transición sin mutar el objeto origen.
- `canResolve(item,instanceId,operation)` y `resolveItem(...)`: comprobación de operación permitida y estado exacto.
- `transferItem(source,destination,instanceId)`: transformación pura, no transacción de red.
- `instances(item,options)`, `hasCurse(item)`, `activeEffects(item,trigger)`, `itemUnequipLocked(item)`, `snapshot(item)`: consultas puras y estado proyectado.

La aplicación de una Curse autónoma a un stack de cantidad diferente de **1** se rechaza para evitar maldecir implícitamente múltiples objetos con una única identidad.

Un `eventId` repetido se rechaza por idempotencia. Un mismo tipo de Curse puede intensificarse *solo si su definición lo permite y hasta su máximo*. La definición publicada actual tiene máximo 1 y no acumula nuevos incrementos.

## Compatibilidad y seguridad

Conservar `isBoundItem` reservado a Enchanter; una Binding Curse autónoma no debe bloquear Attunement por implicación ni aplicar x1.25. La visibilidad de Curse para el Player se rige por `item-magic-knowledge-runtime.js`, no por el conocimiento omnisciente del DM.

El bloqueo de equipo se ejecuta en el adaptador existente; estados sellado y suprimido no bloquean unequip. Una Curse resuelta deja de contarse como activa incluso si mantiene registro histórico.

El runtime es *puro y local*. La autoridad Firebase, la atomicidad de transferencias, los permisos multi-jugador, los checks de fuentes externas y los próximos efectos de Combat/Status siguen siendo gates posteriores; no reclamar release de producción.

## Pruebas

- `tests/curse-catalog-smoke.cjs`: vocabulario cerrado, definiciones no ejecutables, estado inválido, lectura pura, límite de intensidades, resolución y transferencia.
- `tests/curse-item-runtime-smoke.cjs`: Magic, Knowledge, bloqueo de equipamiento y transformaciones reales.
- `tests/dm-item-instance-editor.spec.cjs`: prueba de navegador con Apply/Save/Seal/Unseal/Break y rechazo de estado obsoleto.
- `.github/workflows/curse-runtime-integration.yml`: ejecuta schema test y regresiones con Enchanter; DM Inventory Grant GUI y Inventory Runtime Validation prueban la UI y el inventario.

**Cierre de Fase B:** todavía pendiente de completar adapters de Status/Traits/Spell y contratos de otros objetivos, con pruebas adecuadas; no marcar esas tareas como completadas por existir solo vocabulario.
