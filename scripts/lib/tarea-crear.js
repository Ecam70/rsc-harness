import { link, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';

const idValido = id => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
const enUnaLinea = valor => typeof valor === 'string' && valor.trim() && !/[\r\n]/.test(valor);

async function carpetaFichas(carpeta, crear) {
  let dir = await realpath(carpeta);
  for (const parte of ['02-DOCS', 'wiki', 'ftd']) {
    dir = join(dir, parte);
    if (crear) await mkdir(dir, { recursive: true });
    if (await realpath(dir) !== dir) throw new Error('La carpeta de fichas contiene un enlace.');
  }
  return dir;
}

async function buscarFicha(dir, id) {
  let nombre;
  for (const archivo of await readdir(dir, { withFileTypes: true })) {
    if (!archivo.isFile() || !archivo.name.endsWith('.md')) continue;
    const ficha = (await readFile(join(dir, archivo.name), 'utf8')).replaceAll('\r\n', '\n');
    if ((parseFrontmatter(ficha).id || basename(archivo.name, '.md')) !== id) continue;
    if (nombre) throw new Error('Identificador de tarea repetido.');
    nombre = archivo.name;
  }
  return nombre;
}

export async function crearTarea(id, titulo, carpeta = process.cwd()) {
  if (!idValido(id) || !enUnaLinea(titulo)) throw new Error('Uso: rsc tarea crear ID "Título en una línea"');
  const dir = await carpetaFichas(carpeta, true);
  if (await buscarFicha(dir, id)) throw new Error('La tarea ya existe.');
  const nombre = id.toLowerCase() + '.md';
  const fuente = '02-DOCS/wiki/ftd/' + nombre;
  const entrada = { id: 'entrada', paso: 'entrada', intento: 1, estado: 'En cola', fecha: new Date().toISOString(), fuente };
  const texto = ['---', 'type: ftd', 'version: 1', 'id: ' + id, 'status: queued', '---', '# ' + titulo.trim(), '', '## Transiciones', JSON.stringify(entrada), ''].join('\n');
  const temporal = join(dir, '.' + randomUUID());
  await writeFile(temporal, texto, { flag: 'wx' });
  try { await link(temporal, join(dir, nombre)); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('La ficha ya existe.');
    throw error;
  } finally { await unlink(temporal); }
  return fuente;
}

export async function registrarIntento(tarea, movimiento, paso, numero, estado, fuente, carpeta = process.cwd()) {
  const intento = Number(numero);
  if (!idValido(tarea) || !idValido(movimiento) || !enUnaLinea(paso) || !enUnaLinea(estado)
      || !enUnaLinea(fuente) || !Number.isSafeInteger(intento) || intento < 1) {
    throw new Error('Uso: rsc tarea intento TAREA MOVIMIENTO PASO NÚMERO ESTADO FUENTE');
  }
  const dir = await carpetaFichas(carpeta, false);
  const nombre = await buscarFicha(dir, tarea);
  if (!nombre) throw new Error('No se encontró la tarea.');
  const ruta = join(dir, nombre);
  const bloqueo = ruta + '.lock';
  try { await writeFile(bloqueo, String(process.pid), { flag: 'wx', mode: 0o600 }); }
  catch (e) {
    if (e.code === 'EEXIST') throw new Error('Otra escritura de esta ficha está en curso. Reintenta cuando termine.');
    throw e;
  }
  const temporal = join(dir, '.' + randomUUID());
  try {
    const ficha = await readFile(ruta, 'utf8');
    const salto = ficha.includes('\r\n') ? '\r\n' : '\n';
    const lineas = ficha.split(salto);
    const inicio = lineas.findIndex(linea => /^## Transiciones[ \t]*$/i.test(linea));
    let posicion = lineas.length;
    const datos = { id: movimiento, paso, intento, estado, fuente };
    if (inicio < 0) {
      lineas.push('', '## Transiciones', '');
      posicion = lineas.length - 1;
    } else {
      const siguiente = lineas.findIndex((linea, i) => i > inicio && /^#{1,2} /.test(linea));
      const fin = siguiente < 0 ? lineas.length : siguiente;
      const movimientos = lineas.slice(inicio + 1, fin).filter(l => l.trim()).map(l => JSON.parse(l));
      const previo = movimientos.find(m => m.id === movimiento);
      if (previo) {
        if (Object.entries(datos).every(([k,v]) => previo[k] === v)) return 'Movimiento ya registrado.';
        throw new Error('El ID de movimiento ya existe con otros datos.');
      }
      posicion = fin;
      while (posicion > inicio + 1 && !lineas[posicion - 1].trim()) posicion--;
    }
    lineas.splice(posicion, 0, JSON.stringify({ ...datos, fecha: new Date().toISOString() }));
    await writeFile(temporal, lineas.join(salto), { flag: 'wx', mode: (await stat(ruta)).mode & 0o777 });
    await rename(temporal, ruta);
    return 'Movimiento registrado.';
  } finally {
    try { await unlink(temporal); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    finally { await unlink(bloqueo); }
  }
}
