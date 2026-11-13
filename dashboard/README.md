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
