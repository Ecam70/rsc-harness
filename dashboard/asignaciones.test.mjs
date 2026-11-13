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

test('un movimiento y su recibo individual representan un único intento', () => {
  const tarea = {
    id: 'T007',
    historial: [{paso: 'revision', intento: 1, movimientos: [{fuente: 'A1.json'}]}],
    recibos: {'A1.json': {proyecto: 'A', tarea: 'T007', paso: 'revision', intento: 'uuid', confirmado: 'modelo'}}
  };
  const filas = intentosDeTarea([{proyecto: 'A', tareas: [tarea]}], 'A', tarea);
  assert.deepEqual(filas.map(f => [f.intento, f.modeloUsado]), [[1, 'modelo']]);
});
