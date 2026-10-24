# Taller de Ítems del DM — Item Creator

El menú **Ítems / Mercado → Crear ítem** crea una definición nueva y persistente de campaña. No es un botón de spawn ni requiere editar JSON/archivos JS.

## Flujo del Director

1. En el Dashboard DM abre **Ítems / Mercado** y pulsa **Crear ítem**.
2. **Identidad:** nombre, categoría, Tier, valor en AHN, etiquetas, descripción e **icono de la biblioteca canónica**. El catálogo solo muestra rutas registradas y usa el fallback oficial.
3. **Mecánicas:** resistencia máxima y campos de la categoría: manos de arma, accesorio, tiempo/curación HP-SP de consumibles, anatomía/removibilidad de Augments, apilamiento para objetos permitidos. Armas, armaduras, escudos, accesorios y Augments pueden tener pasivas declarativas.
4. **Vista previa:** ficha con valores del borrador. **Guardar en catálogo** crea la definición exclusivamente en `campaña/base_datos_items` (o `campaña/base_datos_aumentos` para Augments), en una transacción Firebase.
5. La definición aparece en el **Directorio Local de Ítems**, mediante el listener existente de `LuminousDmLocalItemManagerV3`. Selecciónala, elige jugador y pulsa **Al inventario activo** o **Al alijo**. **Entregar no equipa** y **equipar no instala**.
6. Para cambiar una definición creada con esta herramienta, abre el creador y usa **Mis creaciones guardadas → Editar**. Se protege el guardado contra sobrescritura de una revisión nueva; no se permite cambiar la categoría de una definición existente.

El ID del ítem se asigna automáticamente y no se expone al DM. Las instancias ya otorgadas mantienen sus propios atributos; editar la definición no modifica retroactivamente una instancia entregada.

## Contratos existentes

- `LuminousDmItemCreatorCore.buildDefinition` construye definiciones con los campos usados por ItemRuntime, ItemInventoryRuntime y EquipmentEffects.
- `LuminousItemIconRegistry.list()/resolveIcon()` proporciona **solo imágenes canónicas reales**; no hay iconos inventados.
- `itemEquipmentRefs` almacena referencias de instancias activas; un Augment se instala con `LuminousItemAugmentationRuntime`, nunca al crear la definición.
- Pasivas soportadas por `LuminousEquipmentEffects`: bonus de skill, reducción de prueba, pérdida SP, resistencia a pecado, curación al comienzo de turno y Skill registrada (solo cuando el catálogo real está disponible). No se ejecutan guiones arbitrarios ni se crean habilidades ficticias.
- Para no perder efectos, propiedades de equipamiento ni resistencia, la serialización de inventario conserva `equipment`, `equipmentSchema`, `equipmentEffects` y `runtime` cuando están definidos.
- Por la restricción del inventario, las unidades no apilables se entregan una a una.

## Autorización, conflictos y sincronización

El formulario requiere sesión Firebase. El servidor **debe** aplicar reglas de RTDB que permitan crear/editar `campaña/base_datos_items` y `campaña/base_datos_aumentos` únicamente al DM autorizado (u otro rol editorial explícitamente permitido). Estar en la pantalla DM no sustituye esas reglas; si niegan permisos, se informa del error y no se confirma un guardado exitoso. La creación usa transacción que solo escribe sobre una clave vacía; la edición usa revisión comparada y propietario, sin sobreescribir silenciosamente cambios simultáneos.

La creación de una definición no sincroniza automáticamente los objetos con jugadores; eso se hace por el circuito existente de otorgamiento. Los efectos de equipamiento dependen de la activación del objeto y de las restricciones del motor de combate.

## UX de producto y TX-01

Un único flujo para móvil/escritorio. El modal utiliza scroll interno, pie de acciones persistente, targets de 44px, safe areas, filtros de iconos, campos condicionales por categoría, validaciones, confirmación al descartar y mensajes accesibles. CSS adaptado para 360×800, 390×844, 844×390, 768×1024, 1280×720 y 1920×1080. **Estas medidas requieren verificación visual en navegadores/dispositivos reales** además de los smoke tests de lógica; las pruebas de código no la sustituyen.

## Verificación automática

- `node tests/dm-item-creator-smoke.cjs`
- Comprueba definiciones válidas, errores de precio/anatomía/efectos, iconos registrados, contrato de consumibles, arma a dos manos, pasivas activas tras serialización/hidratación, y presencia de reglas CSS responsive.

## Fuera del alcance

- Crear arte nuevo o publicar imágenes no registradas.
- Definir nuevas Skills desde el Item Creator (se usan Skills del catálogo real cuando esté cargado).
- Verificación end-to-end de permisos y transacciones en Firebase real y validación visual exhaustiva en dispositivos. No se declara aprobada hasta que se realice.
