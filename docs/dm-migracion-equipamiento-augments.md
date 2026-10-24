# Manual del DM · Equipo y Augments al migrar una campaña

**Alcance:** panel de Inventario del DM de Luminos / Limbus, objetos ItemInstance y personaje persistido en Firebase. **Un Augment instalado forma parte del personaje** y deja de ocupar una casilla del inventario. Las armas, escudos, armaduras y accesorios equipados **sí permanecen en el Inventario Activo**, marcados por referencias de equipo.

## Abrir el administrador

1. Abre el **DM Dashboard** y el inventario del personaje (acción **Ver inventario**).
2. Si el personaje aún no tiene los objetos, usa **Añadir ítem al jugador** para otorgar una instancia desde el catálogo. Configura sus propiedades en el editor de ítems según corresponda.
3. Debajo encontrarás **EQUIPAR PERSONAJE**, con dos secciones adaptadas a móvil y desktop: **Armas, armaduras y accesorios** y **Augments instalados**.
4. Elige el objeto, el espacio correspondiente y pulsa **Equipar**; o selecciona un Augment y pulsa **Instalar en el cuerpo**.
5. Espera el mensaje de guardado. Si la anatomía, el espacio o una restricción del ítem impiden la operación, verás el motivo en pantalla y Firebase no modificará el personaje.

En esta interfaz nunca es necesario escribir JSON ni IDs internos. Las opciones muestran objetos reales del personaje, no ejemplos.

## Tres operaciones distintas

| Operación | ¿Dónde queda el objeto? | Resultado |
|---|---|---|
| **Entregar** | Inventario Activo o Alijo | El personaje recibe una instancia, pero aún no está equipada ni instalada |
| **Equipar** | Inventario Activo + espacio de equipo | Se asigna la referencia a mano principal, secundaria, armadura o accesorio; respeta las reglas de manos y anatomía del motor |
| **Instalar Augment** | Registro corporal del personaje, **fuera del inventario** | El motor comprueba la anatomía y asigna las partes corporales. El objeto desaparece de inventarios y se guarda en el array canónico de Augments instalados |

La instalación desde el DM es una **operación administrativa para importar equipo ya implantado en una campaña existente**. No supone que la cirugía, el coste, la escena ni las tiradas de instalación hayan ocurrido dentro del juego. El DM debe resolver esas condiciones de campaña antes de confirmar la migración.

## Equipar armas, escudos y armaduras

- Deben estar primero en el **Inventario Activo** y ser una instancia individual (cantidad 1).
- **Mano principal / secundaria:** para armas. Un arma de dos manos ocupa ambas.
- **Escudos:** el motor utiliza la mano correspondiente, además de su referencia de escudo; no debes copiarlo a mano a otro objeto.
- **Armadura:** espacio de armadura.
- **Accesorios:** sus espacios existentes.
- **Quitar:** retira la referencia de equipo, **sin eliminar** el objeto del Inventario Activo. Un ítem vinculado que prohíba desequiparse conserva ese bloqueo.
- El panel muestra el equipamiento actual usando las referencias persistidas, incluso después de volver a abrirlo.

Una casilla del Alijo no equivale a equipo activo. Mueve antes el objeto al inventario activo o entrégalo allí.

## Instalar Augments permanentes

Ejemplo: un **ojo mecánico de Jeske**. No debe aparecer como «ojo en la mochila» después de instalarlo.

1. Registra el Augment en el catálogo como categoría **augmentation** con su perfil de instalación anatómica (`runtime.augmentation`). El motor puede utilizar `targetPartTypes`, `targetPartIds`, `requiredPartCount`, `allowedSubstrates`, sustituciones corporales y `removable`.
2. Asigna la instancia al personaje (Inventario Activo o Alijo), porque la operación requiere una instancia real y existente.
3. Abre **Augments instalados**, selecciónalo y pulsa **Instalar en el cuerpo**.
4. El motor `LuminousItemAugmentationRuntime` valida el cuerpo y la compatibilidad antes de guardar.
5. La misma transacción Firebase retira el ItemInstance del contenedor de origen y lo guarda en `campaña/jugadores/{personaje}/augmentations` (o en el array de Augments que ya use el personaje), con `installed:true`, `equipped:true` y `installedBodyPartIds`.
6. Vuelve a abrir el inventario: no debe figurar en ninguna mochila; estará en **Augments instalados**, y el motor de anatomía lo tendrá en cuenta.

**Extracción:** si el perfil permite retirarlo (`removable !== false`), el DM puede usar **Extraer**. El motor verifica la remoción y devuelve la instancia al Inventario Activo si hay espacio. Si es fijo/no removible, la opción se bloquea; no se altera la anatomía ni el inventario.

## Efectos para las Builds

El PR [Equipment Effects Standard #1022](https://github.com/sokcrow/Luminos-Character-Maker/pull/1022) implementa efectos declarativos que el Combat Viewer interpreta cuando el personaje tiene los objetos equipados o los Augments realmente instalados.

| Build | Objeto | Efecto previsto |
|---|---|---|
| Jeske | Augment ocular | `skill_check_bonus` (Perception +1), `check_threshold_reduction` (Analyze 2) |
| Jeske | Armadura | `heal_hp_percent`, 5% al iniciar turno |
| Calipsys | Armadura | `sin_resistance` (Gloom) y `sp_loss_reduction` (-3 por evento externo) |
| Jeske / Calipsys | Armas | Skills concedidas desde catálogo, fuera del deck si corresponde |

**Pendiente:** el cambio de armas/decks de Jeske y de los cuatro modos de guanteletes de Calipsys durante el combate sigue necesitando el cambio de loadout autoritativo, tal como documenta PR #1022. Equipar una instancia no crea automáticamente ese sistema.

## Persistencia y seguridad

- **Equipo normal:** `campaña/jugadores/{personaje}/itemEquipmentRefs` guarda IDs de instancias presentes en `inventario_activo`.
- **Augments:** `campaña/jugadores/{personaje}/augmentations` (o el array existente del personaje) contiene la instancia instalada, separada de `inventario_activo` y `inventario_stash`.
- **Transacción única:** equipar, instalar o extraer valida la última instantánea del jugador y la modifica atómicamente, evitando dobles posesiones cuando se instala.
- Las reglas Firebase permiten estas escrituras al DM autenticado; los datos de la definición oficial del ítem y la autorización de efectos siguen sujetos a la migración de definiciones confiables detallada en PR #1022.
- Evita sobrescribir manualmente `augmentations` o `itemEquipmentRefs` desde editores antiguos mientras migras; para los cambios nuevos utiliza este panel.

## Verificación sugerida al migrar un personaje

1. Entregar espada, armadura y Augment a un personaje de pruebas; confirmar las tres instancias en inventario.
2. Equipar espada y armadura; confirmar referencias y verlas en la hoja de jugador.
3. Instalar Augment ocular; confirmar que desaparece de ambos inventarios y aparece como instalado.
4. Recargar DM y jugador; comprobar que no se duplicaron los objetos y que la anatomía refleja la instalación.
5. Entrar a un encuentro nuevo y comprobar con DM/jugador las bonificaciones efectivamente disponibles. No considerar completa una Build de cuatro decks hasta validar su cambio de modo en combate.

La automatización de estas verificaciones incluye tests del núcleo de equipamiento; la prueba de interacción real entre pantallas y Firebase sigue siendo necesaria antes del despliegue.
