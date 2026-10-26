# Inventory HUD — pruebas y límites del PR #1045

## Qué validan los workflows

- **Inventory Runtime Validation:** pruebas de catálogos, Item Runtime, equipamiento, persistencia y autorizaciones; además, pruebas de integración Playwright del inventario. El PR incorpora el HTML real del inventario y los estilos nuevos a la suite existente.
- **Inventory HUD Mobile + Desktop Acceptance:** prueba dedicada de 360×800, 390×844, 844×390, 768×1024, 1280×720 y 1920×1080. Aísla el **HTML real del menú** de `hoja_personaje.html` y carga el JavaScript/CSS de producción. Comprueba iconos PNG reales desde `LuminousItemIconRegistry`, posición personaje/ítems, ficha modal, valor y descripción, cierre X/Escape y recuperación de foco tras una actualización.
- **Smoke estructural:** detecta que la hoja cargue los archivos CSS/JS, que existan nodos del diálogo y que la imagen canónica y el fallback existan como PNG válidos.

## Lo que estos tests NO prueban

No sustituyen una sesión Firebase real de dos clientes, ni autorizan por sí solos publicar el HUD. La suite UI monta la pantalla real aislada con datos de prueba, sin credenciales ni estado remoto. Los tests del Item Runtime sí verifican puentes funcionales, pero la aceptación final en partida debe incluir abrir/cerrar, consumir, equipar, trasladar, bloquear stash y sincronización DM/jugador en móvil y desktop.

## Criterio de salida del PR

Sin conflictos de merge; ninguna aserción legacy que contradiga el diseño aprobado; suite de inventario y UI integrada; revisión de código de cambios; sin afirmar verde/merge por la mera sintaxis.
