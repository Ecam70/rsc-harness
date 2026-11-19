import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { leerEstado, transaccion } from './dashboard-perfil/transacciones.mjs';
import { validarCarpeta, validarId } from './dashboard-perfil/contrato.mjs';

export function dashboardConfig() {
  if (process.env.RSC_DASHBOARD_CONFIG) return resolve(process.env.RSC_DASHBOARD_CONFIG);
  if (process.platform === 'darwin') return join(homedir(), 'Library/Application Support/ai-factory-t002/proyectos.json');
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'ai-factory/proyectos.json');
}
export function capacidadesConsumidor() { return {protocoloPerfil:1,aliases:true,reglasExternas:true}; }

export async function altaProyecto(id, config = dashboardConfig(), carpeta = process.cwd()) {
  if (id!==undefined) validarId(id);
  config=resolve(config);
  if (basename(config)!=='proyectos.json') throw new Error('El registro coordinado debe llamarse proyectos.json.');
  const perfil=dirname(config);
  const entrada=await validarCarpeta(resolve(carpeta));
  const s=await leerEstado(perfil);
  for(const p of s.proyectos) {
    let raiz=p.raiz;
    try{raiz=await realpath(p.raiz);}catch(e){if(!['ENOENT','ENOTDIR','EACCES','EPERM'].includes(e.code))throw e;}
    if(raiz===entrada.raiz || p.identidadDirectorio===entrada.identidadDirectorio)return {id:p.id,existente:true};
  }
  let base=basename(entrada.raiz).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'proyecto';
  try{validarId(base);}catch{base='proyecto-'+base;}
  const ids=new Set([...s.proyectos,...s.retirados.map(r=>r.proyecto)].flatMap(p=>[p.id,...p.aliases]).map(v=>v.toLowerCase()));
  if(id && ids.has(id.toLowerCase()))throw new Error('Ese ID ya identifica otra carpeta o un proyecto archivado.');
  let elegido=id || base;
  for(let n=2;ids.has(elegido.toLowerCase());n++)elegido=base+'-'+n;
  await transaccion(perfil,s.revision,{tipo:'alta',id:elegido,raiz:entrada.raiz});
  return {id:elegido,existente:false};
}
