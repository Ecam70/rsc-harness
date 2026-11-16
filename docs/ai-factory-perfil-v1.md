# Perfil coordinado del tablero — protocolo 1

La adaptación permite renombrar IDs sin perder reglas ni historial y evita que el ejecutor lea un registro y unas reglas de revisiones diferentes. Se entrega junto con la rama `codex/arranque-nativo-y-proyectos` de AI Factory Dashboard. No instala una aplicación ni migra un perfil operativo por sí sola.

`revisar.py --capacidades` devuelve `protocoloPerfil:1`, `aliases:true` y `reglasExternas:true`. El ejecutor sigue pudiendo usarse sin que la web esté abierta. Lee UTF-8, toma `proyectos.json.lock`, comprueba la ausencia de transacción y barreras pendientes, obtiene ID vigente, UID, ubicación, segmento, revisión y regla, y libera el bloqueo antes de llamar a Codex. Un intento empezado conserva ese contexto aunque se renombre o cambie una regla después.

Antes de iniciar un intento compara la identidad del directorio con la registrada o con la última captura de esa misma ubicación y segmento. Una carpeta sustituida en la misma ruta provoca `FOLDER_REPLACED`: no llama al agente ni emite recibo. Confirmar el cambio de carpeta desde el tablero permite usar la nueva identidad. Una identidad antigua desconocida no se inventa.

Los recibos conservan el formato v1. Añaden opcionalmente `proyecto_uid`, `ubicacion`, `segmento`, `revision_perfil` y `reglas_sha256`. Un recibo antiguo permanece legible y no se reescribe.

Con `--reglas`, el archivo externo se lee completo una vez. Se resuelven excepciones bajo ID actual o alias. Elecciones iguales son compatibles; elecciones diferentes para el mismo paso producen `RULE_ALIAS_CONFLICT`. Una lectura corrupta o ilegible aborta, sin sustituirla por la general ni modificar el externo.

El alta usa `scripts/lib/dashboard-perfil/`, una copia byte a byte del núcleo del tablero y su plantilla. Mantiene la respuesta `{id,existente}`, rechaza IDs reservados y colisiones sin distinguir mayúsculas, conserva alias de activos y retirados y publica registro/reglas/metadata con diario. La migración del registro antiguo es idempotente y conserva copia original. Los archivos de un proyecto nunca se mueven ni se borran.

El bloqueo contiene `{version:1,pid,token}`. Python espera hasta dos segundos si está ocupado y no lo roba. Un diario pendiente produce `RECOVERY_REQUIRED`; el consumidor JS compatible recupera bajo bloqueo o se niega ante una copia alterada. `proyectos.json.lock.recovery` y `<perfil>.migration.lock` impiden consumir una recuperación parcial. Un registro con campos gestionados sin estado.json no se trata como legado.

Una lectura sin cambios reutiliza su captura y huella inmutables. La referencia admite `comprobadaEn`, fecha opcional de la última comprobación correcta; si falta, se usa `fecha`. Un cambio de contenido crea otra captura y conserva la anterior.

Las copias antiguas de estas herramientas no participan en el protocolo. No deben combinarse con cambios concurrentes del tablero. Windows queda pendiente; estos ensayos se han ejecutado en macOS y no prueban bloqueos ni permisos de Windows.

Validación focal:

```sh
node --test tests/dashboard-alta.test.js tests/dashboard-perfil.test.js
python3 tests/dashboard-perfil_test.py
```

El tablero aporta `pruebas/contrato-eam.mjs /ruta/a/este-checkout`: comprueba paridad del núcleo y fixtures, exclusión JS↔Python, alias, reglas externas, contextos congelados y recuperación. Sólo debe anunciarse compatibilidad para el par de revisiones realmente probado. Al cambiar el núcleo, actualizar ambas copias y repetir el ensayo.
