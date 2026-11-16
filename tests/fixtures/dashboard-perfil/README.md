# Contrato de perfil 1

Fixtures sintéticos compartidos con el consumidor EAM. Las pruebas copian `gestionado/` a una carpeta temporal y sustituyen `raiz` por una carpeta del ensayo. No usan el perfil operativo del usuario.

- `leerEstado` conserva revision 7, uid, segmento e ID Nuevo. El alias A resuelve al mismo proyecto.
- Revisión con reglas del perfil: origen proyecto, modelo especial-fixture.
- Reglas externas bajo A: origen proyecto, modelo especial-externo; no se escribe el externo.
- Reglas externas contradictorias: RULE_ALIAS_CONFLICT, no llamada al agente.
- Snapshot: proyectos.json + reglas-modelos.json + estado.json se leen bajo el mismo bloqueo.
- `estado.json`: version=1, protocoloConsumidor=1, revision, perfilId, retirados, lecturasActuales, lecturasHistoricas. La revision sólo cambia con configuración.

## Bloqueo

`proyectos.json.lock` se crea exclusivamente con modo 0600 y JSON UTF-8 `{version:1,pid:<entero>,token:<UUID>}`. Un consumidor también reconoce el formato antiguo de PID decimal, pero no lo roba si el proceso está vivo. PID desconocido, EPERM o contenido incompleto: ocupado. El propietario borra sólo el bloqueo cuyo contenido sigue siendo suyo.

`proyectos.json.lock.recovery` serializa la recuperación de un dueño comprobado muerto. Si existe, un consumidor externo se niega con RECOVERY_REQUIRED; no lo elimina. Los consumidores que esperan lo hacen antes de entrar en su sección crítica. Un consumidor puede no recuperar y devolver un error explícito: nunca lee un conjunto con diario pendiente.

`<perfil>.migration.lock` bloquea lectores durante adopción/reversión, incluso si el dueño murió. Se comprueba antes y después de tomar proyectos.json.lock. Contiene `{version:1,pid,token,planId,accion}`. Sólo el proceso propietario puede atravesarlo; un consumidor externo devuelve RECOVERY_REQUIRED. La recuperación explícita de migración conserva esa barrera hasta restaurar el conjunto completo.

## Diario

`transaccion.json` contiene `{version:1,id:<UUID>,fase:'preparado'|'confirmado',archivos:[...]}`. `archivos` tiene, en ese orden, proyectos.json, reglas-modelos.json y estado.json. Cada entrada tiene `{nombre,antes,despues}`. `antes` puede ser null si no existía; en otro caso ambos son `{archivo:'transacciones/<id>/antes-<nombre>'|'.../despues-<nombre>',sha256:<hex>}`.

Se escriben y sincronizan las copias, después el diario preparado, los tres destinos mediante temporal+rename y fsync, y finalmente el diario confirmado. Se retira el diario después de confirmar. Preparado recupera todo antes; confirmado recupera todo después. Primero se comprueban todas las copias y sus huellas; ninguna recuperación usa rutas arbitrarias. Las copias permanecen conservadas.

## Lecturas

Copias JSON inmutables en `lecturas/v1/<uid>/<uuid>.json`, con referencia de huella y procedencia. `leerLecturas` devuelve contenido público más `archivo`, `sha256`, `historica`. Incluye retirados sin consultar sus carpetas. `atribuciones` opcional conserva la interpretación de recibos cruzados en el momento de captura. Los recibos originales no se reescriben.

Una captura tardía sólo pasa a actual si uid, ubicacion, segmento y raiz siguen coincidiendo; identidadDirectorio también coincide cuando estaba confirmada. Con identidad declarada null se conserva esa incertidumbre sin impedir una primera captura. Publicar no aumenta revision. Migrar una captura antigua no inventa identidadDirectorio: conserva null.
