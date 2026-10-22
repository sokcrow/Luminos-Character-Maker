# Loot Corpse · publicar permisos RTDB junto con cambios del juego

La única fuente de reglas de seguridad Realtime Database para producción es `database.rules.json`, declarada en `firebase.json`; el proyecto es `luminous-system` (`.firebaserc`).

## Por qué un jugador recibe `permission_denied`

El nuevo Loot usa rutas nuevas que no se habilitan automáticamente al desplegar HTML/JS:

- `campaña/loot_claims/<lootInstanceId>`: el dueño de un personaje participante puede reservar y liberar un cadáver; el DM puede gestionar reservas.
- `campaña/loot_requests/<playerId>/<requestId>`: el personaje autenticado, vinculado y participante puede crear **solo** una solicitud `pending`. Buscar, Sustraer, Cosechar, Extraer, Desmontar, Examinar, Autopsia y recoger pendientes están en la lista autorizada.
- `campaña/loot_instances`, `campaña/loot_postcombat` y `campaña/loot_encounters`: solo el DM modifica el loot compartido y los resultados. Un jugador autenticado los puede consultar; **no** debe modificarlos directamente.

Una edición de `database.rules.json` dentro del repositorio **no modifica** los permisos activos de Firebase hasta publicar las reglas.

## Despliegue automático protegido

`.github/workflows/firebase-rtdb-loot-rules.yml`:

1. En PR ejecuta Auth + RTDB Emulator y `tests/loot-authority-emulator.mjs`, verificando usuario participante, cuentas ajenas, reservas, peticiones e inventario.
2. En `main`, tras pasar el mismo test, publica las reglas cuando cambie `database.rules.json`, `firebase.json` o el propio workflow. Se puede lanzar manualmente desde Actions → **Firebase RTDB Loot Rules — validate and deploy**.
3. Sin credenciales produce un error explícito y **no afirma haber publicado**.

Configurar en GitHub → Settings → Secrets and variables → Actions el secret `FIREBASE_SERVICE_ACCOUNT_LUMINOUS_SYSTEM` con el **JSON completo** de una cuenta de servicio autorizada para administrar reglas de Firebase Realtime Database del proyecto `luminous-system`. Nunca commitear el JSON, ni ponerlo en frontend.

No ejecutar despliegues de reglas desde PRs o ramas no integradas.

## Despliegue manual inmediato

En una máquina autorizada con sesión de Firebase CLI y el checkout actualizado de `main`:

```sh
npm run firebase:deploy:rules
```

Eso ejecuta `npx firebase-tools deploy --only database --project luminous-system` y publica exactamente el archivo configurado. Confirmar en Firebase Console → Realtime Database → Rules o en el log de despliegue que el cambio está activo.

## Si el error continúa tras publicar

Comprobar que el usuario ya inició sesión (`auth.uid`); que `campaña/jugadores/<playerId>/uid`, `vinculado_a` o `vinculo_jugador` señale a esa cuenta; que `campaña/loot_encounters/<encounterId>/meta/participants/<playerId>` sea `true`; que `result` sea `victory` y `open` sea `true`; y que `campaña/loot_instances/<lootInstanceId>/encounterId` apunte a ese encuentro.

No permitir escritura general de Loot a cualquier cuenta autenticada: las solicitudes del jugador se resuelven por la autoridad DM.
