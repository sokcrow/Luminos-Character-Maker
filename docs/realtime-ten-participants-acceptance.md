# Aceptación de tiempo real: 1 DM y 9 jugadores

## Evidencia local, 26 de octubre de 2026

`node tests/combat-ten-participants-realtime-smoke.mjs` ejecuta los módulos reales
de pasos, transporte de presentación y consumo en diez contextos JavaScript:
un DM y nueve jugadores. La red y el reloj son simulados; no son navegadores
autenticados ni una prueba de carga de Firebase.

- 80 intercambios, conexiones con demora de hasta 190 ms más 15 ms de variación.
- Relojes locales desajustados por minutos, corregidos con el desfase del servidor.
- Los ocho jugadores sanos presentan cada señal a menos de 150 ms del DM.
- Un jugador con una pausa de 2,2 segundos omite animaciones vencidas y vuelve
  al tiempo actual; conserva todos los eventos y el estado final autorizado.
- Los mensajes duplicados no repiten eventos ni finalizan el turno dos veces.
- Los nueve jugadores terminan con los mismos HP y salen de reproducción.

La prueba de recuperación existente reproduce además cancelaciones sucesivas de
la suscripción. Antes de la corrección reintentaba siempre a 350 ms. Ahora conserva
el presupuesto durante la misma ronda: 350, 1000 y 2500 ms, luego se detiene.
Una generación nueva reinicia ese presupuesto.

Se ejecutaron satisfactoriamente las 16 pruebas Node del paso
`Shared assignment and playback regressions`. La prueba de navegador del workflow
no forma parte de esta evidencia local.

## Aceptación real pendiente

Las páginas proporcionadas usan el backend compartido `luminous-system` y la raíz
`campaña`. No usar personajes de la campaña como datos desechables de carga.
Durante esta revisión, el script publicado en GitHub Pages no contenía
`scheduleViewerRecovery`; la versión publicada aún no incluía esta recuperación.

Para declarar listo el despliegue se requiere una sala/backend de prueba aislado,
la versión candidata publicada allí y diez sesiones autenticadas (1 DM + 9 jugadores).
Medir con navegadores reales, incluyendo móviles:

1. Los nueve jugadores envían READY y sus acciones; el DM resuelve una sola vez.
2. Medir desfase visual y demora de actualización de estado durante al menos
   80 intercambios; registrar p50, p95 y máximo por dispositivo.
3. Comprobar que HP, recursos, resultados y turno coinciden en todos los clientes.
4. Desconectar y reconectar un jugador; poner otro en segundo plano y regresar.
   Verificar recuperación sin recargar ni duplicar acciones.
5. Verificar autenticación, permisos, reconexión y ausencia de errores de Firebase.
6. Conservar mediciones, versión desplegada y resultados antes de aprobar la partida.

El límite de 150 ms es una aserción de la simulación bajo sus condiciones; no es
una garantía de latencia de Internet ni sustituye esta aceptación real.
