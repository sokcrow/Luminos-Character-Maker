# Rendimiento de Players: mejora parcial medida

La versión retenida es `5b2d5699955c4c6b6f961c0336364421773a3a88`, comparada con `cbba1548679606ed67a2d875ba27060920764dd1` dentro de la misma ejecución ABBA.

[Prueba completa en GitHub Actions](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/40454473278). El artefacto `combat-nine-before-after` contiene raw.json, summary.json, CSV, capturas y ambos gráficos: antes/ahora y picos por fase.

| Métrica | Antes | Después |
| --- | ---: | ---: |
| Desfase absoluto P95 de Clash frente al DM | 257,985 ms | 216,300 ms |

Reducción observada: 41,685 ms (16,16%). **No cumple el objetivo estricto de menos de 100 ms.** El workflow falla por presupuesto de rendimiento; ese resultado es correcto y no se relaja.

## Trabajo conservado

- Aplicación inmediata del estado canónico del DM y actualización visual agrupada de unidades/campos modificados, con vaciado antes de presentar el cue.
- Base visual DOM compartida para DM y Players; WebGL conserva flechas y efectos, y deja de redibujar cuando no hay efectos activos durante combate.
- Actualización del HUD agrupada por frame, conservando los cues y las poses inmediatas.
- Agrupación de triángulos consecutivos del mismo color en menos llamadas GPU, conservando geometría, colores y orden.
- Un solo ritmo de combate, sin selector ni multiplicadores de velocidad. Se conservan las animaciones y Coins.

La prueba de nueve sesiones completó las cuatro rondas. En las dos rondas candidatas se observaron 3.168/3.168 presentaciones de Players, sin omisiones, duplicados, muestras RAF ausentes ni resultados diferentes. Las 36 muestras de inicio de Clash incluyeron cámara, foco y movimiento esperados en los nueve visores. Las comprobaciones de Coin/poder/ganador y estado final coinciden con el DM.

## Picos que siguen pendientes

| Fase candidata | Desfase absoluto P95 |
| --- | ---: |
| hitMotion | 355,440 ms |
| hitCoin | 338,295 ms |
| clashContact | 223,575 ms |
| powerEnd | 218,870 ms |
| powerCoin | 218,255 ms |
| clashOutcome | 217,175 ms |
| actionApproach | 191,025 ms |
| clashDefeat | 144,535 ms |
| clashEnd | 80,600 ms |
| clashStart | 52,860 ms |

El primer RAF tras iniciar la presentación es una oportunidad de pintar; no certifica el instante de escaneo de pantalla. Nueve contextos Chromium aislados comparten un runner CI de cuatro núcleos. No son nueve dispositivos físicos ni una medición WAN. Los percentiles de fases no se suman.

## Experimento descartado

Se retira el recorte del framebuffer de `7824b935c20b6573282cf4dcdbfd01ee55393bbf`: la [prueba de equivalencia de píxeles](https://github.com/sokcrow/Luminos-Character-Maker/actions/runs/40457453351) detectó ocho canales RGBA diferentes en una escena con DPR 1,5. Su benchmark completo no se ejecutó y no hay mejora de latencia acreditada para ese experimento.

La restauración conserva el árbol de código medido de `5b2d569` y añade únicamente este informe. PR en borrador, sin merge ni despliegue; no se declara verde.
