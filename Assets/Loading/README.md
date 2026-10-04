# Loading Screen Art Brief

La pantalla de carga usa fondos aleatorios desde esta carpeta.

## Reglas para todos los fondos

- Formato recomendado: **2560x1440, 16:9, WebP**.
- El archivo debe ser **solo arte**: sin texto, sin porcentaje, sin barra, sin logotipos y sin UI dibujada.
- Deja el **tercio derecho con contraste más bajo** para que el consejo sea legible.
- Evita detalle crítico en la **esquina inferior izquierda**, donde vive la barra segmentada.
- El foco principal funciona mejor en el centro o centro-izquierda.
- Estética: fantasía urbana oscura + sci-fi industrial + surrealismo, con iluminación dramática.
- El código añade por sí mismo viñeta, scanlines, tip, progreso y estado de carga.

## Fondos requeridos

### loading-combat-clash.webp

Escena de combate urbano en pleno impacto. Dos siluetas enfrentadas en una calle destruida o azotea industrial; chispas, polvo y líneas de energía. Composición dinámica pero con el tercio derecho oscuro y relativamente limpio. Sin números ni HUD.

### loading-workshop-crafting.webp

Taller industrial-alquímico. Mesa de trabajo con herramientas, piezas mecánicas, frascos, componentes extraños y una fuente de calor o luz ámbar. Una figura trabajando de espaldas o en silueta. Ambiente cargado de humo y maquinaria.

### loading-lizalin-biodistrict.webp

Distrito húmedo biotecnológico. Arquitectura curva, vegetación integrada con tuberías y estructuras sintéticas, condensación, vapor y agua reflectante. Una figura reptiliana discreta recorriendo el lugar. Sensación de ciudad que está viva.

### loading-yuanti-obscurum.webp

Interior monumental oscuro y elegante. Arquitectura serpentina, piedra negra, metal, oro envejecido y luz ritual. Una figura humanoide de rasgos serpentinos observando desde una escalinata o balcón. Frío, jerárquico y ceremonial.

### loading-lanae-mountain.webp

Asentamiento de gran altitud. Nieve, roca, pasarelas y viviendas iluminadas con luz cálida entre una tormenta fría. Una figura cornuda y lanuda con capa mirando el enclave desde una cornisa. Contraste entre comunidad cálida y montaña hostil.

### loading-city-backstreets.webp

Callejón de una megaciudad bajo lluvia. Carteles luminosos desenfocados, estructuras verticales enormes, cables, vapor, basura y reflejos en el suelo. Una o dos siluetas pequeñas para enfatizar escala. Sensación de peligro cotidiano.

### loading-abnormality-containment.webp

Sala de contención clínica-industrial. Cristal grueso, luces de emergencia y una presencia imposible detrás de niebla, estática o líquido. No mostrar completamente a la criatura; la silueta debe generar inquietud. Mucho espacio negativo.

### loading-interdistrict-transit.webp

Viaje entre zonas de una ciudad gigantesca. Tren, autobús o transporte elevado atravesando estructuras colosales, puentes y luces lejanas. Puede verse una figura desde dentro mirando por una ventana. Sensación de distancia y transición.

## Integración

Los nombres anteriores están registrados en `PLAYER_LOADING_SCENES` dentro de `hoja_personaje.js`.

Si un archivo todavía no existe o no carga, el loader conserva un fondo de respaldo y continúa funcionando. Cuando al menos uno de estos archivos exista, el sistema intentará usar uno aleatoriamente en cada carga.
