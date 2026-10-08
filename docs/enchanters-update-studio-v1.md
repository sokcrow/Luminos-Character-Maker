# Enchanter's Update — Segunda entrega: DM Enchanter Studio

**Status:** Implementado en rama de entrega 2, pendiente de revisión y pruebas manuales en sesión real.

## Alcance real

La entrega 2 convierte el contrato de la [entrega 1](./enchanters-update-core-v1.md) en una experiencia de **autoría de objetos** dentro del inventario del DM. **No** crea otra fuente de inventario ni habilita objetos mágicos aleatorios de Loot.

### Entrada del DM

La pantalla `pantalla_dm.html` carga explícitamente:

- `css/dm-item-instance-editor.css`: estilos del editor de Item Instances y Enchanter Studio.
- `js/dm-item-instance-editor.js`: editor y entrada desde inventario.
- `js/dm-enchanter-studio-model.js`: preparación sin efectos colaterales, texto de estado y validación contra el motor existente.
- `js/item-enchantment-runtime.js`: motor de encantamientos de la entrega 1, cargado por el bootstrap del editor.

En cada fila de inventario elegible, el DM dispone de **Encantar**; el editor incluye una sección **Enchanter Studio**. Una insignia `+1/+2/+3` aparece junto al objeto encantado. El mismo editor también se puede abrir con **Editar**; no se crea un segundo inventario ni un modal flotante paralelo.

### Flujo

1. Abrir un objeto concreto desde **Inventario Activo** o **Stash** del jugador.
2. Ver su encantamiento actual y las opciones válidas para su familia.
3. Elegir nivel `+1`, `+2` o `+3` y un foco de efecto expresado en lenguaje de juego (p. ej., «Nivel ofensivo»).
4. Leer la vista previa. Si el objeto no es compatible, los controles permanecen deshabilitados con un motivo entendible.
5. Pulsar **Preparar encantamiento**. Si ya hay magia, el sistema requiere confirmación explícita antes de preparar un reemplazo.
6. Pulsar **Guardar objeto** para guardar la instancia editada en el inventario real, con el mismo proveedor de sincronización que el resto del editor. **Descartar cambio** borra solo la preparación de encantamiento.
7. Para quitar magia: **Retirar encantamiento** ➝ confirmación ➝ **Guardar objeto**.

El DM no ve nombres internos de canales ni necesita editar JSON, IDs o cargas para aplicar encantamientos. No hay botones de testing/debug en la experiencia normal.

### Contrato transaccional y límites

- Preparar/revisar/descartar **no** muta el Item Instance ni emite eventos de encantamiento.
- El cambio se aplica a una copia independiente justo antes del guardado.
- Si el guardado falla, se revierte la sustitución local de la instancia, se conserva el borrador para reintento y se informa del fallo.
- Si el Item Instance fue encantado por otra sesión mientras el DM editaba, se rechaza la escritura de encantamiento a partir de un estado obsoleto.
- Cuando se guarda correctamente, el Item Instance mantiene Quality, Condition, módulos físicos, propiedad/owner y otros metadatos.
- El modelo usa `applyEnchantment` / `removeEnchantment` del motor; no duplica las reglas +1/+2/+3.
- El `item-enchantment-runtime` admite `{ emit: false }` para la preparación del Studio; la sincronización persistida de inventario sigue siendo la fuente autoritativa.
- No se modifica el catálogo universal; los cambios afectan solo a la **instancia** seleccionada.
- Accesorios y Valuables requieren `enchantmentReady === true`; los demás tipos se validan contra el motor V1.
- Los campos de sintonización existentes siguen gobernando la activación de la magia; la vista previa menciona Attunement cuando corresponde.
- No se adjudican efectos porcentuales, elementales ni económicos nuevos.

## Pruebas ejecutadas (temporales, fuera del repositorio)

- 12 checks iniciales del modelo y su persistencia: compatibilidad, opt-in, estado pre-guardado, reemplazo y retirada.
- 15 checks de interacción de editor con un DOM y peer de inventario simulados: apertura, selección, cancelar, guardar, preservación de Quality, fallo de guardado, reintento y conflicto concurrente.
- 13 checks posteriores a correcciones: sintaxis de módulos, arranque cargado en `pantalla_dm.html`, preparación sin eventos mágicos, guardado de perfil, puertas de compatibilidad, respeto de Skill source y detección mágica.

Estos tests son de contrato/flujo simulado. **Pendiente:** aceptación de uso humano en navegador, Firebase en vivo y Battle Viewer. No se agregan tests permanentes ni herramientas de depuración a la UI.

## Siguiente entrega

- Descripciones y señalización enriquecida en inventario del jugador.
- Integración de Skills de arma que aún no transportan el Instance ID de su equipamiento fuente.
- Rules authoring de coste AHN, gemas, resonancias, creación/crafting y magia elemental solo después de cerrar sus contratos.
- Magic Loot queda fuera de Enchanter Studio.
