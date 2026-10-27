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
