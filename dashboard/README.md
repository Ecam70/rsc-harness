# Servicio local de proyectos

Arranca el servicio desde la raíz del fork con la configuración local de T002:

```sh
d="$HOME/Library/Application Support/ai-factory-t002"
node dashboard/servicio.mjs "$d/proyectos.json" "$d/lecturas"
```

Abre http://127.0.0.1:4317/proyectos y sigue la ruta indicada en el campo `consulta` de cada tarea. La respuesta contiene el proyecto, la ficha, su fuente, la fecha de lectura y el texto de su sección «Evidencia» o «Evidence». El valor es nulo si falta la sección. Los enlaces incluidos en ese texto se conservan como referencias. Si un proyecto deja de estar accesible, el servicio devuelve la lectura guardada con su fecha original y `disponible: false`.

El archivo de configuración es una lista de objetos con `id` y `raiz` (carpeta local del proyecto). La carpeta de lecturas debe ser privada. Puedes elegir otro puerto con el tercer argumento.

## Historial por intento

El campo `historial` del listado abre los intentos de una ficha. Para registrar una transición, añade al final de su sección «Transiciones» una línea JSON con el ID estable del movimiento, paso, número de intento, estado, fuente y fecha UTC cuando conste. El orden de las líneas es el orden registrado. Una fecha nula significa «Sin registrar». Las fichas anteriores sin movimientos devuelven una lista vacía.

    {"id":"revision-2-inicio","paso":"revisión","intento":2,"estado":"en curso","fecha":null,"fuente":"acta de revisión"}

## Revisiones con selección de modelo (T004)

Desde la raíz del fork, ejecutar una revisión con la lista local de proyectos y el nombre de la ficha:

    python3 dashboard/revisar.py "$HOME/Library/Application Support/ai-factory-t002/proyectos.json" A T002 t002.md

El ejecutor lee reglas-modelos.json junto a proyectos.json. En la primera ejecución usa la plantilla dashboard/reglas-modelos.json si aún no hay reglas locales. Se leen una vez al inicio de cada intento. La excepción del proyecto tiene prioridad para el paso revision. El recibo JSON se imprime en la salida estándar; el código 2 indica que el identificador del modelo recibido no se pudo confirmar o difiere del solicitado. Los recibos solo contienen datos seleccionados y huellas. El texto completo del diagnóstico del proceso no forma parte del recibo.

## Tablero y detalle (T005)

Abre la raíz del servicio en el navegador. El filtro de proyecto conserva la identidad de las fichas. «Requieren mi decisión» selecciona estados que mencionan aprobación, decisión o intervención del usuario. La espera más antigua se calcula entre las tareas en espera con fecha conocida. El tablero consulta los cambios cada 15 segundos mientras está visible y el usuario no tiene un control enfocado.

La ficha cerrada con evidencia se muestra en Salida; una revisión superada por sí sola sigue en Verificación. Los movimientos se interpretan en el orden registrado. Un paso desconocido con nombre propio aparece en «Sin clasificar». Las fichas en curso sin movimientos aparecen en Ejecución con el paso sin registrar. La hora de lectura del proyecto nunca se usa para calcular cuánto lleva una tarea en un paso. Para cancelaciones y bloqueos se pueden declarar motivo y responsable en la cabecera de la ficha.

En el detalle se muestran la fuente, los intentos, las fechas y los registros de evidencia. Los recibos JSON referenciados bajo pruebas/ del proyecto o evidencias/ de la carpeta de fichas se presentan con una selección de sus campos.

## Agentes y modelos (T006)

Abre «Agentes y modelos» desde el tablero. Elige el ámbito y el identificador del paso y pulsa «Ver elección». Guarda la regla general o una excepción. Para eliminar una excepción, selecciona su proyecto y paso y pulsa «Volver a la regla general». El origen y la combinación efectivos aparecen encima del formulario.

Las elecciones se guardan en el equipo junto a proyectos.json. Tanto la web como el ejecutor de revisión usan ese archivo en el siguiente intento. Puedes guardar elecciones para Codex, Claude Code, Cursor y Gemini; el adaptador que ejecuta revisiones actualmente es Codex.
