// Cada línea de la sección Transiciones es un movimiento observado por quien ejecuta la tarea.
export function reconstruirIntentos(ficha) {
  const seccion = ficha.split(/^## Transiciones[ \t]*$/im)[1]?.split(/^#{1,2} /m)[0];
  const intentos = new Map();
  const movimientos = new Map();
  for (const linea of (seccion || '').split('\n').filter(linea => linea.trim())) {
    const { id, paso, intento, estado, fecha = null, fuente } = JSON.parse(linea);
    if (![id, paso, estado, fuente].every(campo => typeof campo === 'string' && campo.trim())
        || !Number.isSafeInteger(intento) || intento < 1
        || (fecha !== null && (typeof fecha !== 'string' || !Number.isFinite(Date.parse(fecha))))) {
      throw new Error('Movimiento incompleto');
    }
    const movimiento = { id, paso, intento, estado, fecha, fuente };
    const firma = JSON.stringify(movimiento);
    if (movimientos.has(id)) {
      if (movimientos.get(id) !== firma) throw new Error('Movimiento contradictorio');
      continue;
    }
    movimientos.set(id, firma);
    const clave = JSON.stringify([paso, intento]);
    if (!intentos.has(clave)) intentos.set(clave, { paso, intento, movimientos: [] });
    intentos.get(clave).movimientos.push(movimiento);
  }
  return [...intentos.values()];
}
