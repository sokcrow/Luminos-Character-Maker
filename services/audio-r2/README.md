# Activar canciones y efectos propios en Limbus

Los archivos se guardan en un bucket R2 privado; **no se guardan en Git ni en
Realtime Database**. R2 conserva el archivo y sus metadatos. Firebase guarda la
configuración pública del servicio, el indicador de cambios de biblioteca y las
órdenes compartidas de reproducción. No se necesitan Functions ni claves de
servicio Firebase para este backend.

## 1. Cuenta y espacio

1. Crea tu cuenta en https://dash.cloudflare.com/sign-up y verifica el correo.
2. En el panel, abre **R2 Object Storage** y activa R2. Cloudflare puede solicitar
   configurar facturación. El titular debe revisar y aceptar ese paso en su cuenta.
3. Desde una computadora con Node, abre esta carpeta y ejecuta:

```sh
npm install
npx wrangler login
npx wrangler r2 bucket create limbus-audio
```

La autenticación ocurre con Cloudflare en tu navegador. Nunca pegues contraseñas,
tokens API ni archivos de credenciales en el chat, el repositorio o Firebase.
El bucket debe permanecer privado: no activar acceso público ni r2.dev.

## 2. Configurar el servicio

`wrangler.jsonc` incluye el proyecto y la URL pública de Firebase existentes.
Confirma que sean los del juego. En `ALLOWED_ORIGINS` escribe el origen real del
sitio, sin rutas ni barra final. Se admiten varios orígenes separados por comas.
El valor inicial `https://sokcrow.github.io` debe cambiarse si el juego utiliza
otro dominio. No usar `*`.

Genera una clave aleatoria de al menos 32 caracteres, por ejemplo con:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put AUDIO_SIGNING_KEY
```

Pega la clave únicamente en la entrada privada que abre Wrangler. Después:

```sh
npm run deploy
```

Guarda la dirección HTTPS `https://limbus-audio.<tu-cuenta>.workers.dev` que
entrega Cloudflare. La clave de firma se guarda como secreto del Worker. El
código accede a R2 mediante un binding; no hay claves R2 en el frontend.

## 3. Autorizar reproducción y conectar Music Director

Antes de utilizar canciones propias, despliega las reglas RTDB revisadas del PR
por el procedimiento habitual del proyecto. Este cambio **no las despliega**.

Entra como DM en Limbus → Director → Ambiente → Mis archivos → Conectar
biblioteca. Pega la dirección del Worker y guarda. Se guarda en
`campaña/config/audio_service_url` (la configuración se resuelve dentro del
encuentro cuando se utiliza un encuentro aislado).

Selecciona **Canciones**, **Ambientes** o **Efectos de sonido**, elige uno o
varios archivos y pulsa **Subir archivos**. Se muestran el progreso y los
resultados por archivo. Un archivo idéntico se reutiliza, incluso si se elige
otro nombre/tipo; conserva su nombre y tipo original. Para cambiar de tipo,
elimínalo y vuelve a subirlo cuando no esté seleccionado en reproducción.

Después de confirmar una subida, todos reciben la revisión de biblioteca por
Firebase. Canciones/ambientes se reproducen en sus canales de bucle y los efectos
usan el canal puntual existente. Cada participante mantiene sus volúmenes.

## Límites y comportamiento

- Máximo **25 MiB por archivo**. MP3, OGG, WAV, FLAC y M4A: extensión en cliente,
  cabecera binaria en servidor. El navegador debe soportar el códec del archivo;
  validar el contenedor no equivale a transcodificar ni inspeccionar cada pista.
- El indicador muestra cantidad y bytes de archivos de esa biblioteca, no una
  factura. **No se impone un límite global de almacenamiento o de gasto.** R2 y
  Workers tienen cuotas/facturación propias; configurar alertas en la cuenta.
- Sólo el DM autorizado sube o elimina. Los participantes autenticados pueden
  obtener el catálogo y reproducir. Un encuentro aislado exige membresía y su DM.
- El servidor consulta Firebase con el ID token de la sesión. Firebase valida
  ese token y aplica sus reglas antes de confiar en sus claims. Sin autenticación
  válida o sin respuesta de Firebase, la operación falla sin escribir en R2.
- Los enlaces de reproducción están firmados y duran una hora; no contienen
  tokens Firebase. Se renuevan al refrescar/abrir la biblioteca, periódicamente o
  al fallar una carga. Quien reciba un enlace puede usarlo hasta su expiración;
  no se debe presentar como DRM ni como una URL permanentemente privada.
- Seek y reproducción usan rangos HTTP. La reconexión conserva el reloj común;
  no reproduce el último efecto de una sesión anterior.
- Para eliminar una canción o ambiente seleccionado, primero pulsa **Detener**.
  El servidor comprueba el estado compartido y bloquea la eliminación si sigue
  referenciado, incluso en pausa. No constituye una transacción distribuida entre
  Firebase y R2: otros clientes DM no deben reproducir simultáneamente una pista
  que están eliminando.
- Cancelar detiene la subida actual; los archivos anteriores ya confirmados
  permanecen guardados. Un reintento de un archivo completo no crea duplicados.
- Las bibliotecas se separan por campaña/encuentro; una copia subida a cada
  encuentro ocupa espacio por separado.

## Verificación

Desde la raíz del repositorio:

```sh
node tests/audio-r2-worker-smoke.mjs
node tests/audio-r2-client-smoke.mjs
```

El segundo requiere `jsdom@26.1.0`. Ambos usan R2/Firebase en memoria: comprueban
bytes reales, rol DM, membresía, rechazo de falsos audios/tamaño, duplicados,
firmas, expiración, rangos, alta desde UI, biblioteca y reproducción entre
clientes simulados, efectos únicos y eliminación bloqueada/permitida.

El workflow incluye esas pruebas y la UI en seis viewports TX-01. Las capturas
se publican como artefactos cuando el navegador las complete. No se ha activado
ni desplegado Cloudflare desde esta conversación; falta la comprobación real en
la cuenta del titular y la escucha de un archivo real en dos dispositivos.

## Cuando la subida falla

El Worker devuelve mensajes distintos para configuración incompleta, consulta a
Firebase, recepción del archivo, consulta/escritura en R2 y preparación del enlace.
El formulario conserva ese mensaje junto al nombre del archivo. Un fallo de R2
no confirma ni descarta por sí solo que una operación interrumpida alcanzara a
guardar: comprobar el catálogo antes de reintentar; los reintentos completos se
reutilizan por contenido.

En el Worker deben existir `FIREBASE_DATABASE_URL` con la URL HTTPS de Realtime
Database, `FIREBASE_PROJECT_ID` con `luminous-system`, el binding R2 `AUDIO_BUCKET`
y el secreto `AUDIO_SIGNING_KEY`. Un texto o variable llamado `AUDIO_BUCKET` no
sustituye al binding del bucket. La configuración del repositorio activa
observabilidad; el registro propio de errores inesperados contiene únicamente una etapa fija,
sin copiar excepciones crudas que puedan contener tokens o URLs privadas.

**Fusionar el PR o publicar GitHub Pages no actualiza el Worker.** Estos mensajes
y la observabilidad se activan después de desplegar `services/audio-r2` en la
cuenta Cloudflare autorizada (`npm run deploy`) o actualizar y publicar el código
del Worker desde su panel, manteniendo los bindings y secretos existentes.
Si se actualiza el código desde el panel, activar allí también los registros
cuando se necesiten; copiar el código no aplica la configuración de Wrangler.
No volver a crear el bucket ni abrirlo al público. Las pruebas en memoria no
verifican la configuración ni los permisos de la cuenta live.
