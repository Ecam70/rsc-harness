import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pagina, esc } from './tablero.mjs';

const fases = ['entrada','preparacion','plan','implementacion','revision','verificacion','entrega'];
const agentes = { codex:'Codex', claude:'Claude Code', cursor:'Cursor', gemini:'Gemini' };
const modeloValido = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/;
const claveValida = s => typeof s === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(s) && !(s in Object.prototype);
const pasoValido = s => claveValida(s) && /^[a-z0-9-]+$/.test(s);
const plantilla = new URL('./reglas-modelos.json', import.meta.url);
const opciones = (pares, actual) => pares.map(([id,nombre]) =>
  '<option value="'+esc(id)+'"'+(id===actual?' selected':'')+'>'+esc(nombre)+'</option>').join('');

function reglasActuales(archivo) {
  return JSON.parse(readFileSync(existsSync(archivo) ? archivo : plantilla,'utf8'));
}
function exigir(condicion, mensaje) {
  if (!condicion) throw Object.assign(new Error(mensaje),{status:400});
}

export function mostrar(archivo, ids, parametros) {
  const proyecto=parametros.get('proyecto') || '', paso=parametros.get('paso') || 'revision';
  exigir(!proyecto || (ids.includes(proyecto) && claveValida(proyecto)), 'Proyecto desconocido');
  exigir(pasoValido(paso), 'Paso no válido');
  const reglas=reglasActuales(archivo);
  const propia=reglas.proyectos[proyecto]?.[paso];
  const efectiva=propia ?? reglas.general[paso];
  const pasos=new Set([...fases, ...Object.keys(reglas.general), ...Object.values(reglas.proyectos).flatMap(Object.keys), paso]);
  const ocultos='<input type="hidden" name="proyecto" value="'+esc(proyecto)+'"><input type="hidden" name="paso" value="'+esc(paso)+'">';
  return pagina('Agentes y modelos','<h1>Agentes y modelos</h1><form action="/configuracion"><label>Ámbito<select name="proyecto">'+
    opciones([['','Todos los proyectos'],...ids.map(id=>[id,'Proyecto '+id])],proyecto)+'</select></label><label>Paso<input aria-label="Paso" name="paso" list="pasos" value="'+esc(paso)+'" required pattern="[a-z0-9-]+"><datalist id="pasos">'+opciones([...pasos].map(p=>[p,p]),paso)+'</datalist></label><button>Ver elección</button></form>'+
    '<section class="panel"><h2>'+esc(paso)+' · '+esc(proyecto?'Proyecto '+proyecto:'Todos los proyectos')+'</h2><p>Elección efectiva: <strong>'+
    (efectiva?esc(agentes[efectiva.agente] ?? efectiva.agente)+' / '+esc(efectiva.modelo):'Sin configurar')+'</strong> · '+(propia?'Excepción del proyecto':efectiva?'Regla general':'Sin regla')+'</p>'+
    '<form method="post" action="/configuracion">'+ocultos+'<label>Agente<select aria-label="Agente" name="agente">'+opciones(Object.entries(agentes),efectiva?.agente ?? 'codex')+'</select></label>'+
    '<label>Modelo<input aria-label="Modelo" required name="modelo" list="modelos" maxlength="128" value="'+esc(efectiva?.modelo ?? '')+'"><datalist id="modelos"><option>gpt-6.1-sol</option><option>gpt-6-astra</option></datalist></label>'+
    '<button name="accion" value="guardar">Guardar '+(proyecto?'excepción':'regla general')+'</button></form>'+
    (propia?'<form method="post" action="/configuracion">'+ocultos+'<button name="accion" value="heredar">Volver a la regla general</button></form>':'')+
    '<p>El ejecutor local aplica las revisiones con Codex. Las demás combinaciones quedan guardadas para su adaptador.</p></section>');
}

export function guardar(archivo, ids, datos) {
  const proyecto=datos.get('proyecto') ?? '', paso=datos.get('paso');
  exigir(!proyecto || (claveValida(proyecto) && ids.includes(proyecto)), 'Proyecto desconocido');
  exigir(pasoValido(paso), 'Paso no válido');
  const reglas=reglasActuales(archivo);
  if (datos.get('accion')==='heredar') {
    exigir(proyecto && reglas.proyectos[proyecto]?.[paso], 'No hay excepción que quitar');
    delete reglas.proyectos[proyecto][paso];
  } else {
    const agente=datos.get('agente'), modelo=datos.get('modelo')?.trim();
    exigir(datos.get('accion')==='guardar' && Object.hasOwn(agentes,agente) && modelo && modeloValido.test(modelo),'Agente o modelo no válido');
    const destino=proyecto ? (reglas.proyectos[proyecto] ??= {}) : reglas.general;
    destino[paso]={agente,modelo};
  }
  const temporal=archivo+'.'+randomUUID();
  writeFileSync(temporal,JSON.stringify(reglas,null,2)+'\n',{mode:0o600});
  renameSync(temporal,archivo);
  return '/configuracion?'+new URLSearchParams({proyecto,paso});
}
