---
type: plan
title: Plan de implementación de la primera entrega de la AI Factory
description: Recorrido local, conexión con el ejecutor y verificación con dos proyectos.
tags: [sdd, plan]
topic: sdd
slug: ai-factory-primera-entrega
status: approved
---

# Plan de implementación · aprobado el 13 de noviembre de 2026

[Especificación aprobada](../specs/ai-factory-primera-entrega.md) · [Constitución v1.0.0](../constitution.md)

## Diseño propuesto

Construir el dashboard en una carpeta propia del fork. Un servicio Node.js accesible desde el equipo del usuario servirá las tres vistas. Leerá únicamente las fichas y las evidencias permitidas de los proyectos seleccionados. La interfaz consultará los datos al abrirse y los actualizará mientras esté abierta. La configuración y el último estado conocido se conservarán localmente al cerrar y volver a abrir la web.

El primer recorrido usará una tarea real. Antes de diseñar las pantallas, comprobar qué datos ofrece su ficha y cómo inicia el ejecutor una revisión. Para cada intento nuevo se necesitan una identidad estable (proyecto, tarea, paso e intento), horas de espera, inicio y fin cuando correspondan, resultado, enlace a la fuente y elección de agente y modelo. Los movimientos que falten se registrarán donde ocurran. Las lecturas repetidas deben reconocer el mismo movimiento. Para el historial anterior, un campo sin fuente se verá como «Sin registrar».

Al comenzar un paso, el ejecutor consultará la excepción del proyecto y, en su ausencia, la regla general. Guardará la elección en ese intento. Al devolver el resultado, informará por separado de qué agente y modelo puede acreditar. Un ajuste posterior se aplicará al siguiente inicio. Si el ejecutor carece de una vía para aplicar la elección, habrá que resolver esa conexión antes de dar por terminada la función. La prueba de las dos combinaciones exige evidencia de ejecución.

## Tareas en orden y comprobaciones

| ID | Trabajo | Depende de | Se comprueba cuando… |
|---|---|---|---|
| T001 | Elegir A y B, una tarea real de A y su prueba de cierre. Revisar las fuentes y la forma de invocar el paso de revisión. | — | Una muestra identifica qué datos existen, cuáles faltan y cómo comprobar las dos combinaciones disponibles. |
| T002 | Registrar proyectos y leer sus fichas y referencias desde el servicio local. | T001 | Se distinguen tareas de A y B aunque compartan nombre. Solo se leen fuentes de proyectos elegidos. Una pérdida de acceso conserva la última lectura fechada. |
| T003 | Registrar las transiciones y reconstruir el historial de cada intento. | T002 | Una revisión fallida y su repetición aparecen en orden. Releer la ficha no duplica intentos. Una fecha ausente se muestra como «Sin registrar». |
| T004 | Conectar la elección de agente y modelo al inicio real del paso y recoger el resultado del ejecutor. | T001, T003 | Dos revisiones ejecutadas acreditan la regla general en A y la excepción en B. Cambiar una regla durante un intento conserva la asignación anterior. |
| T005 | Construir el tablero y el detalle de tarea. | T003 | Los filtros, las colas y los tiempos coinciden con los registros. Se puede abrir la espera más antigua con fecha y localizar una decisión pendiente. La entrega enlaza con su prueba y la cancelación cuenta aparte. |
| T006 | Construir la vista de configuración y mostrar la elección prevista y el uso registrado en el detalle. | T004, T005 | Desde la web se guardan ambas reglas y se ve su origen. Tras reabrir se mantienen. La ausencia de confirmación se indica explícitamente. |
| T007 | Probar el recorrido completo y las condiciones comunes. | T006 | Pasan los seis pasos de la especificación con A y B y sus comprobaciones complementarias. Se puede navegar con teclado. Las vistas y el historial excluyen claves y conversaciones privadas. |

## Evidencia de entrega

Entregar las referencias de la tarea de A, la revisión fallida y su repetición, los registros de ejecución de ambos proyectos y la prueba final. Contrastar la duración de la espera con las horas registradas. Anotar los tiempos observados antes de proponer límites de rendimiento. Los cambios de implementación se revisarán en ramas y pull requests con las comprobaciones en verde.

## T001 · Recorrido de referencia (en curso)

**Proyecto A confirmado:** este fork. La tarea real elegida para la demostración es T002, «Registrar proyectos y leer sus fichas y referencias desde el servicio local». Se dará por entregada al poder abrir dos tareas con el mismo nombre en proyectos diferentes y conservar la última lectura fechada si se pierde acceso a uno. Deberán quedar vinculados el resultado de la prueba y el cambio revisado. Registrar su entrada y los intentos desde el comienzo de T002.

**Proyecto B confirmado:** demostración independiente, con repositorio propio y ficha B-001 en 02-DOCS/wiki/ftd/revision-demo.md. La rama main de B parte del commit 03c895d.

| Fuente contrastada | Dato disponible | Dato que queda por registrar |
|---|---|---|
| [PR #3](https://github.com/Ecam70/rsc-harness/pull/3) | Apertura a las 11:25:20 UTC del 13 de noviembre de 2026, dos comprobaciones satisfactorias e integración a las 11:28:03 UTC. | La apertura de la PR no fecha la entrada en cola. Las comprobaciones de GitHub tampoco identifican el modelo que revisó el cambio. |
| [Formato de la ficha FTD](../../../../skills/ftd/SKILL.md) y [especificación aprobada](../specs/ai-factory-primera-entrega.md) | Rama, objetivo, estado de la ficha, lista de trabajo, siguiente paso y referencias a evidencias. El plan aporta el identificador T002. | Inicio y fin de espera, paso e intento, bloqueo y resultado de cada revisión. Identificar la tarea por proyecto e ID. |
| [Protocolo de selección de modelos](../../../../skills/asdd/references/model-routing.md) y ayuda local de Codex | El protocolo admite selección orientativa; el ejecutor Codex instalado admite elegir modelo y emitir eventos. | Distinguir modelo pedido y confirmado para cada intento. La selección y el texto generado por el agente no prueban qué modelo atendió la ejecución. |

**Dos combinaciones candidatas para revisión:** Codex con gpt-6.1-sol (general) y Codex con gpt-6-astra (excepción de B). Ambos nombres figuran en el catálogo local. Para comprobarlas en T004 se asociará cada revisión a su proyecto, tarea e intento; se contrastará la asignación con el identificador del modelo devuelto por el ejecutor o proveedor para esa ejecución. Si la salida disponible solo refleja la petición, se mostrará «Sin registrar» y la comprobación seguirá pendiente. Conservar únicamente identificadores y resultados necesarios, sin transcripciones.

### Prueba de los ejecutores · 13 de noviembre de 2026

Se ejecutaron dos revisiones documentales independientes con Codex CLI 0.167.0-alpha.4.1, en modo de solo lectura. Se proporcionó el texto de la ficha o del plan. Ambas terminaron correctamente. A localizó el criterio de cierre de T002 y B identificó B-001 y su criterio. Estos intentos de T001 son pruebas de la fuente de datos; la ejecución de T002 y la demostración del dashboard siguen pendientes.

| Intento | Modelo solicitado y anotado por el ejecutor | Inicio y fin UTC | Huella SHA-256 del identificador de turno | Modelo servido confirmado |
|---|---|---|---|---|
| T001-A-01 | Codex / gpt-6.1-sol | 11:31:58 – 11:32:03 | 7bc77dbf0bbc81517d63ce74790b1424b03536dacf57267ab730a6d44b4a1d04 | Sin registrar |
| T001-B-01 | Codex / gpt-6-astra | 11:31:58 – 11:32:04 | c48c9715ed83c36213b989f7cc1949223d38be79a303a360c3cb61821561d6e1 | Sin registrar |

**Cómo reproducir el contraste.** En los registros locales de esos intentos, calcular SHA-256 del texto UTF-8 del identificador de turno, sin salto de línea. Unir el contexto del turno con el evento de finalización por ese identificador. El campo de modelo del contexto coincide con el parámetro de arranque. El evento de finalización aporta el intervalo y el resultado. En estos dos turnos no se encontró un campo de respuesta que identifique independientemente el modelo servido. La salida pública de este documento conserva solo las huellas y los datos de la tabla.

**Criterio para T004.** Conservar por intento la asignación y el recibo de la respuesta del proveedor que identifique el modelo utilizado, vinculados por el identificador de respuesta y el turno. Si intervienen varias respuestas, asociarlas por separado al intento. Verificar el recibo en una ejecución real del adaptador antes de marcar el modelo como confirmado. El valor solicitado, la ausencia de un aviso de cambio de modelo y la declaración del propio asistente son insuficientes. Hasta disponer de ese recibo, el tablero mostrará el modelo solicitado y «Sin registrar» en el campo de uso confirmado.
