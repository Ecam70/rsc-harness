# Formato compartido de la AI Factory · versión 1

El fork escribe fichas, movimientos y recibos. El dashboard lee estos documentos y guarda las elecciones de agente y modelo. Cada proyecto conserva sus documentos en su propia carpeta. El lector admite las fichas históricas sin versión ni movimientos.

| Dato | Formato y significado |
|---|---|
| Registro local | `proyectos.json` contiene una lista JSON de objetos con `id` único y `raiz` local. La identidad de tarea es el par proyecto + ID. Una raíz accesible sin fichas es un proyecto vacío. |
| Ficha | Archivo Markdown de `02-DOCS/wiki/ftd/`. Cabecera entre líneas `---` con `type: ftd`, `id` y `status`. El primer título da el nombre visible. Para fichas antiguas se admite el nombre de archivo como ID. |
| Intentos | En la sección `## Transiciones`, cada línea es un objeto JSON con `id`, `paso`, `intento` (entero desde 1), `estado`, `fuente` y `fecha` (fecha con zona, nula o ausente). El orden escrito fija el recorrido. El ID identifica el movimiento y el par paso + intento agrupa sus movimientos. |
| Evidencia | La sección `## Evidencia` o `## Evidence` contiene referencias. Los recibos JSON pueden residir en `pruebas/` desde la raíz o en `evidencias/` desde las fichas. Un recibo histórico puede estar archivado por otro proyecto registrado. Sus campos proyecto, tarea e intento identifican a quién corresponde. |
| Recibo | Registra proyecto, tarea, paso, intento, inicio, fin, origen, agente, solicitado y confirmado según la información disponible. Puede incluir veredicto y huellas de la respuesta. Un campo desconocido aparece como «Sin registrar». Una revisión superada puede preceder al cierre de la tarea. |
| Reglas | `reglas-modelos.json`, junto al registro, contiene `general[paso]` y `proyectos[id][paso]`. Cada elección contiene `agente` y `modelo`. El ejecutor toma la excepción si existe y fija su elección al comenzar cada intento. |

El número de versión identifica este contrato. Una ampliación compatible conserva el significado de los campos anteriores. Un cambio incompatible requiere otra versión y una prueba de lectura de las fichas históricas.
