# Contenido del Compendio y Observation Level

Se añade texto editorial original en español para las 35 criaturas/variantes de los catálogos actuales. Se conservan sus IDs y nombres canónicos. No se inventan facciones nombradas, poderes, recursos recuperables, cantidades ni umbrales de combate. Las referencias generales a regiones, periferias y asentamientos sitúan el contenido en Limbus sin asignar a una especie una conducta moral o afiliación única.

## Cobertura

| Catálogo | Fichas | Aspecto | Contexto | Comportamiento | Estudio corporal |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bestias CR 0 | 24 | 24 | 24 | 24 | 24 |
| Kobolds | 5 | 5 | 5 | 5 | 5 |
| Goblins | 2 | 2 | 2 | 2 | 2 |
| Lobos | 2 | 2 | 2 | 2 | 2 |
| Arañas de zafiro | 2 | 2 | 2 | 2 | 2 |
| Total | 35 | 35 | 35 | 35 | 35 |

## Una fuente de contenido

- `basicDescription`: aspecto exterior. Lo leen el prototipo y el lector de descripción existente de loot-knowledge-runtime.
- `lore.context`: contexto narrativo e información general de la criatura en Limbus.
- `lore.behavior`: comportamiento cualitativo; no sustituye las definiciones de combate.
- `compendium.knowledge`: referencias por `contentPath` a los textos de lore y competencia propuesta para futuras consultas. No duplica esos textos ni concede descubrimientos. Contexto usa Historia; comportamiento usa Naturaleza, Historia o Arcanos según el contenido. No se añaden consultas de Religión a criaturas sin contenido religioso.
- `compendium.bodyStudy`: texto de estructura corporal preparado para un descubrimiento de anatomía. La competencia es Medicina para cuerpos biológicos y Arcanos para las arañas minerales. No cambia los contratos de extracción, cosecha ni autopsia.

El contenido se incorpora a `DEFINITIONS`, `get`, `list` y `firebasePayload` de cada catálogo, sin nueva dependencia de carga ni un catálogo paralelo de criaturas. El texto está congelado en las definiciones; los getters siguen devolviendo copias independientes.

Skills, Spells y Traits conservan sus definiciones canónicas, incluidos poderes, condiciones y efectos. Este pase no escribe otra descripción mecánica que pueda desfasarse de ellas.

## Observation Level y progreso individual

La integración actual se describe en [Progresión y activación](compendium-progression.md). Los siete hechos siguen siendo `hp`, `sp`, `speed`, `action`, `targeting`, `resistances`, `equipment`. Cero hechos corresponde a nivel 0; uno a 1; dos–tres a 2; cuatro–cinco a 3; seis a 4; siete a 5. No se añade XP.

El DM registra cada Analyse exitoso en `campaña/compendium_progress/{playerId}/units/{unitId}` con identidad canónica y deduplicación. Los flags compartidos antiguos no conceden conocimiento individual. Cada nivel da +3% de daño directo y una elección persistente de rama: materiales, dinero u objetos más valiosos. Cada elección suma 10%, con cinco elecciones totales. Enemigo predilecto garantiza nivel efectivo mínimo 3 mediante el matcher real de Ranger.

La ficha consulta hechos concretos; nivel 3 no implica conocer resistencias. Nivel 5 no descubre automáticamente Skills, Spells, Traits, historia ni anatomía. Esos desbloqueos requieren evidencia propia; el puente específico de habilidades y hechizos sigue pendiente.

## Publicación y límites

Los nuevos exports contienen el texto para la biblioteca y para las futuras publicaciones de Units. Los registros ya guardados exclusivamente en Firebase no reciben una migración automática en este PR: deben actualizarse por el flujo autorizado de biblioteca conservando las modificaciones del DM. No se ejecuta una escritura sobre la campaña ni se sobrescriben sus datos.

La UI productiva muestra aspecto físico tras un encuentro válido o Enemigo predilecto. Historia conserva una consulta separada para el contexto narrativo. La referencia visual del Bestiario sigue aislada; todavía no sustituye el menú productivo.

## Verificación local

Pruebas temporales de los cinco catálogos: 35 fichas completas, rutas de contenido válidas, persistencia del texto en firebasePayload, getters independientes, descripción de Historia sólo en éxito y comparación de todos los campos anteriores sin alteraciones mecánicas. Se verifica sintaxis de catálogos y controlador del prototipo. Las pruebas temporales no se incorporan al repositorio, conforme al README.

Este pase no rediseña el layout ni declara completada la validación visual TX-01 pendiente del prototipo, su conexión multiusuario o las reglas de identificación propuestas.
