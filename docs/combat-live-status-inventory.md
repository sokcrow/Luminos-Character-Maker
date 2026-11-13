# Inventario de estados del combate en vivo

Revisión estática sobre main `5b637d28`, 2026-11-13. Fuente del catálogo: `js/status-library.js`; mecánicas: `combat/source/combat-v073-live.html`. No certifica una sesión Firebase ni paridad completa de cada estado.

124 definiciones: 47 originales con mecánica conectada, 2 pendientes con icono (Crit DMG Up y Deafened), 75 sin icono. Los 75 sin icono también carecen de integración mecánica confirmada en vivo; las categorías siguientes son excluyentes para facilitar la lista solicitada.

Política autorizada: bloquear solamente estados sin un icono no vacío en los editores de habilidades y unidades. Conservar catálogo e instancias existentes. La presencia de URL asignada no verifica que la imagen externa responda. Crit DMG Up y Deafened siguen seleccionables aunque su mecánica esté pendiente.

## 1. Funcionando: mecánica conectada (47)

| ID | Nombre | Icono asignado |
|---|---|:---:|
| `bleed` | Bleed | Sí |
| `rupture` | Rupture | Sí |
| `tremor` | Tremor | Sí |
| `tremor_burst` | Tremor Burst | Sí |
| `sinking` | Sinking | Sí |
| `attack_power_up` | Attack Power Up | Sí |
| `attack_power_down` | Attack Power Down | Sí |
| `haste` | Haste | Sí |
| `bind` | Bind | Sí |
| `clash_power_up` | Clash Power Up | Sí |
| `clash_power_down` | Clash Power Down | Sí |
| `defense_power_up` | Defense Power Up | Sí |
| `defense_power_down` | Defense Power Down | Sí |
| `offense_level_up` | Offensive Level Up | Sí |
| `offense_level_down` | Offensive Level Down | Sí |
| `defense_level_up` | Defensive Level Up | Sí |
| `defense_level_down` | Defensive Level Down | Sí |
| `damage_up` | DMG Up | Sí |
| `damage_down` | DMG Down | Sí |
| `burn` | Burn | Sí |
| `paralyze` | Paralysis | Sí |
| `poise` | Poise | Sí |
| `fragile` | Fragile | Sí |
| `protection` | Protection | Sí |
| `hp_healing_up` | HP Healing Up | Sí |
| `hp_healing_down` | HP Healing Down | Sí |
| `chill` | Chill | Sí |
| `frozen` | Frozen | Sí |
| `shock` | Shock | Sí |
| `corrosion` | Corrosion | Sí |
| `poison` | Poison | Sí |
| `decay` | Decay | Sí |
| `radiance` | Radiance | Sí |
| `blinded` | Blinded | Sí |
| `charmed` | Charmed | Sí |
| `paralyzed` | Paralyzed | Sí |
| `confusion` | Confusion | Sí |
| `frightened` | Frightened | Sí |
| `grappling` | Grappling | Sí |
| `grappled` | Grappled | Sí |
| `restrained` | Restrained | Sí |
| `incapacitated` | Incapacitated | Sí |
| `invisible` | Invisible | Sí |
| `petrified` | Petrified | Sí |
| `prone` | Prone | Sí |
| `sleep` | Sleep | Sí |
| `exhaustion` | Exhaustion | Sí |

## 2. Pendientes con icono (2)

| ID | Nombre | Icono asignado |
|---|---|:---:|
| `deafened` | Deafened | Sí |
| `crit_dmg_up` | Crit DMG Up | Sí |

## 3. Sin icono: bloqueados al crear o guardar (75)

| ID | Nombre | Icono asignado |
|---|---|:---:|
| `counter_power_up` | Counter Power Up | No |
| `evade_power_up` | Evade Power Up | No |
| `guard_power_up` | Guard Power Up | No |
| `base_power_up` | Base Power Up | No |
| `plus_coin_boost` | Plus Coin Boost | No |
| `minus_coin_drop` | Minus Coin Drop | No |
| `weak_resist_dmg_boost` | Weak-resist DMG Boost | No |
| `ego_resource_amp` | E.G.O Resource Amp | No |
| `power_down` | Power Down | No |
| `counter_power_down` | Counter Power Down | No |
| `evade_power_down` | Evade Power Down | No |
| `guard_power_down` | Guard Power Down | No |
| `plus_coin_drop` | Plus Coin Drop | No |
| `minus_coin_boost` | Minus Coin Boost | No |
| `immobilized` | Immobilized | No |
| `slash_dmg_up` | Slash DMG Up | No |
| `slash_power_up` | Slash Power Up | No |
| `slash_protection` | Slash Protection | No |
| `slash_dmg_down` | Slash DMG Down | No |
| `slash_power_down` | Slash Power Down | No |
| `slash_fragility` | Slash Fragility | No |
| `pierce_dmg_up` | Pierce DMG Up | No |
| `pierce_power_up` | Pierce Power Up | No |
| `pierce_protection` | Pierce Protection | No |
| `pierce_dmg_down` | Pierce DMG Down | No |
| `pierce_power_down` | Pierce Power Down | No |
| `pierce_fragility` | Pierce Fragility | No |
| `blunt_dmg_up` | Blunt DMG Up | No |
| `blunt_power_up` | Blunt Power Up | No |
| `blunt_protection` | Blunt Protection | No |
| `blunt_dmg_down` | Blunt DMG Down | No |
| `blunt_power_down` | Blunt Power Down | No |
| `blunt_fragility` | Blunt Fragility | No |
| `wrath_dmg_up` | Wrath DMG Up | No |
| `wrath_power_up` | Wrath Power Up | No |
| `wrath_protection` | Wrath Protection | No |
| `wrath_dmg_down` | Wrath DMG Down | No |
| `wrath_power_down` | Wrath Power Down | No |
| `wrath_fragility` | Wrath Fragility | No |
| `lust_dmg_up` | Lust DMG Up | No |
| `lust_power_up` | Lust Power Up | No |
| `lust_protection` | Lust Protection | No |
| `lust_dmg_down` | Lust DMG Down | No |
| `lust_power_down` | Lust Power Down | No |
| `lust_fragility` | Lust Fragility | No |
| `sloth_dmg_up` | Sloth DMG Up | No |
| `sloth_power_up` | Sloth Power Up | No |
| `sloth_protection` | Sloth Protection | No |
| `sloth_dmg_down` | Sloth DMG Down | No |
| `sloth_power_down` | Sloth Power Down | No |
| `sloth_fragility` | Sloth Fragility | No |
| `gluttony_dmg_up` | Gluttony DMG Up | No |
| `gluttony_power_up` | Gluttony Power Up | No |
| `gluttony_protection` | Gluttony Protection | No |
| `gluttony_dmg_down` | Gluttony DMG Down | No |
| `gluttony_power_down` | Gluttony Power Down | No |
| `gluttony_fragility` | Gluttony Fragility | No |
| `gloom_dmg_up` | Gloom DMG Up | No |
| `gloom_power_up` | Gloom Power Up | No |
| `gloom_protection` | Gloom Protection | No |
| `gloom_dmg_down` | Gloom DMG Down | No |
| `gloom_power_down` | Gloom Power Down | No |
| `gloom_fragility` | Gloom Fragility | No |
| `pride_dmg_up` | Pride DMG Up | No |
| `pride_power_up` | Pride Power Up | No |
| `pride_protection` | Pride Protection | No |
| `pride_dmg_down` | Pride DMG Down | No |
| `pride_power_down` | Pride Power Down | No |
| `pride_fragility` | Pride Fragility | No |
| `envy_dmg_up` | Envy DMG Up | No |
| `envy_power_up` | Envy Power Up | No |
| `envy_protection` | Envy Protection | No |
| `envy_dmg_down` | Envy DMG Down | No |
| `envy_power_down` | Envy Power Down | No |
| `envy_fragility` | Envy Fragility | No |

## Límites y comprobaciones

- Deafened declara mecánicas reservadas. Crit DMG Up define reglas, pero el multiplicador crítico en vivo no lo consume.
- Grappling y Grappled dependen del vínculo creado por la acción Grapple; aplicar solo el icono no crea ese vínculo.
- Tremor Burst es una operación inmediata, no una pila persistente.
- Los selectores usan el registro canónico y se vuelve a validar el payload al guardar; el editor de unidades comprueba las habilidades vinculadas contra una lectura actual de la base.
- Pruebas nuevas temporales, retiradas antes del commit, conforme al README.

Validación de esta entrega: PASS en sintaxis de los scripts de ambos editores; selector evaluado contra las 124 definiciones; guardado real de Skills/unidades con Firebase simulado; bloqueo de efectos anidados sin icono; lectura reciente de Skills vinculadas y fallo de lectura; estados pendientes con icono permitidos; alias, extensiones y objetos cíclicos. Smoke existente de librería unificada y `build-combat-live.mjs --check` correctos. No se añaden tests ni dependencias permanentes.

NEEDS WORK: comprobación visual de los seis viewports y sesión Firebase real. Se intentó Chromium local; el entorno impidió abrir su socket (`Operation not permitted`). No se declara validación visual ni despliegue.
