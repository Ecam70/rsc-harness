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
