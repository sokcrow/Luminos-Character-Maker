# Curse's Update — Fase A / Contrato Canónico V1

**Base:** dieciocho decisiones expresas del propietario (12 iniciales + 6 de cierre), 2026-10-12. Esta especificación gobierna el PR #978; **la implementación se entrega por tramos** y no equivale a que todos los objetivos ya tengan runtime.

## Identidad y naturaleza

Toda **Curse** implica un perjuicio real. Puede otorgar beneficios solo si también ocasiona una consecuencia adversa. Es persistente, independiente de los Status secundarios que cause, y puede existir autónoma o vinculada a otro sistema.

## Alcance y clasificación

**Cinco objetivos admitidos:** `item`, `creature`, `place`, `lineage`, `entity` (organizaciones, pactos y entidades colectivas).

**Cinco familias:** `item`, `affliction`, `binding`, `ritual`, `pact`. La familia indica la naturaleza; el objetivo indica qué se maldice. Las definiciones declaran compatibilidad explícita; no todos los objetivos aceptan todas las familias.

Los objetos mundanos pueden recibir Curse autónomas solo cuando su definición lo permita. **La Curse autónoma no consume Enchantment Slots ni Gem Sockets.** Un Enchantment con propiedad `curse` continúa sujeto a Enchanter.

## Intensidad, duración y fuente

Cada Curse define su intensidad inicial, condiciones para fortalecerse y máximo propio: no hay niveles universales para Curse autónomas. Reaplicar una Curse no implica automáticamente aumentar su intensidad ni duplicar efectos, y nunca sobrepasa el máximo definido.

**Una Curse persiste hasta una operación de purificación o ruptura explícita autorizada.** Ni la muerte del creador ni la destrucción de la fuente eliminan la instancia por sí mismas. Una definición puede usar la condición de su fuente como **requisito** para romperla, pero no para borrarla implícitamente. Dormir, pasar el tiempo, alejarse de la fuente o curar sus Status tampoco purga automáticamente la Curse.

## Defensas

Las definiciones autorizan individualmente Checks/Saving Throws, resistencias, protecciones, Traits y contramedidas rituales. No se inventa TH, DC, SP, probabilidad ni escalado global.

## Resolución

Las cinco operaciones son:

| Operación | Contrato |
|---|---|
| `remove` | Eliminación definitiva solo cuando la definición autoriza el método |
| `suppress` | Suspensión reversible de efectos; la Curse sigue existiendo |
| `break` | Ruptura explícita del vínculo según requisitos autorizados |
| `transfer` | Reubicación a otro objetivo compatible, sin crear ni destruir la Curse |
| `seal` | Contención; la Curse continúa existiendo |

Cada definición declara métodos permitidos, requisitos, irreversibilidad y posibles excepciones. Una Curse permanente puede permitir algunos métodos y prohibir otros. No existe cura universal.

Las Curse de linaje/organización/territorio admiten una instancia **colectiva** que alcanza miembros elegibles o **instancias individuales** dependientes de autoría. La salida de un grupo no borra una instancia individual persistente.

## Contrato con Enchanter

Se preservan sin alterar:

- Propiedad `curse` en Enchantment: efecto positivo autorizado x1.50; Bind mágico: x1.25.
- `bind` y `curse` permanecen **propiedades mutuamente distintas** en una misma referencia de Enchantment.
- Dificultades, ingredientes, Enchantment Slots, Gem Anchors, Attunement, Magical Durability y economía de Enchanter.
- Retirada normal bloqueada para Bind y limitaciones propias de Relics.
- Detección de una Curse, identificación de un Item y revelación de la desventaja oculta como conocimiento diferente por observador.
- El Status `bind` que modifica Speed **no** es una Binding Curse ni la propiedad de Enchantment `bind`.

## Primera implementación funcional del PR

`js/curse-runtime.js` provee un **tramo exclusivamente Item**: la definición `cursed_binding` implementa una atadura maldita que bloquea el desequipamiento sin convertirse en un Bind de Enchanter ni generar un multiplicador positivo. Las operaciones de supresión, sellado, reactivación y ruptura modifican el estado de la instancia; la transferencia está implementada en el core puro, pendiente de UI y autoridad de doble-Item. La IU del DM la edita y guarda en el Item Instance existente. Magic Runtime y Equipment Bridge leen esa instancia; Player/Battle cargan el motor.

Esta primera entrega **no autoriza inventar** penalizaciones numéricas, alquimia, pactos, aflicciones personales ni efectos ambientales sin adaptadores reales. `creature`, `place`, `lineage`, `entity` siguen dentro del **alcance del Update**, pero aún no están implementados. **Magic Loot** y el desarrollo de Relics son Updates independientes.

## Gate técnico

Cerrar tareas de ejecución solo con pruebas verdes (incluida UI real) y persistencia verificada; un commit de documentación no cierra implementación. El PR sigue Draft hasta finalizar el alcance seleccionado.
