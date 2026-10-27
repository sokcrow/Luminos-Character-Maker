# Auditoría de workflows de GitHub Actions — Limbus

Fecha: **25 de octubre de 2026**. Repositorio: `sokcrow/Luminos-Character-Maker`, rama fuente `main`.

## Alcance, metodología y límites

- Se inventariaron **64 archivos YAML** en `.github/workflows` de `main` y se leyeron sus disparadores y comandos.
- Se consultó la API de Actions: **38,571 ejecuciones históricas** y una **muestra de las 100 más recientes** (83 por `pull_request`, 16 por `push`, 1 despliegue dinámico Pages). Es una muestra, no todo el historial de cada flujo.
- Se consultaron los jobs y registros de seis fallos recientes; que una prueba falle no significa que sea inútil. No se lanzaron suites nuevas y los resultados nuevos de este PR corresponden exclusivamente a GitHub Actions.
- GitHub configura automáticamente los disparadores en el propio YAML; el asistente no necesita llamar manualmente todos los tests. El número de checks de un PR depende de los cambios de archivos y los filtros.
- Este PR reduce **64 → 60 workflows en main**, elimina cuatro automatizaciones ligadas a hitos/ramas concretas, y restringe tres flujos ruidosos (uno de ellos, `combat-results-acceptance`, también aparece en la categoría de fallos).
- Eliminar un YAML de `main` **no elimina necesariamente una copia histórica que siga presente en una rama de feature**. Tampoco elimina ejecuciones, releases ni artefactos históricos. No se tocaron otras ramas, despliegues ni configuración de secrets.

## A. Eliminar de main (4)

| Workflow | Prueba concreta / razón | Decisión |
|---|---|---|
| `pr777-package.yml` | Solo empaqueta `Map777.zip`, exige archivos específicos de la entrega PR 777 y publica tag fijo `pr777-map777`; hace checkout de `feat/item-icon-families`. No es CI general. | Borrar YAML, preservar historia y código de empaquetado del proyecto |
| `clashable-defenses-build.yml` | Hace checkout de la rama fija `feat/clashable-defenses-guard-counter-20261022`, se dispara únicamente en pushes a ella, recompila el combate y hace `git push` del bundle. Se solapa con validaciones actuales de `combat-v073-live-smoke` y build del combate. | Retirar de main; mantener las pruebas del módulo |
| `world-floor-textures-vendor.yml` | Vende imágenes, hace commit automático y fija checkout y push a `feat/item-icon-families`. Proceso de importación puntual, no protección de PR actuales. | Retirar YAML de main, conservar script y assets |
| `world-water-textures-vendor.yml` | Checkout y push fijos a `lab-preview` para dos texturas; automatización de importación, no CI ordinario. | Retirar YAML de main, conservar script y assets |

## B. Ajustar por ruido (2 exclusivos + 1 que también falla)

| Workflow | Antes | Cambio en este PR |
|---|---|---|
| `individual-goap-smoke.yml` | Todos los PR a main | PR solo cuando cambian módulos de GOAP/IA/unidades, sus pruebas o `package.json` |
| `combat-loot-performance.yml` | Todos los PR a main; instalación de navegador+emuladores y benchmarking doble | PR solo para cambios de combate, loot, inventario relacionado y benchmarks; `workflow_dispatch`, cancelación de ejecuciones anteriores del mismo PR y artefactos a 7 días |
| `combat-results-acceptance.yml` | Todos los PR a main; dos jobs con navegador y Firebase | PR solo para archivos de combate, loot, reglas y pruebas pertinentes; cancelación de ejecuciones anteriores y artefactos a 7 días |

**Nota importante:** los filtros no garantizan que cada módulo existente esté cubierto perfectamente. Ampliarlos cuando se añada una ruta de runtime nueva a esos motores. Los tests permanecen, no se silenciaron fallos.

## C. Tests valiosos pero FALLANDO: reparar, NO borrar (6)

| Workflow | Evidencia del fallo y acción requerida |
|---|---|
| `unit-loot-profile-validation.yml` | 6 fallos de 6 apariciones recientes. [Ejecución](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/40218382920): etapa `Validate Sapphire Spider variants, rock Salvage and Speed kit`, `AssertionError`, esperaba arreglo `[1,8]`. Resolver discrepancia contrato/datos. |
| `equipment-effects-standard.yml` | 5/5 recientes fallidas. [Ejecución](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/40215925481): `Equipment cannot remove an already-owned attack from its deck`. Contrato de deck/efectos roto o test desactualizado; comparar contra reglas canónicas antes de actualizar test. |
| `combat-results-acceptance.yml` | 4/4 recientes fallidas. [Ejecución](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/40218382881): emulador interrumpe con `ENCOUNTER_XP_RECEIPTS_REQUIRED`; el otro job de NPC sí pasó en esa ejecución. Arreglar cierre de combate/recibos XP, no esconder el error. |
| `firebase-rtdb-loot-rules.yml` | 3/3 recientes fallidas. [Ejecución](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/40215713560): emulador falla también con `ENCOUNTER_XP_RECEIPTS_REQUIRED`; job de despliegue omitido. Este YAML tiene un **deploy real a luminous-system** en `main` tras pasar la validación; no eliminar ni alterar sin revisión separada. Algunos `permission_denied` de pruebas negativas pueden ser esperados y no son, por sí solos, la causa determinante. |
| `player-inventory-runtime-validation.yml` | [Ejecución PR 1045](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/40218383033): prueba de navegador `toHaveCount(0)` obtuvo `1` en `Inventory runtime ownership tests`. Se necesita corregir DOM/expectativa con la UI actual. |
| `dm-inventory-grant-gui.yml` | [Ejecución PR 1045](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/40218382946): Playwright `toHaveCount(0)` obtuvo `1` en tests de inventario DM. Se cruza con la regresión de inventario; evaluar consolidación posterior. |

Estas ejecuciones históricas sirven de diagnóstico, no se afirma que el proyecto completo esté roto ni que un test verde garantice funcionamiento perfecto.

## D. Importadores de iconos: conservar como utilidades, consolidar después (7)

- `import-barbarian-archetype-icons.yml`
- `import-class-icons.yml`
- `import-fighter-archetype-icons.yml`
- `import-milestone-choice-icon.yml`
- `import-stat-icons.yml`
- `import-stat-skill-icons.yml`
- `import-trait-family-icons.yml`

Estos YAML se orientan a ramas de importación y/o `workflow_dispatch`; varios instalan Pillow, descargan íconos PNG y realizan commits automáticos de assets. **No son la causa de las ráfagas de checks de PR de main.** No los quitamos sin antes sustituir el flujo de importar, validar y actualizar iconos. Propuesta futura: un único importador manual paramétrico, sin push automático a ramas hardcodeadas, y eliminar estos siete por separado.

## E. Validaciones con valor que se conservan (45)

Estas verificaciones cubren motores activos, reglas de clases, combate, tienda, cocina, UI, reglas y/o assets. Conservar el propósito del test no implica que cada YAML deba quedar separado: hay candidatos a jobs agrupados una vez se reparen los fallos. Se leyó su definición, pero **no se ejecutaron las 45 suites** en esta auditoría.

- `armor-validation.yml`
- `barbarian-class-runtime-smoke.yml`
- `battle-master-superiority-smoke.yml`
- `beast-cr0-runtime.yml`
- `build-equipment-decks.yml`
- `cantrip-validation.yml`
- `class-runtime-manifest.yml`
- `combat-encounter-start.yml`
- `combat-player-interaction-visual.yml`
- `combat-v073-live-smoke.yml`
- `combat-victory-cr-xp.yml`
- `cooking-validation.yml`
- `dm-combat-library-manager-smoke.yml`
- `dm-combat-visual-evidence.yml`
- `dm-live-session-entry.yml`
- `dm-local-item-manager-v3.yml`
- `dm-player-editor-regression.yml`
- `economy-contracts-v2.yml`
- `enchanter-firebase-emulator-validation.yml`
- `enemy-target-runtime-contract.yml`
- `equipment-enhancement-validation.yml`
- `firearm-weapon-validation.yml`
- `game-engine-validation.yml`
- `item-icon-assets-validation.yml`
- `native-enemy-physical-profiles.yml`
- `path-of-the-zealot-smoke.yml`
- `phone-directory-p2p.yml`
- `player-combat-theatre-lifecycle.yml`
- `player-menu-icons-validation.yml`
- `player-progression-tree-smoke.yml`
- `player-signature-skills-smoke.yml`
- `player-skill-deck-manager.yml`
- `player-stat-skill-icons-smoke.yml`
- `player-stats-ability-icons-smoke.yml`
- `ranged-weapon-validation.yml`
- `rule-reference-ui-smoke.yml`
- `shield-validation.yml`
- `shop-standard-presets.yml`
- `theatre-check-unified-smoke.yml`
- `trait-check-power-smoke.yml`
- `trait-family-icons-smoke.yml`
- `unified-spells-playback.yml`
- `unified-weapon-skill-compatibility.yml`
- `universal-unit-decks.yml`
- `weapon-upgrade-validation.yml`

## Próxima fase recomendada

1. Reparar **el contrato compartido de XP/loot** que rompe dos workflows; luego los tests de equipamiento/deck e inventario DM/jugador. No suavizar asserts sin entender la regla canónica.
2. Agrupar suites rápidas por dominio (combate, jugador, loot/inventario, game engine) sin perder cobertura; mantener browser/E2E pesados condicionados a cambios pertinentes y opcionalmente manuales.
3. Unificar siete importadores de íconos bajo una sola utilidad `workflow_dispatch` tras validar que todos los PNG canónicos están en el repo.
4. Revisar artefactos y límites de retención de los demás suites de Playwright. Evitar enviar grandes capturas cuando no cambian interfaces.
5. Mantener el despliegue de Firebase separado del acto de validar un PR y sujeto a autorización y comprobaciones de seguridad; no desplegar producción como efecto colateral de una limpieza de CI.

**Resultado de esta fase:** reducción del ruido no pertinente sin eliminar pruebas funcionales que detectan errores actuales. La revisión de Codex y los checks del PR podrán aportar evidencia adicional después de la entrega, conforme a la regla GH-01.
