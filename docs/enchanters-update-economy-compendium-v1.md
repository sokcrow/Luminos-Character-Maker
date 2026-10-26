# Enchanter's Update V1.1 — Economía AHN, Rituales y Compendio

## Estado y alcance

Extensión del Enchanter V1 que ya utiliza `ItemInstance`, un foco mágico aprobado por objeto, niveles +1/+2/+3 y el motor de modificadores aditivos de Limbus.

Los valores de costes que aparecen aquí son **nuevas reglas V1.1 propuestas e implementadas**. El repositorio previo definía materiales y salarios, pero **no** las cantidades exactas del ritual ni los multiplicadores mágicos. Los números se pueden equilibrar más adelante modificando una única tabla del catálogo de recetas.

Se mantienen sin cambios el sistema mundano de Quality, los upgrades físicos, la Sintonización y los efectos autorizados por tipo de equipo. Magic Loot, drops aleatorios, maldiciones y daño/resistencia elemental **no** están en esta extensión.

## Materiales canónicos

Los rituales consumen únicamente recursos existentes:

- `arcane_essence`: Arcane Essence, en `item-catalog-essence-core.js`.
- `mana_energy_core`: Mana / Energy Core, en el mismo catálogo.
- `exotic_core`: Exotic Core, en el mismo catálogo.
- Una **Cut Gem** del catálogo `item-catalog-ore-ingot-gem.js`, a elección (Ruby, Diamond, etc.). Una gema `rough_*` **no** sustituye a una Cut Gem.

La gema no concede afinidad elemental en combate. Su `resonanceTags` se registra solo para futuros contenidos.

## Tabla de rituales

| Nivel mágico | Esencia Arcana | Núcleo Mana | Núcleo Exótico | Gema Tallada elegida | Labor AHN | Multiplicador mínimo |
|---|---:|---:|---:|---:|---:|---:|
| +1 | 2 | 0 | 0 | 1 | 100,000 | ×1.50 |
| +2 | 4 | 1 | 0 | 2 | 250,000 | ×2.50 |
| +3 | 8 | 2 | 1 | 3 | 600,000 | ×4.00 |

La mano de obra usa 10%, 25% y 60% del salario de referencia de **1,000,000 AHN/mes**, sin introducir otra moneda.

Los materiales toman su `standardUnitValueAhn` o `standardMediumValueAhn` del catálogo existente. Un ritual con rubíes tallados a valor estándar tiene precios de material aproximados de:

| Nivel | Materiales AHN | Labor AHN | Valor conjunto de producción |
|---|---:|---:|---:|
| +1 | 297,000 | 100,000 | 397,000 |
| +2 | 819,000 | 250,000 | 1,069,000 |
| +3 | 1,863,000 | 600,000 | 2,463,000 |

Estas cifras no son precios de venta al público. Un comprador que **ya posee materiales** paga únicamente la mano de obra. Los ingredientes se consumen en su inventario.

## Valor de producción de un ItemInstance encantado

```text
Materiales = sum(Cantidad × Valor de catálogo)
Labor = Salario AHN de referencia × Factor de nivel
Gasto del ritual = Materiales + Labor

PV encantado = max(
  PV mundano original × Multiplicador mínimo del nivel,
  PV mundano original + Gasto del ritual
)

EnchantmentValueAhn = PV encantado - PV mundano original
EnchantmentMultiplier = PV encantado / PV mundano original
```

Esta regla conserva el contrato de multiplicadores de Jewelry/Valuables como **mínimo**, sin asignar un PV mágico por debajo del coste completo de transformación. No introduce un markup de retail; tiendas locales siguen resolviendo esos márgenes.

Los campos `baseMundaneValueAhn`, `enchantmentBaseValueAhn`, `enchantmentValueAhn`, `enchantmentMultiplier` y `productionValueAhn` sobreviven a la serialización de Item Instances.

Al retirar un encantamiento de V1.1 se restaura el PV mundano guardado, sin alterar Quality o upgrades físicos. Los rituales realizados previamente sin un PV mundano original no se reprician silenciosamente.

## Dos maneras explícitas de crear magia

**Autoría narrativa del DM:** `Preparar encantamiento` → `Guardar objeto`. Respeta tipos, focos y reemplazo confirmado. No cobra material ni saldo. Si existe un PV mundano, fija el nuevo PV encantado según la tabla. Si no existe, conserva el Item y marca el precio como pendiente.

**Ritual pagado:** `Craftear con recursos y AHN`. La operación valida en **una transacción Firebase sobre el jugador**: ItemInstance existente en Active/Stash, materiales disponibles/no equipados, saldo AHN, foco permitido, precio base existente, reemplazo autorizado, consumo de stock, descuento de AHN, modificación de la instancia y recibo en `finance.transactionHistory`.

Si fallan los requisitos o Firebase no admite la transacción, no se guarda un ritual parcial. La transacción vuelve a comprobar los requisitos si la base de datos reintenta por concurrencia. Al reemplazar un encantamiento se requiere el ritual entero de nuevo; no se reembolsan gemas ni esencias.

El flujo pagado del DM no guarda simultáneamente otros campos sucios del editor; hay que guardarlos primero.

## Compendio

- `game-codex/enchantments.html`: compendio interactivo de familias y canales, recetas, resonancias informativas y simulador de PV en AHN.
- Enlace desde `game-codex/index.html`, Enchanter Studio del DM y el detalle de objetos encantados del inventario del jugador.
- El compendio es conocimiento mecánico de referencia público, **no** un registro de descubrimientos privados ni el compendio de Loot por unidad/enemigo.

## Criterio de cierre

Los tests automatizados sobre el PR deben pasar sin nuevas dependencias ni tests permanentes. Antes de certificar el flujo pagado en producción, se necesita validar en sesión autenticada DM + jugador con Firebase RTDB real, incluida una carrera de dos operaciones y la ausencia de descuento cuando un ritual falla.
