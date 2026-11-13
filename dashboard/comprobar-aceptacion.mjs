// Contrasta el servicio registrado con los recibos de la demostración de T007.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { intentosDeTarea } from './asignaciones.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:4319';
const carpeta = new URL('../02-DOCS/wiki/ftd/evidencias/t007/', import.meta.url);
const recibo = async nombre => JSON.parse(await readFile(new URL(nombre+'.json', carpeta)));
const proyectos = await (await fetch(new URL('/proyectos', base))).json();
async function tarea(proyecto, id) {
  const p = proyectos.find(p => p.proyecto === proyecto);
  assert.ok(p?.disponible, proyecto);
  const tareas = p.tareas.filter(t => t.id === id);
  assert.equal(tareas.length, 1);
  const t = tareas[0];
  const historial = await (await fetch(new URL(t.historial, base))).json();
  return {...t, historial: historial.intentos};
}
const a = await tarea('A', 'T007');
assert.equal(a.estado, 'done');
const movimientos = a.historial.flatMap(i => i.movimientos);
const hora = id => Date.parse(movimientos.find(m => m.id === id).fecha);
assert.equal(hora('ejecucion') - hora('entrada'), 112625);
const revisiones = intentosDeTarea(proyectos, 'A', a).filter(i => i.paso === 'revision');
assert.deepEqual(revisiones.map(i => [i.intento, i.modeloUsado ?? null]),
  [[1, 'gpt-6.1-sol'], [2, null], [3, 'gpt-6-astra']]);
for (const [nombre, veredicto] of [['A1','FALLIDA'], ['A2','FALLIDA'], ['A3','APROBADA']]) {
  const r = await recibo(nombre);
  assert.equal(r.resultado_sha256, createHash('sha256').update(veredicto).digest('hex'));
  assert.equal(a.recibos['evidencias/t007/'+nombre+'.json'].veredicto, veredicto);
}
assert.equal((await recibo('A3')).guia, await readFile(new URL('recorrido.md', import.meta.url), 'utf8'));
const b = await recibo('B');
assert.equal(b.origen, 'proyecto');
assert.equal(b.confirmado, 'gpt-6-astra');
assert.ok(intentosDeTarea(proyectos, 'B', await tarea('B','B-001')).some(i => i.intento === b.intento && i.modeloUsado === b.confirmado));
const {primero, siguiente, cambio} = await recibo('cambio-verificado');
assert.ok(Date.parse(primero.inicio) < Date.parse(cambio) && Date.parse(cambio) < Date.parse(primero.fin));
assert.ok(Date.parse(primero.fin) <= Date.parse(siguiente.inicio));
for (const [r, modelo] of [[primero,'gpt-6.1-sol'],[siguiente,'gpt-6-astra']]) {
  assert.equal(r.solicitado, modelo);
  assert.equal(r.confirmado, modelo);
  assert.deepEqual([...new Set(Object.values(r.respuestas))], [modelo]);
}
console.log('A y B disponibles. Historial, cola, entrega y modelos verificados.');
