import { readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

export function errorPerfil(code, message, status = 400, extra = {}) {
  return Object.assign(new Error(message), {code, status, retryable: false, ...extra});
}
const reservados = new Set([...Object.getOwnPropertyNames(Object.prototype), '__proto__'].map(s=>s.toLowerCase()));
export function validarId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id) || reservados.has(id.toLowerCase()) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(id))
    throw errorPerfil('INVALID_ID','El ID admite de 1 a 80 letras ASCII, números, guiones y guiones bajos; este nombre no está permitido.');
  return true;
}
const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
export function validarEleccion(eleccion) {
  return objeto(eleccion) && ['codex','claude','cursor','gemini'].includes(eleccion.agente) && typeof eleccion.modelo === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(eleccion.modelo);
}
export function validarPaso(paso) { return typeof paso==='string' && /^[a-z0-9-]{1,80}$/.test(paso) && !reservados.has(paso); }
export function validarReglas(reglas) {
  try {
    if (!objeto(reglas) || !objeto(reglas.general) || !objeto(reglas.proyectos)) throw new Error();
    for (const id of Object.keys(reglas.proyectos)) validarId(id);
    for (const grupo of [reglas.general,...Object.values(reglas.proyectos)]) {
      if (!objeto(grupo)) throw new Error();
      for (const [paso, eleccion] of Object.entries(grupo)) if (!validarPaso(paso) || !validarEleccion(eleccion)) throw new Error();
    }
  } catch { throw errorPerfil('INVALID_PROFILE','El archivo de reglas no es válido. Conserva el original y corrígelo antes de continuar.'); }
  return true;
}
export function validarRegistro(proyectos, retirados=[]) {
  try {
    if (!Array.isArray(proyectos) || !Array.isArray(retirados)) throw new Error();
    const ids=new Map(), uids=new Set();
    for (const p of [...proyectos,...retirados.map(r=>r.proyecto)]) {
      validarId(p.id);
      if (typeof p.raiz!=='string' || !isAbsolute(p.raiz)) throw new Error();
      if (p.uid !== undefined && (typeof p.uid!=='string' || uids.has(p.uid))) throw new Error();
      if (p.uid) uids.add(p.uid);
      if (p.aliases!==undefined && !Array.isArray(p.aliases)) throw new Error();
      for (const id of [p.id,...p.aliases ?? []]) {
        validarId(id); const clave=id.toLowerCase();
        if (ids.has(clave) && ids.get(clave)!==p) throw new Error();
        ids.set(clave,p);
      }
    }
  } catch { throw errorPerfil('INVALID_PROFILE','El registro tiene IDs inválidos o duplicados, alias en conflicto o rutas no absolutas. No se ha corregido automáticamente.'); }
  return true;
}
export function resolverProyecto(snapshot, idOAlias) {
  if (typeof idOAlias!=='string') throw errorPerfil('PROJECT_NOT_FOUND','Proyecto desconocido.',404);
  const clave=idOAlias.toLowerCase();
  const proyecto=snapshot.proyectos.find(p=>[p.id,...p.aliases ?? []].some(id=>id.toLowerCase()===clave));
  if (!proyecto) throw errorPerfil('PROJECT_NOT_FOUND','Proyecto desconocido.',404);
  return {proyecto,aliasUsado:proyecto.id!==idOAlias};
}
export async function validarCarpeta(ruta) {
  if (typeof ruta!=='string' || !isAbsolute(ruta) || ruta.includes('\0')) throw errorPerfil('INVALID_PATH','Introduce una ruta absoluta.');
  try {
    const raiz=await realpath(ruta), info=await stat(raiz);
    if (!info.isDirectory()) throw errorPerfil('NOT_DIRECTORY','La ruta corresponde a un archivo, no a una carpeta.');
    await readdir(raiz); // Comprueba acceso real con la cuenta del servicio.
    let estado='sin-tareas';
    try {
      const fichas=join(raiz,'02-DOCS/wiki/ftd');
      if (await realpath(fichas)!==fichas) throw errorPerfil('FOLDER_LINK','La carpeta de fichas contiene un enlace.');
      if ((await readdir(fichas,{withFileTypes:true})).some(d=>d.isFile() && d.name.endsWith('.md'))) estado='disponible';
    } catch (error) { if (error.code!=='ENOENT') throw error; }
    return {raiz, identidadDirectorio:`${info.dev}:${info.ino}`, estado, indicios:[]};
  } catch (error) {
    if (error.status) throw error;
    if (['ENOENT','ENOTDIR'].includes(error.code)) throw errorPerfil('FOLDER_NOT_FOUND','No se encuentra la carpeta.');
    if (['EACCES','EPERM'].includes(error.code)) throw errorPerfil('FOLDER_PERMISSION','La cuenta del servicio no tiene permiso para leer la carpeta.');
    throw errorPerfil('FOLDER_READ_ERROR','No se pudo leer la carpeta. Comprueba su disponibilidad.');
  }
}
