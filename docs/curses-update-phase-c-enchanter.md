# Curse's Update — Fase C: Curse + Enchanter + Magic Items

**PR:** #978 · **Estado:** implementación de integración de Item Curses en rama Draft.

## Autoridades existentes que no se reemplazan

Enchanter's Update #931 conserva **sus valores y reglas canónicas**:

- `curse` aumenta el efecto positivo del Enchantment autorizado x1.50; `bind` x1.25.
- `bind` y `curse` no pueden ser simultáneos en una misma referencia de Enchantment.
- Rank/TH, materiales, Enchantment Slots, Gem Sockets, Gem Anchors, Attunement, reparación y Magical Durability siguen bajo Enchanter.
- Valor de mercado x0.60 para objeto maldito bajo su modelo de valoración; no se aplica indiscriminadamente a una Curse autónoma.
- Bind conserva su bloqueo de desintonización/desequipamiento y las rutas catastróficas específicas de Gem ligada.
- Las desventajas inseparables de Relics siguen siendo inseparables.

## Adaptador canónico

**Archivo:** `js/curse-enchanter-bridge.js`.

`listItemCurses(item)` proyecta las fuentes de magia maldita **sin mutar el Item**:

1. `enchantment_curse`: una referencia `magic.enchantments[]` con propiedad `curse`.
2. `item_magic_bind`: una referencia con `bind`, separada de la familia autónoma Binding y del Status `bind`.
3. `autonomous`: una instancia no resuelta de `item.curseInstances[]` consultada por Curse Runtime.

Cada entrada lleva su tipo de fuente, su identidad/selector y si el servicio de Enchanter está autorizado a eliminarla. No se migra, reescribe, duplica ni convierte una Curse autónoma en Enchantment para que un servicio la manipule.

`selectRemoveCurseTarget(item,quote)` aplica validaciones estrictas:

- Una única Curse de Enchantment removible puede seleccionarse de forma retrocompatible.
- Si existen múltiples referencias candidatas, un `remove_curse` sin `curseTarget` exacto **se rechaza**: ninguna operación selecciona el primer ref por accidente.
- `curseTarget` contiene `kind:"enchantment_curse"`, `definitionId`, y opcionalmente `applicationId`/`anchorId`.
- Si dos referencias de la misma definición son ambiguas, se exige identidad de aplicación; `removeEnchantmentProperty` tampoco elige una arbitrariamente.
- Bind, propiedades inválidas, efectos de Relic inseparable, Gem-anchored y definiciones `removable:false` son **fail-closed**.
- El método `remove_curse` no es `Break`/`Suppress`/`Seal` para maldiciones autónomas. Una Curse autónoma requiere su propia operación autorizada y su flujo de persistencia.

## Servicio y transacción

**Archivos:** `js/item-enchanter-service-runtime.js`, `js/item-enchantment-engine.js`, `functions/enchanter-atomic.cjs`, `functions/build-enchanter-bundle.cjs`, `functions/index.cjs`.

El servicio original deja de usar `.find(ref => has('curse'))` y utiliza el selector validado. La operación modifica **solamente** la propiedad `curse` de la referencia elegida. Mantiene el encantamiento, las otras propiedades y las instancias autónomas. No limpia el registro `viewer.itemCurses` mientras otra maldición persista en el mismo objeto.

Los intentos incorrectos devuelven `curse_target_required`, `curse_target_not_found`, `curse_target_ambiguous`, `gem_anchored_curse_requires_anchor_procedure`, `enchantment_not_removable`, `relic_drawback_inseparable` u otros errores específicos antes de mutar o cobrar.

El servidor genera el quote a partir del intento autenticado y **revalida** el destino contra el Item actual durante la transacción sobre la campaña; un `curseTarget` cliente no es autoridad para retirar nada. Idempotencia por `transactionId`, comprobación del balance y recibo del servicio siguen el contrato de Enchanter.

Los módulos nuevos se añaden al bundle de Firebase. **La callable productiva sigue protegida por el gate de despliegue ya existente**; no se ha activado ni desplegado desde este PR.

## UI

**Archivo:** `js/item-enchanter-ui.js`.

Dentro del menú de servicios de Enchanter, `Remove Curse` muestra un selector real **solo para maldiciones detectadas**. Antes de que el observador conozca la Curse no aparecen nombres, cantidad de penalizaciones ni IDs internos. Cuando se identifica una inscripción, se puede elegir cuál tratar y su selector viaja por el intent de la callable. No se crea un panel flotante ni un menú de debug.

## Pruebas

- `tests/curse-enchanter-bridge-smoke.cjs`: aplicación selectiva entre dos fuentes, no mutación de previews, persistencia de Curse autónoma, protección de Bind/Gem/Relic, ambigüedad, recibos y procedencia.
- `tests/curse-enchanter-server-intent-smoke.cjs`: selección de servidor, retiro exacto y AHN, rechazo de quote obsoleta, no cobro ante ambigüedad ni replay.
- `tests/item-enchanter-ui.spec.cjs`: Playwright con menú real, selección explícita y secreto hasta identificación.
- `tests/item-enchanter-service-runtime-smoke.cjs`, `tests/item-enchantment-engine-smoke.cjs`, `tests/item-enchanter-gem-procedure-smoke.cjs`, `tests/enchanter-server-canonical-smoke.cjs`: regresiones del sistema preexistente.
- `.github/workflows/curse-runtime-integration.yml`: suite de C y regresiones en Node 22.

## Pendientes que no se simulan

- Transferencia real de Items entre propietarios y preservación de conocimiento individual con Firebase CAS.
- Regresiones completas de equipar/desquipar, mover entre Stash, rehidratar y duplicados en todas las rutas de Player y DM.
- Adaptadores de Curse para `creature`, `place`, `lineage`, `entity` y los efectos de Status/Traits/Spells quedan para etapas posteriores.
- Validación de despliegue de la callable, security rules y cargas productivas: los gates existentes no se eluden.
