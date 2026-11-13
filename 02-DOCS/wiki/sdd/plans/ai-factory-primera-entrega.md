---
type: plan
title: Plan de implementación de la primera entrega de la AI Factory
description: Recorrido local, conexión con el ejecutor y verificación con dos proyectos.
tags: [sdd, plan]
topic: sdd
slug: ai-factory-primera-entrega
status: draft
---

# Plan de implementación · pendiente de revisión

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
