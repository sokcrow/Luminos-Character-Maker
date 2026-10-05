# Loading Screen Art

La pantalla de carga de Jugador y DM usa un pool compartido de fondos, con tips distintos según la superficie.

## Reglas de arte

- Resolución recomendada: **2560×1440, 16:9**.
- El archivo debe ser **solo arte**: sin texto, porcentaje, barra, logos ni HUD dibujado.
- Deja el **tercio derecho relativamente limpio** para el tip.
- Evita información crítica en la **esquina inferior izquierda**, donde vive la barra segmentada.
- El foco principal funciona mejor en centro o centro-izquierda.
- La UI añade viñeta, scanlines, tip, progreso y estado de carga.

## Pool activo

| Archivo local | Origen | Aparición |
| --- | --- | ---: |
| `loading-combat-clash.png` | https://imgur.com/haWXQhp.png | 18% |
| `loading-workshop-crafting.png` | https://imgur.com/zbr096W.png | 14% |
| `loading-lizalin-biodistrict.png` | https://imgur.com/N2YXVUr.png | 12% |
| `loading-yuanti-obscurum.png` | https://imgur.com/mSzXSqz.png | 12% |
| `loading-lanae-mountain.png` | https://imgur.com/JUUc6Ye.png | 12% |
| `loading-city-backstreets.png` | https://imgur.com/Xt7V809.png | 18% |
| `loading-abnormality-containment.png` | https://imgur.com/AmAaJ7M.png | 14% |

**Total: 100%.**

## Resolución de assets

El loader intenta cada escena en este orden:

1. `Assets/Loading/<archivo>.png`.
2. Si el archivo local todavía no existe o no carga, usa el URL de origen registrado para esa misma escena.
3. Si tampoco carga el origen, intenta la siguiente escena del queue ponderado.
4. Si ninguna funciona, conserva el fondo general de respaldo.

Esto permite introducir los PNG locales sin tener que volver a tocar la lógica de aparición.

## Selección ponderada

La primera escena del queue se elige usando `weight`, por lo que los porcentajes anteriores representan la probabilidad objetivo de aparición en una carga normal. Después se construye un orden ponderado sin reemplazo para que, si una imagen falla, el fallback no favorezca siempre al mismo fondo.

Jugador y DM comparten los mismos porcentajes y fondos. Los textos y consejos sí son específicos para cada superficie.
