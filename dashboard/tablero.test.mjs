import test from 'node:test';
import assert from 'node:assert/strict';
import { tablero } from './tablero.mjs';

test('el filtro de decisiones conserva el bloqueo y enlaza la espera más antigua con fecha', () => {
  const tareas = ['2026-10-02','2026-10-01',null].map((desdeEstado,i)=>({
    id:'T'+i,titulo:'Tarea '+i,estado:'in-progress',desdeEstado,
    ultimoMovimiento:{paso:'revisión',estado:'Esperando aprobación'},historial:[]
  }));
  tareas.push({id:'C',titulo:'Cancelada por el proyecto',estado:'cancelada'});
  const proyectos=[{proyecto:'A',disponible:true,tareas}];
  const html=tablero(proyectos,new URLSearchParams('vista=decisiones'));
  assert.match(html,/tarea=T1">Abrir la espera más antigua/);
  assert.match(html,/3 en espera/);
  assert.doesNotMatch(html,/Cancelada por el proyecto/);
  assert.match(tablero(proyectos,new URLSearchParams()),/0 entregadas · 1 canceladas/);
});

test('la espera más antigua respeta el filtro de decisiones y descarta una aprobación resuelta', () => {
  const tarea = (id, estado, fecha) => ({
    id, titulo:id, estado:'in-progress', desdeEstado:fecha,
    ultimoMovimiento:{paso:'revisión', estado}
  });
  const proyectos=[{proyecto:'B', disponible:true, tareas:[
    tarea('cola','En cola','2026-10-01'), tarea('consulta','Esperando decisión','2026-10-02'),
    tarea('resuelta','Aprobada','2026-10-03'), tarea('sin-fecha','Esperando aprobación',null)
  ]}];
  const html=tablero(proyectos,new URLSearchParams('vista=decisiones'));
  assert.match(html,/tarea=consulta">Abrir la espera más antigua/);
  assert.match(html,/tarea=sin-fecha/);
  assert.doesNotMatch(html,/tarea=(resuelta|cola)/);
});
