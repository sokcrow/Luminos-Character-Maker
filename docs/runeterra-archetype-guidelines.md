# Reglas de diseño para arquetipos de Runaterra

Este documento define cómo adaptar campeones, fantasías regionales y roles de League of Legends al sistema de clases y arquetipos de Luminous Character Maker.

El objetivo no es crear una subclase independiente por cada campeón, sino construir familias jugables coherentes que puedan reutilizar mecánicas, compartir identidad regional y crecer sin duplicar contenido.

## 1. Jerarquía canónica

Los arquetipos de Runaterra se diseñan con esta jerarquía:

**Clase base → Región → Arquetipo → Estilo/Doctrina**

- **Clase base** define el motor mecánico principal del personaje.
- **Región** define identidad cultural, tecnológica, mágica y temática.
- **Arquetipo** agrupa una familia de fantasías y loops de combate compatibles.
- **Estilo/Doctrina** representa una especialización interna, normalmente inspirada por uno o varios campeones concretos.

Ejemplo:

**Ranger → Aguas Turbias → Tirador de Aguas Turbias → Pistolero / Demoledor**

La región organiza la fantasía. La clase organiza la mecánica.

## 2. La región no decide la clase

Dos campeones de la misma región pueden pertenecer a clases diferentes.

La clase debe elegirse por el gameplay que queremos representar en Luminous, no sólo por la historia, arma o etiqueta del campeón.

Ejemplos posibles dentro de Aguas Turbias:

| Fantasía | Clase candidata | Arquetipo regional |
| --- | --- | --- |
| Tirador móvil, ráfagas, múltiples objetivos | Ranger | Tirador de Aguas Turbias |
| Combatiente marcial con pistola, espada, barriles o control de terreno | Fighter | Corsario de Aguas Turbias |
| Peleador resistente, agresivo o de intercambio cercano | Barbarian / Fighter | Arquetipo regional de peleador |
| Cazador, asesino, emboscador o ejecutor | Rogue | Cazador de las Profundidades |

Estos ejemplos son guías de diseño, no asignaciones obligatorias.

## 3. El rol de LoL es una pista, no una regla

Las etiquetas de League of Legends como Marksman, Fighter, Tank, Assassin, Mage o Support ayudan a identificar una fantasía, pero no se convierten automáticamente en clases de Luminous.

No se debe aplicar una tabla rígida como:

- ADC = Ranger
- Tank = Fighter
- Assassin = Rogue

Primero se analiza el loop real del campeón: alcance, movilidad, recursos, ritmo de ataque, control, defensa, preparación, combos y economía de acciones.

Un Marksman puede terminar en Fighter si su gameplay se comporta como un combatiente marcial de corto alcance. Un Fighter de LoL puede terminar en Barbarian si su identidad depende de presión, resistencia y escalado agresivo.

## 4. Agrupar campeones antes de crear arquetipos

Antes de crear un arquetipo nuevo, se intenta agrupar campeones de la misma región que compartan suficiente estructura mecánica.

Si varios campeones comparten:

- tipo de arma o alcance;
- loop principal de combate;
- economía de acciones;
- forma de generar daño o control;
- recursos similares;
- progresión compatible;

entonces deben intentar convivir dentro del mismo arquetipo mediante Estilos o Doctrinas.

Ejemplo inicial:

### Ranger — Tirador de Aguas Turbias

**Pistolero**

Inspiración principal: tiradores de múltiples disparos, rebotes, cambios de objetivo y saturación de área, como Miss Fortune.

**Demoledor**

Inspiración principal: armas pesadas de corto alcance, humo, impacto, empuje y explosiones secundarias, como Graves.

Ambos comparten una fantasía de tirador de pólvora de Aguas Turbias y pueden compartir una base de arquetipo sin convertirse en dos subclases completas.

## 5. Cuándo un campeón merece su propio arquetipo

Un campeón no recibe automáticamente un arquetipo propio.

Debe separarse cuando su adaptación requiera una arquitectura mecánica sustancialmente distinta de la familia existente.

Se considera una separación cuando aparecen una o más de estas condiciones:

1. **Recurso exclusivo** que gobierna gran parte del kit.
2. **Economía de acciones distinta** al resto de la familia.
3. **Loop de combate propio** que no puede expresarse como una mejora o doctrina.
4. **Progresión exclusiva** que obliga a reescribir varias features del arquetipo padre.
5. **Reglas centrales incompatibles** con los demás estilos del mismo arquetipo.
6. La adaptación dejaría de sentirse como una variante y empezaría a sentirse como otro sistema completo.

Un campeón con un patrón extremadamente particular —por ejemplo, una secuencia fija de disparos, un recurso exclusivo, preparación prolongada y reglas especiales para el disparo final— puede justificar un arquetipo independiente aunque comparta región y tipo de arma con otros campeones.

## 6. Qué pertenece al arquetipo y qué pertenece a Items/Crafting

El arquetipo define **cómo pelea el personaje**.

Items, Crafting y Upgrades definen **con qué equipo lo hace y cómo personaliza ese equipo**.

### Arquetipo / Doctrina

Debe contener mecánicas como:

- rebotes de disparos;
- ráfagas o cadenas de Hits;
- Aim o preparación táctica;
- humo usado como parte del loop del personaje;
- barriles y detonaciones si son parte de la identidad marcial;
- Marks;
- trampas si constituyen una mecánica central;
- counters, movement tech o control de terreno propio del estilo.

### Items / Crafting / Upgrade

Debe contener modificaciones físicas o tecnológicas como:

- miras;
- segundo cañón;
- cargadores;
- bayonetas;
- tipos de munición;
- mejoras de alcance;
- componentes Hextech;
- piezas recuperadas;
- módulos intercambiables;
- rarezas, materiales, recetas y requisitos de fabricación.

Regla práctica:

> Si quitar el objeto elimina la identidad completa del personaje, probablemente es una feature del arquetipo. Si el personaje sigue peleando igual pero con una herramienta diferente, probablemente es un Item Upgrade.

## 7. La inspiración de campeón no debe limitar el diseño

Las Doctrinas pueden inspirarse claramente en campeones, pero el arquetipo debe funcionar como una fantasía propia de Runaterra y no como una copia cerrada de una sola ficha.

Esto permite:

- combinar ideas compatibles de varios campeones;
- crear personajes originales de la misma región;
- añadir nuevas doctrinas en el futuro;
- evitar que una opción sólo tenga sentido si el jugador intenta recrear exactamente un campeón existente.

Los nombres canónicos deben priorizar la fantasía regional o marcial sobre el nombre del campeón.

Ejemplo:

- Preferir **Pistolero** sobre **Estilo Miss Fortune**.
- Preferir **Demoledor** sobre **Estilo Graves**.
- Preferir **Corsario de Aguas Turbias** sobre **Gangplank Archetype**.

El campeón se documenta como inspiración de diseño, no como requisito de personaje.

## 8. Regla de reutilización regional

Una misma región puede tener múltiples arquetipos repartidos entre distintas clases.

No se debe crear una única "subclase de Aguas Turbias" que intente representar a todos sus campeones.

Ejemplo de mapa inicial:

- **Ranger — Tirador de Aguas Turbias**: tiradores y especialistas de pólvora a distancia.
- **Fighter — Corsario de Aguas Turbias**: combate marcial híbrido, pólvora, melee y control de terreno.
- **Rogue — Cazador de las Profundidades**: emboscada, ejecución, movilidad y cacería.
- **Barbarian/Fighter — familia de peleadores de Aguas Turbias**: presión cercana, resistencia y fuerza bruta.

La misma regla se aplica después a Piltover, Zaun, Noxus, Demacia, Ionia, Shurima, Freljord, Targon, Shadow Isles y demás regiones.

## 9. Flujo de adaptación de un nuevo Homebrew o campeón

Antes de implementar código:

1. **Identificar región y fantasía.**
2. **Identificar el loop de gameplay** que se quiere conservar.
3. **Usar el rol de LoL sólo como referencia inicial.**
4. **Elegir la clase base por mecánicas.**
5. **Buscar un arquetipo regional existente compatible.**
6. Si existe, decidir si el nuevo contenido es una **Doctrina**, una nueva feature o una expansión del arquetipo.
7. Si no existe, diseñar un nuevo arquetipo regional.
8. Separar **mecánicas de personaje** de **Items/Crafting/Upgrades**.
9. Adaptar cada feature una por una al sistema Luminous: Actions, Quick Actions, Slots, Coins, Hits, Clash, Status, SP, Stagger, Movement y demás reglas relevantes.
10. Sólo después de cerrar el diseño, implementar el runtime.

## 10. Integración técnica

Los nuevos arquetipos deben usar el sistema universal de runtimes del proyecto.

Convenciones preferidas:

- `foo-archetype-runtime.js` para el runtime principal del arquetipo.
- `foo-combat-runtime.js` para adapters exclusivos de Combat cuando sean necesarios.
- `foo-theatre-runtime.js` para adapters exclusivos de Theatre cuando sean necesarios.

No se deben añadir cargas manuales específicas del arquetipo en Battle, Theatre o Status Engine.

El runtime debe entrar por el Class Runtime Manifest / Bootstrap universal y declarar sus dependencias allí cuando corresponda.

## 11. Principios de revisión

Antes de aprobar un arquetipo de Runaterra se debe poder responder "sí" a estas preguntas:

- ¿La clase base fue elegida por gameplay y no sólo por etiqueta de LoL?
- ¿La región aporta una identidad clara sin reemplazar la función de la clase?
- ¿Intentamos reutilizar un arquetipo regional antes de crear otro?
- ¿Las Doctrinas comparten suficiente estructura como para pertenecer juntas?
- ¿Las mejoras de equipo están fuera del arquetipo cuando deberían ser Items/Crafting?
- ¿El personaje puede ser original y no sólo una copia de un campeón?
- ¿Una feature inspirada en un campeón sigue siendo comprensible sin conocer a ese campeón?
- ¿El runtime puede integrarse sin hardcodes nuevos en los entrypoints principales?

## 12. Primera aplicación: Aguas Turbias

Como dirección inicial para el Homebrew de pólvora actualmente en adaptación:

### Ranger — Tirador de Aguas Turbias

Base compartida de combate a distancia con pólvora.

Doctrinas iniciales candidatas:

- **Pistolero** — múltiples disparos, rebotes, cambio de objetivos y saturación.
- **Demoledor** — arma pesada, corto alcance, impacto, humo y explosiones.

### Fighter — Corsario de Aguas Turbias

Candidato para mecánicas de pistola + melee, barriles, detonaciones, presión y control de terreno.

Las modificaciones de armas que sólo cambien el equipamiento se trasladan a Items/Crafting/Upgrades en lugar de convertirse automáticamente en Traits del arquetipo.

---

Estas reglas son la base de diseño. Cada adaptación concreta puede justificar excepciones, pero la excepción debe documentar por qué el gameplay no encaja en la jerarquía o familia existente.