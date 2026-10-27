# Combate: un DM y ocho jugadores

Comparación equivalente: **sí**. Resultados y comprobaciones visuales actuales: **correctos**.

**Fluidez pendiente:** el P95 del desfase absoluto subió 31,4 ms y el tiempo entre frames subió 149,9 ms en esta medición.

| Medida (ms; menor es mejor) | Antes | Ahora | Cambio |
| --- | ---: | ---: | ---: |
| Desfase absoluto en Clashes · mediana | 54.4 | 42.6 | -11.8 |
| Desfase absoluto en Clashes · P95 | 189.3 | 220.8 | +31.4 |
| Desfase absoluto en Clashes · máximo | 243.5 | 330.8 | +87.3 |
| Retraso positivo en Clashes · P95 | 137.3 | 192.8 | +55.5 |
| Tiempo entre frames · mediana | 133.4 | 183.4 | +50.0 |
| Tiempo entre frames · P95 | 283.4 | 433.3 | +149.9 |
| Tiempo entre frames · máximo | 533.3 | 716.6 | +183.3 |

P95 indica que el 95% de las muestras queda por debajo de ese tiempo. El desfase absoluto incluye jugadores adelantados y atrasados frente al DM. El retraso positivo cuenta únicamente a los que van detrás. Un intervalo grande entre frames indica poca fluidez, aunque los eventos y resultados coincidan.

## Resultados y escena

| Versión | Comandos esperados en los ocho jugadores | Muestras con RAF | Omisiones | Duplicados | Sin muestra de pintura |
| --- | ---: | ---: | ---: | ---: | ---: |
| Antes | 3072 | 3072 | 0 | 0 | 0 |
| Ahora | 3168 | 3168 | 0 | 0 | 0 |

Las cuatro rondas verifican cada resultado mostrado de Coin, poder y ganador; HP, SP, estados y escudos coinciden con el checkpoint del DM. Los jugadores no ejecutan tiradas ni daño localmente. La versión actual exige cámara de combate, resaltado de ambos participantes y movimiento real de tokens en los nueve DOMs, incluyendo espectadores. También exige recibir y ejecutar el acercamiento de los ataques sin oposición. No es una comparación de todos los píxeles de cada frame.

## Dónde suben más los milisegundos

| Fase actual | P95 desfase absoluto | P95 recepción tras deadline | P95 cola tardía | P95 inicio a RAF |
| --- | ---: | ---: | ---: | ---: |
| clashStart | 297.5 | 2.6 | 204.3 | 243.1 |
| hitMotion | 279.8 | 0.0 | 58.3 | 334.6 |
| wait | 263.2 | 0.0 | 4.1 | 349.5 |
| hitCoin | 255.8 | 0.0 | 18.4 | 332.7 |
| hitStart | 255.8 | 0.0 | 15.2 | 335.1 |
| actionStart | 253.0 | 34.2 | 98.2 | 409.7 |
| powerEnd | 250.8 | 0.0 | 19.6 | 296.8 |
| clashOutcome | 250.8 | 0.0 | 27.8 | 286.4 |
| clashContact | 230.7 | 0.0 | 7.1 | 252.8 |
| actionApproach | 222.5 | 33.7 | 75.8 | 347.1 |
| hitsStart | 219.1 | 0.0 | 16.9 | 308.1 |
| clashDefeat | 192.6 | 0.0 | 35.5 | 242.1 |
| powerCoin | 192.0 | 0.0 | 22.6 | 269.0 |
| powerStart | 173.3 | 0.0 | 16.3 | 278.9 |
| clashEnd | 127.4 | 0.0 | 2.4 | 169.1 |

Los percentiles de componentes no se suman. La recepción es local: que los lotes lleguen antes del deadline aquí no demuestra que Internet tenga cero latencia. Inicio a RAF incluye la disponibilidad del navegador para dibujar; no es un perfil de CPU de una función concreta.

## Correcciones visuales

- El zoom del Clash sigue a los combatientes para todos los espectadores durante la resolución en vivo.
- El resaltado de participantes se aplica mediante la presentación compartida, además de los resultados.
- El acercamiento sin oposición y de Counter pasa por el canal de presentación; antes ocurría solo en el ejecutor del DM.
- Se conserva una sola velocidad fija. Los acercamientos mantienen sus duraciones normales de 520 ms y 220 ms, respectivamente.

## Alcance y evidencia

- Cuatro rondas: antes, ahora, ahora, antes. Dos rondas por versión; ocho cuentas de jugador y una DM, en nueve contextos Chromium aislados.
- Battle Viewer completo, Auth/RTDB Emulator con las reglas del repositorio, ocho acciones de jugador, dos NPC opuestos y tres Coins por Skill.
- Mismo escenario, semilla, planes, iniciativa y resultados. `actionApproach` se excluye únicamente de la equivalencia de la lista de cues porque es una nueva presentación del movimiento ya existente; no agrega reglas ni tiradas. Su barra anterior queda ausente por falta de muestra, no se sustituye por cero.
- Los sprites son SVG simples de la fixture. No se mide el coste de los assets de una campaña concreta.
- Nueve contextos comparten un runner CI; no son nueve dispositivos físicos ni conexiones WAN. Los percentiles describen este experimento y no prueban significación estadística.
- Baseline: `f4a66cddd3ea8a767f5b9614d5a2fc4e47b6d3e7`.
- Candidato de la medición: `fd1f19f55d783c0fac19e4a1475c8fe17ab412da`.
- [Ejecución y datos originales](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/40448309205). Los gráficos y el CSV entregados se calculan de sus cuatro `raw.json` con el reporter final.
- La entrega final también conserva el foco privado del modo offline; esa guardia no altera la ruta en vivo medida y tiene una prueba local específica.
- El PR permanece como borrador; no se hizo merge ni despliegue.

## Prioridad siguiente

El primer objetivo es la entrada al Clash (`clashStart`): 297,5 ms de desfase P95, 204,3 ms de cola tardía y 243,1 ms de inicio a RAF; los percentiles no se suman. Después, movimiento y Coins de impacto. Perfilar el refresco de cámara, HUD y render del escenario en esas fases, contrastando el tiempo entre frames en un teléfono y un desktop reales. Esta prueba distingue recepción, cola y oportunidad de pintar; por sí sola no identifica una función como causa de los bloqueos ni acredita fluidez en los dispositivos de la campaña.

## Archivos

- `antes-ahora.png`: desfase absoluto y tiempo entre frames.
- `picos-por-fase.png`: fases por desfase P95 y componentes actuales.
- `latency-samples.csv`: observaciones individuales, incluyendo desfase con signo.
- `summary.json`: equivalencia, cobertura, comprobaciones visuales y estadísticas.

Los datos crudos originales y las capturas permanecen en el artefacto `combat-nine-before-after` de la ejecución enlazada. El reporter final regenera desfase absoluto, cobertura visual y desglose de fases; el gráfico original de CI medía retraso positivo.
