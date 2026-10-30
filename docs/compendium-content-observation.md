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

## Observation Level existente

La implementación actual está en `combat/source/combat-v073-live.html`:

- Hechos: `hp`, `sp`, `speed`, `action`, `targeting`, `resistances`, `equipment`.
- `observationKnown` conserva los hechos revelados en la unidad del encuentro. La lógica existente puede compartirlos entre unidades de la misma facción y `observationGroup`; no es por sí misma un registro persistente individual del personaje.
- El nivel se deriva del número de hechos: 0–1 hechos → nivel 1; 2–3 → nivel 2; 4–5 → nivel 3; 6 → nivel 4; los 7 → nivel 5.
- HP, SP, velocidad, resistencias y equipo se analizan con Percepción; acción y objetivo con Insight. Se conservan los modificadores y dificultades existentes, la resolución de 5 Coins y el límite actual de Analyse como acción gratuita una vez por turno.

No se añade XP de observación, un segundo contador, otra fórmula ni un desbloqueo global por nivel. Los nuevos textos no modifican `observationKnown`, `observationGroup`, `observationDifficulty` ni el motor de combate.

### Contrato para la futura integración de la ficha

La ficha debe consultar el **hecho concreto** autorizado; un nivel numérico por sí solo no permite decidir qué dato conoce el jugador. Por ejemplo, nivel 3 puede haberse obtenido sin descubrir resistencias. No revelar esas resistencias basándose únicamente en el nivel.

Observation Level 5 cubre los siete hechos del sistema actual. No equivale a saber todos los Traits, conjuros, técnicas, historia ni anatomía. Los lanzamientos/técnicas observados y los Traits activados mantienen evidencia específica; la identificación y los descubrimientos corporales siguen procesos propios. Historia no concede una observación de combate. Consultar información aprendida no ejecuta una tirada.

Esta integración de autorizaciones y persistencia aún no se activa en el prototipo; tampoco se presentan los nuevos textos de lore/anatomía como conocimiento ya adquirido por un jugador.

## Publicación y límites

Los nuevos exports contienen el texto para la biblioteca y para las futuras publicaciones de Units. Los registros ya guardados exclusivamente en Firebase no reciben una migración automática en este PR: deben actualizarse por el flujo autorizado de biblioteca conservando las modificaciones del DM. No se ejecuta una escritura sobre la campaña ni se sobrescriben sus datos.

Se mantiene el comportamiento productivo actual de Historia, que usa `basicDescription` cuando una tirada resulta exitosa. Separar la descripción visible sin tirada del contexto obtenido por Historia sigue siendo trabajo de integración del menú; no se afirma que ese cambio esté desplegado.

## Verificación local

Pruebas temporales de los cinco catálogos: 35 fichas completas, rutas de contenido válidas, persistencia del texto en firebasePayload, getters independientes, descripción de Historia sólo en éxito y comparación de todos los campos anteriores sin alteraciones mecánicas. Se verifica sintaxis de catálogos y controlador del prototipo. Las pruebas temporales no se incorporan al repositorio, conforme al README.

Este pase no rediseña el layout ni declara completada la validación visual TX-01 pendiente del prototipo, su conexión multiusuario o las reglas de identificación propuestas.
