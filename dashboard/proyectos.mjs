// Punto de entrada local de T002. La configuración y las lecturas son privadas del equipo.
import { mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseFrontmatter } from '../scripts/lib/frontmatter.js';

import { leerRecorrido } from './historial.mjs';

async function leerFichas(raiz) {
  const carpeta = join(await realpath(raiz), '02-DOCS/wiki/ftd');
  if (await realpath(carpeta) !== carpeta) throw new Error('La carpeta de fichas es un enlace');
  const tareas = [];
  const ids = new Set();
  for (const archivo of await readdir(carpeta, { withFileTypes: true })) {
    if (!archivo.isFile() || !archivo.name.endsWith('.md')) continue;
    const texto = (await readFile(join(carpeta, archivo.name), 'utf8')).replaceAll('\r\n', '\n');
    const campos = parseFrontmatter(texto);
    const id = campos.id || basename(archivo.name, '.md');
    if (ids.has(id)) throw new Error('Identificador de tarea repetido');
    ids.add(id);
    const seccion = texto.split(/^## (?:Evidencia|Evidence)[ \t]*(?:\n|$)/im)[1];
    const evidencia = seccion?.split(/^#{1,2} /m)[0].trim() || null;
    const { intentos, movimientos } = leerRecorrido(texto);
    const ultimoMovimiento = movimientos.at(-1);
    let desdePaso = null, desdeEstado = null;
    if (ultimoMovimiento) {
      const comienzo = (misma) => {
        let i = movimientos.length - 1;
        while (i > 0 && misma(movimientos[i - 1])) i--;
        return movimientos[i].fecha;
      };
      const mismoPaso = m => m.paso === ultimoMovimiento.paso && m.intento === ultimoMovimiento.intento;
      desdePaso = comienzo(mismoPaso);
      desdeEstado = comienzo(m => mismoPaso(m) && m.estado === ultimoMovimiento.estado);
    }
    const recibos = {};
    const referencias = new Set(movimientos.map(m => m.fuente));
    for (const enlace of (evidencia || '').matchAll(/\[[^\]\n]*\]\((evidencias\/[^)\s]+)\)/g)) referencias.add(enlace[1]);
    for (const ref of referencias) {
      const enFicha = /^evidencias\/(?:[\w-]+\/)*[\w-]+\.json$/.test(ref);
      if (!enFicha && !/^pruebas\/(?:[\w-]+\/)*[\w-]+\.json$/.test(ref)) continue;
      const ruta = join(enFicha ? carpeta : await realpath(raiz), ref);
      try {
        if (await realpath(ruta) !== ruta) continue;
        const dato = JSON.parse(await readFile(ruta, 'utf8'));
        // Exponer solo campos de recibos reconocidos, nunca la conversación o la entrada.
        const resumen = r => Object.fromEntries(['proyecto','tarea','paso','intento','inicio','fin','ejecutor','agente','solicitado','confirmado','modelo_solicitado','modelo_confirmado','veredicto','origen'].filter(k => Object.hasOwn(r,k) && (r[k] === null || ['string','number'].includes(typeof r[k]))).map(k => [k,r[k]]));
        const contenido = dato.primero && dato.siguiente ? { primero: resumen(dato.primero), siguiente: resumen(dato.siguiente) } : resumen(dato);
        if (Object.keys(contenido).length) recibos[ref] = contenido;
      } catch { /* Una referencia sin recibo legible conserva su nombre en la ficha. */ }
    }
    tareas.push({ recibos, historial: intentos, ultimoMovimiento, desdePaso, desdeEstado, paso: campos.paso,
      motivo: campos.motivo || null, responsable: campos.responsable || null, evidencia, id, titulo: texto.match(/^# (.+)$/m)?.[1] || id,
      estado: campos.status || 'Sin registrar', fuente: '02-DOCS/wiki/ftd/' + archivo.name });
  }
  return tareas;
}

async function refrescar(id, raiz, almacen) {
  const archivo = join(almacen, id + '.json');
  let tareas;
  try {
    tareas = await leerFichas(raiz);
  } catch {
    let anterior;
    try { anterior = JSON.parse(await readFile(archivo, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { proyecto: id, disponible: false, ...(anterior?.raiz === raiz ? anterior.lectura : { fecha: null, tareas: [] }) };
  }
  const lectura = { fecha: new Date().toISOString(), tareas };
  const temporal = archivo + '.' + randomUUID();
  await writeFile(temporal, JSON.stringify({ raiz, lectura }), { mode: 0o600 });
  await rename(temporal, archivo);
  return { proyecto: id, disponible: true, ...lectura };
}

export async function leerProyectos(config, almacen) {
  const proyectos = JSON.parse(await readFile(config, 'utf8'));
  if (!Array.isArray(proyectos) || proyectos.some(p => !/^[a-zA-Z0-9_-]+$/.test(p?.id ?? '') || typeof p.raiz !== 'string' || !p.raiz)
      || new Set(proyectos.map(p => p.id)).size !== proyectos.length) throw new Error('Lista de proyectos no válida');
  await mkdir(almacen, { recursive: true, mode: 0o700 });
  const resultado = [];
  for (const p of proyectos) resultado.push(await refrescar(p.id, resolve(p.raiz), almacen));
  return resultado;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [config, almacen] = process.argv.slice(2);
  if (!config || !almacen) throw new Error('Uso: node dashboard/proyectos.mjs proyectos.json carpeta-de-lecturas');
  console.log(JSON.stringify(await leerProyectos(config, almacen), null, 2));
}
