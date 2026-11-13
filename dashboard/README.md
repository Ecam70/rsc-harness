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

Las reglas están en dashboard/reglas-modelos.json. Se leen una vez al inicio de cada intento. La excepción del proyecto tiene prioridad para el paso revision. El recibo JSON se imprime en la salida estándar; el código 2 indica que el identificador del modelo recibido no se pudo confirmar o difiere del solicitado. Los recibos solo contienen datos seleccionados y huellas. El texto completo del diagnóstico del proceso no forma parte del recibo.
