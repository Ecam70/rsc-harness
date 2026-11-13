// Punto de entrada local de T002. La configuración y las lecturas son privadas del equipo.
import { mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseFrontmatter } from '../scripts/lib/frontmatter.js';

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
    tareas.push({ id, titulo: texto.match(/^# (.+)$/m)?.[1] || id,
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

const [config, almacen] = process.argv.slice(2);
if (!config || !almacen) throw new Error('Uso: node dashboard/proyectos.mjs proyectos.json carpeta-de-lecturas');
const proyectos = JSON.parse(await readFile(config, 'utf8'));
if (!Array.isArray(proyectos) || proyectos.some(p => !/^[a-zA-Z0-9_-]+$/.test(p?.id ?? '') || typeof p.raiz !== 'string' || !p.raiz)
    || new Set(proyectos.map(p => p.id)).size !== proyectos.length) throw new Error('Lista de proyectos no válida');
await mkdir(almacen, { recursive: true, mode: 0o700 });
const resultado = [];
for (const p of proyectos) resultado.push(await refrescar(p.id, resolve(p.raiz), almacen));
console.log(JSON.stringify(resultado, null, 2));
