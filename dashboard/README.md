# AI Factory

La web y el servicio local se mantienen en [Ecam70/ai-factory-dashboard](https://github.com/Ecam70/ai-factory-dashboard). Allí se arranca el tablero con `npm start`.

Esta carpeta conserva la [guía histórica revisada en T007](recorrido.md). La [prueba de aceptación](../02-DOCS/wiki/sdd/aceptacion/ai-factory-primera-entrega.md) enlaza sus recibos.

## Ejecutar una revisión desde el fork

Desde la raíz del fork, este ejemplo revisa la ficha T007 del proyecto A con las reglas de tu equipo e imprime el recibo JSON:

    python3 scripts/ai-factory/revisar.py "$HOME/Library/Application Support/ai-factory-t002/proyectos.json" A T007 t007.md

Para conservar un recibo nuevo, guarda la salida en el proyecto de la tarea. Las reglas y los campos se describen en el [formato compartido v1](../docs/formato-ai-factory-v1.md).
