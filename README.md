# Luminos-Character-Maker

Luminous Character Maker.

## Abrir el combate

La entrada directa es [combate.html](combate.html), con la misma cuenta que las fichas. El DM puede abrir un encuentro, añadir personajes y enemigos desde **Encuentro**, resolver las acciones elegidas por los jugadores y finalizar con un resultado. El Centro de Mando y el panel del DM también enlazan esta entrada.

`npm run package:combat-release` prepara las páginas, recursos, reglas y un manifiesto de integridad para publicar la versión integrada. No despliega ni modifica la campaña. Consulta [acceso y publicación](docs/combat-phase6-playable-release.md).

## Política de pruebas

El repositorio no mantiene una suite de tests permanente. Cuando una tarea necesite validación automatizada, los tests se crean de forma temporal para esa implementación o corrección y se eliminan antes de completar el cambio. No deben agregarse tests, workflows de test ni dependencias de testing persistentes al repositorio.
