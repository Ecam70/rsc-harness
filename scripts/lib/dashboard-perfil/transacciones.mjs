// Protocolo de perfil v1. Todos los consumidores toman proyectos.json.lock antes de leer.
import { open, readFile, mkdir, rename, unlink, lstat, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { errorPerfil, validarRegistro, validarReglas } from './contrato.mjs';
import { aplicarOperacion } from './gestion-proyectos.mjs';

const nombres=['proyectos.json','reglas-modelos.json','estado.json'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bytes=o=>JSON.stringify(o,null,2)+'\n';
const hash=s=>createHash('sha256').update(s).digest('hex');
const ocupado=()=>errorPerfil('PROFILE_BUSY','Otro proceso está usando el perfil. Vuelve a intentarlo.',409,{retryable:true});
async function leerOpcional(ruta) { try { return await readFile(ruta,'utf8'); } catch (e) { if(e.code==='ENOENT') return null; throw e; } }
function parse(texto) { try { return JSON.parse(texto); } catch { throw errorPerfil('INVALID_PROFILE','Hay un archivo del perfil que no contiene JSON válido.'); } }
async function sincronizarDirectorio(ruta) { const f=await open(ruta,'r'); try { await f.sync(); } finally { await f.close(); } }
async function escribirNuevo(ruta,texto) {
  const f=await open(ruta,'wx',0o600); try { await f.writeFile(texto,'utf8'); await f.sync(); } finally { await f.close(); }
}
async function atomico(ruta,texto) {
  const temporal=ruta+'.'+randomUUID();
  try { await escribirNuevo(temporal,texto); await rename(temporal,ruta); await sincronizarDirectorio(dirname(ruta)); }
  finally { await unlink(temporal).catch(e=>{if(e.code!=='ENOENT') throw e;}); }
}
async function borrar(ruta) { try { await unlink(ruta); await sincronizarDirectorio(dirname(ruta)); } catch(e) { if(e.code!=='ENOENT') throw e; } }
function propietario(texto) {
  try { const p=JSON.parse(texto); return Number.isSafeInteger(p)?{pid:p}:p; } catch { return null; }
}
function muerto(p) {
  if (!p || !Number.isSafeInteger(p.pid) || p.pid<1) return false;
  try { process.kill(p.pid,0); return false; } catch(e) { return e.code==='ESRCH'; }
}
async function comprobarPrivado(ruta) {
  try { if ((await lstat(ruta)).isSymbolicLink()) throw errorPerfil('INVALID_PROFILE','El perfil contiene un enlace inesperado.'); }
  catch(e) { if(e.code!=='ENOENT') throw e; }
}
async function tomarBloqueo(perfil) {
  const ruta=join(perfil,'proyectos.json.lock'), rescate=ruta+'.recovery';
  if (await leerOpcional(rescate)!==null) throw errorPerfil('RECOVERY_REQUIRED','Hay una recuperación de bloqueo pendiente. Comprueba sus procesos antes de continuar.',409);
  const token=randomUUID(), contenido=bytes({version:1,pid:process.pid,token});
  try { await escribirNuevo(ruta,contenido); }
  catch(e) {
    if(e.code!=='EEXIST') throw e;
    const anterior=await leerOpcional(ruta);
    if(!muerto(propietario(anterior))) throw ocupado();
    try { await escribirNuevo(rescate,contenido); } catch(e) { if(e.code==='EEXIST') throw ocupado(); throw e; }
    try {
      const actual=await leerOpcional(ruta);
      if(actual!==anterior || !muerto(propietario(actual))) throw ocupado();
      await borrar(ruta); await escribirNuevo(ruta,contenido);
    } finally { await borrar(rescate); }
  }
  // Un recuperador concurrente nunca comparte la sección crítica con un dueño nuevo.
  if(await leerOpcional(rescate)!==null) { if(await leerOpcional(ruta)===contenido) await borrar(ruta); throw ocupado(); }
  return async()=>{ if(await leerOpcional(ruta)===contenido) await borrar(ruta); };
}
async function comprobarMigracion(perfil) {
  const texto=await leerOpcional(perfil+'.migration.lock');
  if(texto===null) return;
  let marca; try { marca=JSON.parse(texto); } catch {}
  if(marca?.version===1 && marca.pid===process.pid && uuid.test(marca.token) && uuid.test(marca.planId)) return;
  throw errorPerfil('RECOVERY_REQUIRED','Hay una migración pendiente. Termina o revierte esa operación antes de usar el perfil.',409);
}
export async function conBloqueo(perfil,fn) {
  if(typeof perfil!=='string' || !isAbsolute(perfil)) throw errorPerfil('INVALID_PATH','El perfil necesita una ruta absoluta.');
  await comprobarMigracion(perfil);
  await mkdir(perfil,{recursive:true,mode:0o700});
  await comprobarPrivado(perfil);
  for(const n of [...nombres,'proyectos.json.lock','transaccion.json']) await comprobarPrivado(join(perfil,n));
  const liberar=await tomarBloqueo(perfil);
  try { await comprobarMigracion(perfil); return await fn({leerEstado:opciones=>cargar(perfil,opciones)}); } finally { await liberar(); }
}
function metadata(s) { return {version:1,protocoloConsumidor:1,revision:s.revision,perfilId:s.perfilId,retirados:s.retirados,lecturasActuales:s.lecturasActuales,lecturasHistoricas:s.lecturasHistoricas}; }
function validarRef(ref) {
  if(!ref || !uuid.test(ref.uid) || !uuid.test(ref.segmento) || !Number.isSafeInteger(ref.ubicacion) || ref.ubicacion<1 || typeof ref.raiz!=='string' || !isAbsolute(ref.raiz) || typeof ref.fecha!=='string' || !Number.isFinite(Date.parse(ref.fecha)) || !/^lecturas\/v1\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.json$/i.test(ref.archivo) || !/^[a-f0-9]{64}$/.test(ref.sha256)) throw errorPerfil('INVALID_PROFILE','Una referencia de lectura no es válida.');
}
function validarSnapshot(s) {
  if(s.protocolo!==1 || !uuid.test(s.perfilId) || !Number.isSafeInteger(s.revision) || s.revision<0 || !Array.isArray(s.retirados) || !Array.isArray(s.lecturasActuales) || !Array.isArray(s.lecturasHistoricas)) throw errorPerfil('INVALID_PROFILE','Metadatos de perfil no válidos.');
  validarRegistro(s.proyectos,s.retirados); validarReglas(s.reglas);
  for(const p of [...s.proyectos,...s.retirados.map(r=>r.proyecto)]) if(!uuid.test(p.uid)||!uuid.test(p.segmento)||!Number.isSafeInteger(p.ubicacion)||p.ubicacion<1||!Array.isArray(p.aliases)||!(p.identidadDirectorio===null||typeof p.identidadDirectorio==='string')) throw errorPerfil('INVALID_PROFILE','Identidad de proyecto no válida.');
  for(const r of s.retirados) { if(!Array.isArray(r.lecturas)||!Number.isFinite(Date.parse(r.retiradoEn))) throw errorPerfil('INVALID_PROFILE','Archivo de proyectos no válido.'); validarReglas({general:r.reglas,proyectos:{}}); }
  for(const ref of [...s.lecturasActuales,...s.lecturasHistoricas,...s.retirados.flatMap(r=>r.lecturas)]) validarRef(ref);
  return s;
}
async function contenidoRef(perfil,ref) {
  validarRef(ref); const ruta=join(perfil,ref.archivo);
  if(await realpath(ruta)!==join(await realpath(perfil),ref.archivo)) throw errorPerfil('INVALID_PROFILE','Una lectura privada contiene un enlace.');
  const texto=await readFile(ruta,'utf8'); if(hash(texto)!==ref.sha256) throw errorPerfil('INVALID_PROFILE','La huella de una lectura no coincide.');
  const lectura=parse(texto);
  for(const key of ['uid','ubicacion','segmento','raiz','identidadDirectorio','fecha']) if(lectura[key]!==ref[key]) throw errorPerfil('INVALID_PROFILE','La lectura no corresponde a su procedencia.');
  if(!Array.isArray(lectura.tareas)) throw errorPerfil('INVALID_PROFILE','Lectura sin tareas válidas.');
  return lectura;
}
async function guardarLectura(perfil,lectura) {
  const archivo=`lecturas/v1/${lectura.uid}/${randomUUID()}.json`, ruta=join(perfil,archivo);
  const ref=Object.fromEntries(['uid','ubicacion','segmento','raiz','identidadDirectorio','fecha'].map(k=>[k,lectura[k]]));
  const texto=bytes(lectura); Object.assign(ref,{archivo,sha256:hash(texto)}); validarRef(ref);
  if(!Array.isArray(lectura.tareas)) throw errorPerfil('INVALID_PROFILE','Lectura sin tareas válidas.');
  await mkdir(dirname(ruta),{recursive:true,mode:0o700});
  if(await realpath(dirname(ruta))!==join(await realpath(perfil),dirname(archivo))) throw errorPerfil('INVALID_PROFILE','La carpeta privada de lecturas contiene un enlace.');
  await escribirNuevo(ruta,texto);
  for(const carpeta of [dirname(ruta),join(perfil,'lecturas/v1'),join(perfil,'lecturas'),perfil]) await sincronizarDirectorio(carpeta);
  return ref;
}
async function publicarConjunto(perfil,s,opciones={}) {
  validarSnapshot(s);
  const id=randomUUID(), carpeta=join(perfil,'transacciones',id); await mkdir(carpeta,{recursive:true,mode:0o700});
  if(await realpath(carpeta)!==join(await realpath(perfil),'transacciones',id)) throw errorPerfil('INVALID_PROFILE','La carpeta de transacciones contiene un enlace.');
  const valores=[s.proyectos,s.reglas,metadata(s)], archivos=[];
  for(let i=0;i<nombres.length;i++) {
    const nombre=nombres[i], anterior=await leerOpcional(join(perfil,nombre)), siguiente=bytes(valores[i]);
    const antes=anterior===null?null:{archivo:`transacciones/${id}/antes-${nombre}`,sha256:hash(anterior)};
    const despues={archivo:`transacciones/${id}/despues-${nombre}`,sha256:hash(siguiente)};
    if(antes) await escribirNuevo(join(perfil,antes.archivo),anterior);
    await escribirNuevo(join(perfil,despues.archivo),siguiente); archivos.push({nombre,antes,despues});
  }
  await sincronizarDirectorio(carpeta); await sincronizarDirectorio(dirname(carpeta)); opciones.fallo?.('copias');
  const diario={version:1,id,fase:'preparado',archivos};
  await atomico(join(perfil,'transaccion.json'),bytes(diario)); opciones.fallo?.('preparado');
  for(let i=0;i<nombres.length;i++) { await atomico(join(perfil,nombres[i]),bytes(valores[i])); opciones.fallo?.('archivo:'+nombres[i]); }
  diario.fase='confirmado'; await atomico(join(perfil,'transaccion.json'),bytes(diario)); opciones.fallo?.('confirmado');
  await borrar(join(perfil,'transaccion.json'));
}
async function recuperarDentro(perfil) {
  const texto=await leerOpcional(join(perfil,'transaccion.json')); if(texto===null) return {estado:'limpio'};
  const diario=parse(texto);
  if(diario.version!==1 || !uuid.test(diario.id) || !['preparado','confirmado'].includes(diario.fase) || !Array.isArray(diario.archivos) || diario.archivos.length!==3 || diario.archivos.some((a,i)=>a.nombre!==nombres[i])) throw errorPerfil('RECOVERY_REQUIRED','El diario requiere revisión; no se ha aplicado parcialmente.',409);
  const conjunto=[];
  for(const a of diario.archivos) {
    const ref=diario.fase==='confirmado'?a.despues:a.antes;
    if(ref===null) { conjunto.push(null); continue; }
    const fase=diario.fase==='confirmado'?'despues':'antes';
    if(ref?.archivo!==`transacciones/${diario.id}/${fase}-${a.nombre}` || !/^[a-f0-9]{64}$/.test(ref.sha256)) throw errorPerfil('RECOVERY_REQUIRED','El diario contiene una referencia no válida.',409);
    const ruta=join(perfil,ref.archivo);
    if(await realpath(ruta)!==join(await realpath(perfil),ref.archivo)) throw errorPerfil('RECOVERY_REQUIRED','La copia del diario contiene un enlace.',409);
    const contenido=await readFile(ruta,'utf8'); if(hash(contenido)!==ref.sha256) throw errorPerfil('RECOVERY_REQUIRED','Una copia del diario ha cambiado. Conserva los archivos para recuperarlos.',409);
    conjunto.push(contenido);
  }
  for(let i=0;i<nombres.length;i++) { if(conjunto[i]===null) await borrar(join(perfil,nombres[i])); else await atomico(join(perfil,nombres[i]),conjunto[i]); }
  await borrar(join(perfil,'transaccion.json'));
  return {estado:diario.fase==='confirmado'?'confirmado':'restaurado'};
}
async function cargar(perfil,opciones={}) {
  await recuperarDentro(perfil);
  const estadoTexto=await leerOpcional(join(perfil,'estado.json'));
  const registroTexto=await leerOpcional(join(perfil,'proyectos.json'));
  const reglasTexto=await leerOpcional(join(perfil,'reglas-modelos.json'));
  const proyectos=registroTexto===null?[]:parse(registroTexto);
  if(estadoTexto!==null) {
    const m=parse(estadoTexto);
    if(m.version!==1 || m.protocoloConsumidor!==1 || reglasTexto===null || registroTexto===null) throw errorPerfil('INVALID_PROFILE','El perfil está incompleto o usa una versión incompatible.');
    const {version,protocoloConsumidor,...datos}=m;
    return validarSnapshot({...datos,protocolo:1,proyectos,reglas:parse(reglasTexto)});
  }
  validarRegistro(proyectos);
  if(proyectos.some(p=>['uid','aliases','ubicacion','segmento'].some(k=>Object.hasOwn(p,k)))) throw errorPerfil('INVALID_PROFILE','Faltan los metadatos de un perfil gestionado. Restaura la copia completa; no se recrearán sus identidades.');
  const reglas=parse(reglasTexto ?? await readFile(opciones.plantilla ?? new URL('./reglas-modelos.json',import.meta.url),'utf8')); validarReglas(reglas);
  const s={revision:0,perfilId:randomUUID(),protocolo:1,proyectos:[],reglas,retirados:[],lecturasActuales:[],lecturasHistoricas:[]};
  for(const viejo of proyectos) {
    let raiz=resolve(viejo.raiz), identidadDirectorio=null;
    try { raiz=await realpath(raiz); const info=await stat(raiz); identidadDirectorio=`${info.dev}:${info.ino}`; }
    catch(e) { if(!['ENOENT','ENOTDIR','EACCES','EPERM'].includes(e.code)) throw e; }
    if(s.proyectos.some(p=>p.raiz===raiz || (identidadDirectorio && p.identidadDirectorio===identidadDirectorio))) throw errorPerfil('INVALID_PROFILE','Dos proyectos del registro señalan la misma carpeta. Resuelve el conflicto antes de migrar.');
    const p={uid:randomUUID(),id:viejo.id,raiz,aliases:[],ubicacion:1,segmento:randomUUID(),identidadDirectorio}; s.proyectos.push(p);
    const cache=await leerOpcional(join(perfil,'lecturas',viejo.id+'.json'));
    if(cache!==null) {
      const previa=parse(cache);
      if(typeof previa.raiz!=='string' || !previa.lectura || !Array.isArray(previa.lectura.tareas)) throw errorPerfil('INVALID_PROFILE','Una lectura anterior no es válida; se conserva sin sobrescribir.');
      const lectura={...p,raiz:resolve(previa.raiz),identidadDirectorio:null,fecha:previa.lectura.fecha,tareas:previa.lectura.tareas};
      const ref=await guardarLectura(perfil,lectura);
      // Identidad histórica desconocida: nunca se la presenta como capturada del inode actual.
      if(ref.raiz===p.raiz) s.lecturasActuales.push(ref); else s.lecturasHistoricas.push(ref);
    }
  }
  await publicarConjunto(perfil,s,opciones); return s;
}
export async function leerEstado(perfil,opciones={}) { return conBloqueo(perfil,()=>cargar(perfil,opciones)); }
export async function recuperar(perfil) { return conBloqueo(perfil,()=>recuperarDentro(perfil)); }
export async function transaccion(perfil,expectedRevision,operacion,opciones={}) {
  return conBloqueo(perfil,async()=>{
    const s=await cargar(perfil,opciones);
    if(!Number.isSafeInteger(expectedRevision) || expectedRevision!==s.revision) throw errorPerfil('REVISION_CONFLICT','El perfil ha cambiado. Recarga y revisa la operación antes de confirmar.',409);
    const {snapshot,uid}=await aplicarOperacion(s,operacion); await publicarConjunto(perfil,snapshot,opciones);
    return {revision:snapshot.revision,...uid?{uid}:{}};
  });
}
export async function publicarLectura(perfil,lectura) {
  return conBloqueo(perfil,async()=>{
    const s=await cargar(perfil), p=s.proyectos.find(p=>p.uid===lectura.uid);
    const actual=!!p && ['ubicacion','segmento','raiz'].every(k=>p[k]===lectura[k]) && (p.identidadDirectorio===null || p.identidadDirectorio===lectura.identidadDirectorio);
    const ref=await guardarLectura(perfil,lectura);
    if(actual) {
      s.lecturasHistoricas.push(...s.lecturasActuales.filter(r=>r.uid===p.uid));
      s.lecturasActuales=s.lecturasActuales.filter(r=>r.uid!==p.uid); s.lecturasActuales.push(ref);
    } else s.lecturasHistoricas.push(ref);
    await atomico(join(perfil,'estado.json'),bytes(metadata(s))); return {actual};
  });
}
export async function leerLecturas(perfil,snapshot) {
  return conBloqueo(perfil,async()=>{
    // Una snapshot suministrada es válida para una lectura histórica: las copias son inmutables.
    const s=snapshot ?? await cargar(perfil); validarSnapshot(s);
    const resultado=[], vistos=new Set();
    for(const [refs,historica] of [[s.lecturasActuales,false],[s.lecturasHistoricas,true],[s.retirados.flatMap(r=>r.lecturas),true]]) for(const ref of refs) {
      if(vistos.has(ref.archivo)) continue; vistos.add(ref.archivo);
      resultado.push({...await contenidoRef(perfil,ref),archivo:ref.archivo,sha256:ref.sha256,historica});
    }
    return resultado;
  });
}
