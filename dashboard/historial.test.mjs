import test from 'node:test';
import assert from 'node:assert/strict';
import { reconstruirIntentos } from './historial.mjs';

test('una revisión fallida y su repetición conservan sus movimientos originales', () => {
  const crear = (id, intento, estado) => JSON.stringify({ id, paso: 'revisión', intento, estado, fuente: 'prueba local' });
  const fallo = crear('r1-fin', 1, 'fallida');
  const ficha = ['## Transiciones', crear('r1-inicio', 1, 'en curso'), fallo, fallo,
    crear('r2-inicio', 2, 'en curso'), crear('r2-fin', 2, 'superada'), '## Evidencia', 'Resultado'].join('\n');
  const resultado = reconstruirIntentos(ficha);
  assert.deepEqual(resultado.map(i => i.movimientos.map(m => m.estado)), [['en curso', 'fallida'], ['en curso', 'superada']]);
  assert.equal(resultado[0].movimientos[0].fecha, null);
  assert.deepEqual(reconstruirIntentos(ficha), resultado);
  assert.deepEqual(reconstruirIntentos('# Ficha anterior'), []);
});
