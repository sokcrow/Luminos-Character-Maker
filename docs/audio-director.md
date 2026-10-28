# Audio de campaña · Luminous

La página de login ya usaba música, ambiente y voces. El nuevo motor
`js/luminous-audio-director.js` mantiene dos canales de volumen por
navegador: **Música** y **Efectos de sonido** (incluye voces y ambientes).
Ambos se guardan en `localStorage` y nunca se escriben en Firebase.

## Uso en el juego

- Jugador: Hoja de personaje → menú lateral → **Sonido**. En el visor de
  combate abierto por separado el control aparece en un botón flotante.
- Director: **Sonido**, botón flotante del panel DM, ON GAME o visor
  independiente. Puede reproducir/detener música, activar/silenciar
  ambiente y emitir efectos puntuales a todos los clientes conectados.
- Browser: si el audio remoto no comienza por restricciones de autoplay,
  abrir **Sonido** y pulsar **Activar audio**. Un control remoto nunca
  puede omitir por sí solo las políticas de reproducción del navegador.

## Datos y autoridad

- RTDB: `campaña/audio_director/music`, `ambience`, `cue`.
- El Director es el único escritor: UID configurado en
  `campaña/config/dm_uid` o UID bootstrap existente del proyecto.
- `music` y `ambience` son estados duraderos con `startedAt` basado
  en `ServerValue.TIMESTAMP`; las conexiones tardías buscan una posición
  acorde al tiempo del servidor. `cue` es un evento puntual con nonce;
  el último evento guardado **no se reproduce** al entrar. También se descartan efectos con más de cinco segundos de antigüedad al recuperar la conexión.
- En encuentros aislados se usa `campaña/encuentros/{id}/state/campaña/audio_director`, con permisos del DM y membresía del propio encuentro.
- Los volúmenes son preferencias personales independientes del estado
  compartido. La UI no revela UID, tokens ni datos de depuración.
- Los iframes de combate embebidos heredan el soundtrack de la página
  que los contiene para evitar mezcla duplicada.
- **Desplegar `database.rules.json` junto con el código**: sin esas
  reglas el DM no podrá escribir el estado de audio compartido.

## Ampliar la biblioteca

Registrar únicamente archivos existentes bajo `Assets/Audio/` en
`LIBRARY.music`, `LIBRARY.ambience` o `LIBRARY.sfx` del motor.
Añadir los IDs nuevos a las validaciones de
`database.rules.json > campaña > audio_director` en el mismo PR.
No usar URLs externas arbitrarias ni inventar audios de demostración.
El catálogo inicial usa el tema instrumental del login, el ruido del bus
y los dos sonidos de moneda ya versionados.

## Comprobaciones

```bash
node tests/luminous-audio-director-smoke.mjs
node tests/luminous-audio-responsive.mjs
```

La segunda prueba usa Playwright/Chromium y comprueba tanto DM como
jugador en 360×800, 390×844, 844×390, 768×1024, 1280×720 y
1920×1080. La prueba valida panel y volumen sin emitir audio real ni
escribir en la campaña.


## Integración con Director de Teatro (2026-10-28)

Se reutiliza el runtime del PR #1048 (cerrado sin fusionar, commit
`9830d0da25be4d934c72667fd17b2e658b5d5134`). No se crea otro motor de audio.
El botón Ambiente abre Music Director en una superficie independiente; cerrarlo
no detiene los dos canales. Música conserva `trackId` al pausar, con
`active: false`, `startedAt: 0` y `positionMs`. Reanudar reconstruye el inicio
según el reloj compartido. Detener vacía `trackId`. Las reglas incluidas
permiten ese estado pausado y validan un desplazamiento no negativo.

El catálogo sigue siendo el de los archivos registrados: una pista musical,
un ambiente y dos efectos. No se ofrecen favoritos, importación, listas,
reproducción aleatoria ni archivos ficticios. Los efectos del DM sólo se
reproducen después de confirmarse su escritura. Las preferencias son personales.

Las reglas están en el PR; **no se desplegaron**. La sincronización remota
requiere desplegarlas por el procedimiento habitual después de revisar el cambio.

## Archivos propios con R2

La ampliación de biblioteca está en `js/audio-cloud-library.js` y
`services/audio-r2/`. Añade Mis archivos para subir canciones, ambientes y efectos
mediante la sesión del DM. Los binarios y metadatos están en R2 privado, no en el
repositorio. Firebase mantiene las órdenes y `library_revision` para refrescar el
catálogo compartido. El motor de audio continúa siendo único.

Esta ampliación reemplaza la limitación de catálogo fijo descrita en la sección
anterior **cuando se configure el servicio**. Sin dirección de Worker siguen
funcionando únicamente las pistas registradas, y la subida aparece deshabilitada
con un acceso contextual a Conectar biblioteca. No se simula una subida local ni
se presenta un blob: como archivo compartido.

Activación, comandos, secretos, límites y pruebas:
[services/audio-r2/README.md](../services/audio-r2/README.md).
