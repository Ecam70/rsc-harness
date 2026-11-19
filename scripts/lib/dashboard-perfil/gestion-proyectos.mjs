import { randomUUID } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { errorPerfil, validarCarpeta, validarId, validarEleccion, validarPaso } from './contrato.mjs';

function exigir(condicion, code, mensaje) { if (!condicion) throw errorPerfil(code,mensaje); }
function libre(snapshot,id,uid) {
  validarId(id); const clave=id.toLowerCase();
  const propietario=[...snapshot.proyectos,...snapshot.retirados.map(r=>r.proyecto)].find(p=>p.uid!==uid && [p.id,...p.aliases].some(i=>i.toLowerCase()===clave));
  if (propietario) throw errorPerfil('ID_RESERVED','Ese ID pertenece a un proyecto actual o archivado.',409,{uid:propietario.uid,proyecto:propietario.id});
}
async function carpetaLibre(snapshot, carpeta, uid) {
  for (const p of snapshot.proyectos) {
    if (p.uid===uid) continue;
    let raiz=p.raiz, identidad=p.identidadDirectorio;
    try { raiz=await realpath(p.raiz); const s=await stat(raiz); identidad=`${s.dev}:${s.ino}`; }
    catch (error) { if (!['ENOENT','ENOTDIR','EACCES','EPERM'].includes(error.code)) throw error; }
    if (raiz===carpeta.raiz || (identidad && identidad===carpeta.identidadDirectorio)) throw errorPerfil('FOLDER_DUPLICATE','La carpeta ya pertenece a un proyecto.',409,{uid:p.uid,proyecto:p.id});
  }
}
function trasladarLecturas(s,p) {
  const anteriores=s.lecturasActuales.filter(l=>l.uid===p.uid);
  s.lecturasHistoricas.push(...anteriores);
  s.lecturasActuales=s.lecturasActuales.filter(l=>l.uid!==p.uid);
}
function continuidad(op) { exigir(['mismo-proyecto','contenido-distinto'].includes(op.continuidad),'CONTINUITY_REQUIRED','Confirma si es el mismo proyecto trasladado o contenido distinto.'); }
function unirReglas(a={},b={}) {
  for (const paso of Object.keys(a)) if (b[paso] && (a[paso].agente!==b[paso].agente || a[paso].modelo!==b[paso].modelo)) throw errorPerfil('RULE_ALIAS_CONFLICT','Existen reglas distintas bajo el ID actual y el anterior.');
  return {...b,...a};
}
export async function aplicarOperacion(snapshot, op) {
  exigir(op && typeof op==='object','INVALID_OPERATION','Operación no válida.');
  const s=structuredClone(snapshot);
  let p=s.proyectos.find(p=>p.uid===op.uid), uid=op.uid;
  if (op.tipo==='alta') {
    libre(s,op.id); const carpeta=await validarCarpeta(op.raiz); await carpetaLibre(s,carpeta);
    p={uid:randomUUID(),id:op.id,raiz:carpeta.raiz,aliases:[],ubicacion:1,segmento:randomUUID(),identidadDirectorio:carpeta.identidadDirectorio};
    s.proyectos.push(p); uid=p.uid;
  } else if (op.tipo==='restaurar') {
    const retirado=s.retirados.find(r=>r.proyecto.uid===op.uid); exigir(retirado,'PROJECT_NOT_FOUND','Proyecto archivado desconocido.'); continuidad(op);
    const carpeta=await validarCarpeta(op.raiz); await carpetaLibre(s,carpeta,op.uid);
    p=retirado.proyecto; p.raiz=carpeta.raiz; p.identidadDirectorio=carpeta.identidadDirectorio; p.ubicacion++;
    if (op.continuidad==='contenido-distinto') p.segmento=randomUUID();
    s.lecturasHistoricas.push(...retirado.lecturas); s.proyectos.push(p);
    s.reglas.proyectos[p.id]=unirReglas(retirado.reglas,s.reglas.proyectos[p.id]);
    s.retirados=s.retirados.filter(r=>r!==retirado);
  } else if (op.tipo==='regla') {
    exigir(op.uid===null || p,'PROJECT_NOT_FOUND','Proyecto desconocido.');
    exigir(validarPaso(op.paso),'INVALID_RULE','Paso no válido.');
    if (op.accion==='heredar') {
      exigir(p && s.reglas.proyectos[p.id]?.[op.paso],'INVALID_RULE','No hay excepción que quitar.'); delete s.reglas.proyectos[p.id][op.paso];
    } else {
      exigir(op.accion==='guardar' && validarEleccion(op.eleccion),'INVALID_RULE','Agente o modelo no válido.');
      const destino=p ? (s.reglas.proyectos[p.id] ??= {}) : s.reglas.general;
      destino[op.paso]={agente:op.eleccion.agente,modelo:op.eleccion.modelo};
    }
  } else {
    exigir(p,'PROJECT_NOT_FOUND','Proyecto desconocido.');
    if (op.tipo==='renombrar') {
      libre(s,op.nuevoId,p.uid); const anterior=p.id;
      const reglas=unirReglas(s.reglas.proyectos[anterior],s.reglas.proyectos[op.nuevoId]);
      if (anterior!==op.nuevoId) delete s.reglas.proyectos[anterior];
      if (Object.keys(reglas).length) s.reglas.proyectos[op.nuevoId]=reglas;
      p.aliases=p.aliases.filter(a=>a.toLowerCase()!==op.nuevoId.toLowerCase());
      if (anterior.toLowerCase()!==op.nuevoId.toLowerCase() && !p.aliases.some(a=>a.toLowerCase()===anterior.toLowerCase())) p.aliases.push(anterior);
      p.id=op.nuevoId;
    } else if (op.tipo==='quitar') {
      const lecturas=[...s.lecturasActuales,...s.lecturasHistoricas].filter(l=>l.uid===p.uid);
      s.retirados.push({proyecto:p,retiradoEn:new Date().toISOString(),reglas:s.reglas.proyectos[p.id] ?? {},lecturas});
      delete s.reglas.proyectos[p.id]; s.proyectos=s.proyectos.filter(i=>i.uid!==p.uid);
      s.lecturasActuales=s.lecturasActuales.filter(l=>l.uid!==p.uid);
      s.lecturasHistoricas=s.lecturasHistoricas.filter(l=>l.uid!==p.uid);
    } else if (op.tipo==='carpeta') {
      continuidad(op); const carpeta=await validarCarpeta(op.nuevaRaiz); await carpetaLibre(s,carpeta,p.uid);
      trasladarLecturas(s,p); p.raiz=carpeta.raiz; p.identidadDirectorio=carpeta.identidadDirectorio; p.ubicacion++;
      if (op.continuidad==='contenido-distinto') p.segmento=randomUUID();
    } else throw errorPerfil('INVALID_OPERATION','Operación no válida.');
  }
  s.revision++;
  return {snapshot:s,uid};
}
