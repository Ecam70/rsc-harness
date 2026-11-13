# Prueba de aceptación de la AI Factory · 13 de noviembre de 2026

Se recorrieron los seis pasos de la [especificación](../specs/ai-factory-primera-entrega.md) en Chrome con dos proyectos locales. A es este fork. B es el proyecto independiente ai-factory-demo-b. La prueba usó una copia temporal de la configuración y ejecutó las revisiones con Codex CLI.

| Paso | Qué se observó |
|---|---|
| 1. Entrada | La [tarea A/T007](../../ftd/t007.md) consistía en entregar una [guía](../../../../dashboard/recorrido.md) para abrir el tablero y consultar la evidencia de una tarea. Apareció en Entrada en la vista conjunta y al elegir A. Al elegir B desapareció. |
| 2. Elección | Desde la web se guardó Codex con gpt-6.1-sol para revisión general y gpt-6-astra como excepción para B. La vista de configuración indicó el origen de cada elección. |
| 3. Cola | Se abrió T007 desde la espera más antigua. Entró a las 14:44:29 UTC y pasó a ejecución a las 14:46:21.625 UTC. Esperó 112,625 segundos. El [primer recibo](../../ftd/evidencias/t007/A1.json) confirma el modelo general. |
| 4. Fallo y corrección | La primera guía omitía cómo consultar la evidencia. La tarjeta apareció en decisiones pendientes con el motivo y el operador de la demostración como responsable. El operador reanudó la tarea. La [segunda revisión](../../ftd/evidencias/t007/A2.json) también falló. Se conservó la huella del resultado, pero el comprobador se interrumpió antes de guardar la hora de fin y el modelo. Tras otra corrección la tercera revisión aprobó la guía. |
| 5. Salida | Chrome mostró una sola entrega de T007 y tres filas de revisión en su detalle. Desde la ficha se abrió el [recibo de cierre](../../ftd/evidencias/t007/A3.json), con el veredicto APROBADA y el modelo confirmado. El recibo archivado conserva el texto de la guía revisada. |
| 6. Revisión de B | Con la regla general de nuevo en gpt-6.1-sol, [B/B-001](../../ftd/evidencias/t007/B.json) ejecutó su excepción gpt-6-astra. El historial de A conservó la elección de su primer intento. |

Se canceló una ficha auxiliar y se comprobó en Chrome el motivo y el contador de cancelaciones. Un recibo antiguo de B mostró «Sin registrar». Al retirar temporalmente el acceso a A, el tablero mantuvo la última fecha de A y permitió abrir B. Se restauró el acceso. Con Tab y Enter se abrió la configuración desde el tablero. La [lectura de la demostración](../../ftd/evidencias/t007/comprobaciones.json) registra las comprobaciones finales.

En una prueba adicional se guardó un cambio desde la web durante un turno activo. El [par de recibos](../../ftd/evidencias/t007/cambio-verificado.json) confirma gpt-6.1-sol durante ese turno y gpt-6-astra en el intento inmediatamente siguiente. Las horas del cambio, de fin y de inicio permiten comprobar el orden.

Se introdujeron marcadores ficticios en el cuerpo de una ficha temporal y en campos privados de su recibo. Chrome mostró el veredicto público. Los marcadores quedaron fuera del tablero, del detalle y de los registros de proyectos, historial y evidencia. Después se retiró la ficha.

## Repetir el contraste con los registros

Tras separar los repositorios, abre una terminal en [ai-factory-dashboard](https://github.com/Ecam70/ai-factory-dashboard). Con A y B activos en el servicio local, ejecuta:

    node pruebas/comprobar-aceptacion.mjs http://127.0.0.1:4319 /ruta/al/fork-rsc-harness-EAM
    npm test

El primer comando contrasta las fichas publicadas por el servicio con los recibos guardados. Para repetir el recorrido en vivo, usa una tarea nueva en A, guarda las dos reglas desde la web y sigue los seis pasos de la especificación. Para revisar el texto de la guía, el ejecutor admite una consigna por entrada estándar mediante la opción --consigna-stdin.
