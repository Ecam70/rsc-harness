---
type: spec
title: AI Factory — Del ingreso de una tarea a su entrega
description: Primera entrega del tablero local, el historial y la selección de agente y modelo por paso.
tags: [sdd, spec]
timestamp: 2026-11-13T11:21:57Z
topic: sdd
slug: ai-factory-primera-entrega
status: approved
---

# AI Factory · Primera entrega

**Especificación aprobada por el responsable del proyecto el 13 de noviembre de 2026.** Se rige por la [constitución v1.0.0](../constitution.md).

## Para quién y para qué

Quien coordina varios proyectos con rsc-harness necesita saber qué trabajo espera, dónde se ha detenido y qué requiere una decisión suya. Hoy puede abrir la ficha de cada proyecto y consultar sus pruebas una por una. Ese recorrido manual exige volver a reunir las fuentes cada vez que cambia una tarea y dificulta comparar las colas.

El resultado de esta entrega será una web local con tres vistas conectadas por el proyecto, la tarea y el paso. La persona elige los proyectos que incorpora. La primera demostración cubrirá un recorrido completo con tareas reales. El despliegue compartido y los objetivos de rendimiento quedan para después de medir ese uso.

## 1. Tablero de la fábrica

El usuario puede ver todos sus proyectos o filtrar uno. Las columnas son **Entrada → Preparación → Ejecución → Verificación → Salida**. Cada tarea tiene una identidad estable dentro de su proyecto, un resultado solicitado y un criterio de cierre. La tarjeta indica el proyecto, el paso concreto, el estado y el tiempo en ese paso cuando consta. Una tarea puede saltar un paso o volver a uno anterior.

Por proyecto y paso se ven las cantidades en espera y en marcha. Se puede abrir la espera más antigua que tenga fecha conocida y localizar las tareas que requieren una decisión del usuario. Una tarea bloqueada permanece en su paso con el motivo y, si se conoce, quién puede desbloquearla. Las salidas distinguen entregas con prueba de cierre y cancelaciones con motivo.

## 2. Recorrido de la tarea

Al abrir una tarjeta se ve una secuencia fechada de entradas, esperas, inicios, finales, resultados e intentos, cada uno con su fuente consultable. Una revisión fallida y su repetición se conservan como dos intentos de la misma tarea. Para el trabajo nuevo, los movimientos necesarios para reconstruir el recorrido se registran al producirse. El tiempo en cola corresponde al intervalo entre entrar en espera y empezar o salir de ella.

Cuando a una tarea anterior le falta un dato, la web muestra «Sin registrar». Si deja de estar disponible un proyecto, permanece visible el último estado conocido con su fecha y una indicación de que faltan datos recientes. Los demás proyectos siguen siendo consultables.

## 3. Elección de agente y modelo

El usuario guarda una combinación general para un paso y puede elegir otra para ese mismo paso en un proyecto. Antes de que empiece el paso puede consultar qué combinación se aplicará y si procede del proyecto o de la regla general. El ejecutor utiliza la elección vigente al empezar. Un cambio posterior afecta a los siguientes inicios, incluidas las repeticiones. El historial conserva tanto la elección prevista para el intento como el agente y el modelo que el ejecutor confirma haber usado. Si falta esa confirmación, el uso real figura como «Sin registrar».

## Condiciones comunes

El tablero funciona en el equipo del usuario y limita su lectura a los proyectos elegidos y a los registros necesarios. Las claves y conversaciones privadas quedan fuera de las vistas y del historial. Los pasos y estados se entienden por su texto. Las vistas, filtros y elecciones se pueden utilizar con teclado.

## Prueba de aceptación con dos proyectos · pendiente de ejecutar

Los nombres **A** y **B** identifican dos proyectos locales elegidos para la demostración. Usar dos combinaciones distintas de agente y modelo disponibles para el paso de revisión. Conservar las referencias a las fichas, los registros de los ejecutores y las pruebas de cierre para contrastarlas con el panel.

| Paso | Acción | Resultado comprobable |
|---|---|---|
| 1 | Registrar A y B. Dar entrada en A a una tarea real con un resultado y una prueba de cierre acordados. | La vista conjunta y el filtro de A muestran la tarea en Entrada con su identidad. El filtro de B muestra solo trabajo de B. |
| 2 | Guardar desde la web la combinación general de revisión y la excepción para B. | Al consultar la próxima revisión de A aparece la general. Para B aparece la propia. Ambas muestran su origen. |
| 3 | Dejar la tarea de A en cola y después pasarla a ejecución y a su primera revisión. | Se puede abrir desde la cola. El historial permite contrastar la espera con las horas de entrada e inicio. El registro del ejecutor confirma la combinación general en esa revisión. |
| 4 | Registrar una comprobación fallida, la espera de una decisión del usuario, la corrección y una segunda revisión. | Durante el bloqueo se ve el paso, el motivo y la decisión pendiente. Después se conserva una sola tarea con dos revisiones y el resultado de cada intento. |
| 5 | Completar la prueba de cierre acordada y entregar la tarea de A. | La tarea figura en Salida como entregada. Desde su historial se abre la prueba que acredita el resultado. La entrega se cuenta una vez. |
| 6 | Ejecutar el mismo paso de revisión en una tarea de B. | El registro del ejecutor acredita la combinación propia de B. El historial de A conserva la general. La prueba requiere comparar lo ejecutado con lo previsto en ambos proyectos. |

**Comprobaciones complementarias.** Cancelar una tarea con motivo y comprobar su contador independiente. Abrir un registro antiguo incompleto y comprobar «Sin registrar». Interrumpir la lectura de A y comprobar que su última fecha sigue visible y que B se puede consultar. Cambiar una elección durante un paso y verificar que el intento en curso conserva su asignación y el siguiente recibe la nueva.

**Criterio de entrega.** Los seis pasos se pueden reproducir y contrastar con sus fuentes. Antes de la demostración se elegirán los dos proyectos, la tarea real, su prueba de cierre y las combinaciones disponibles. Los ejemplos y capturas ayudan a explicar el recorrido. La comprobación de entrega se hace con ejecuciones registradas.
