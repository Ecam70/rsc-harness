import test from 'node:test';
import assert from 'node:assert/strict';
import {intentosDeTarea} from './asignaciones.mjs';

test('un recibo citado por otra ficha se atribuye solo al proyecto y tarea ejecutados',()=>{
  const tarea={id:'X'};
  const r={proyecto:'B',tarea:'X',intento:'uno',paso:'revision',agente:'codex',solicitado:'m1',confirmado:'m2'};
  const proyectos=[{proyecto:'A',tareas:[{id:'verificacion',recibos:{prueba:{primero:r,siguiente:{...r,intento:'dos',confirmado:null}}}}]}];
  assert.equal(intentosDeTarea(proyectos,'A',tarea).length,0);
  const intentos=intentosDeTarea(proyectos,'B',tarea);
  assert.deepEqual(intentos.map(i=>[i.modeloPrevisto,i.modeloUsado??null]),[['m1','m2'],['m1',null]]);
});
