import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { altaProyecto } from '../scripts/lib/dashboard-alta.js';

async function preparar(t){const perfil=await mkdtemp(join(tmpdir(),'eam-perfil-'));t.after(()=>rm(perfil,{recursive:true,force:true}));const carpeta=join(perfil,'Proyecto ñ');await mkdir(carpeta);return {perfil,carpeta,config:join(perfil,'proyectos.json')};}
test('alta coordinada materializa identidad y reglas sin requerir tablero abierto',async t=>{
  const {perfil,config,carpeta}=await preparar(t);
  assert.deepEqual(await altaProyecto('A',config,carpeta),{id:'A',existente:false});
  const [p]=JSON.parse(await readFile(config,'utf8'));
  assert.match(p.uid ?? '',/^[a-f0-9-]{36}$/);
  const estado=JSON.parse(await readFile(join(perfil,'estado.json'),'utf8'));
  assert.equal(estado.protocoloConsumidor,1);
  assert.equal(estado.revision,1);
  assert.ok(JSON.parse(await readFile(join(perfil,'reglas-modelos.json'),'utf8')).general.revision);
});
test('alta rechaza reservas, colisión por mayúsculas y diario pendiente',async t=>{
  const {perfil,config,carpeta}=await preparar(t);
  await assert.rejects(altaProyecto('CON',config,carpeta),/ID|nombre/);
  await altaProyecto('Primero',config,carpeta);
  const otra=join(perfil,'Otra');await mkdir(otra);
  await assert.rejects(altaProyecto('primero',config,otra),/ID|otra carpeta/);
  const antes=await readFile(config,'utf8');
  await writeFile(join(perfil,'transaccion.json'),'{}');
  await assert.rejects(altaProyecto('Nuevo',config,otra),/diario|recuper|transacci/i);
  assert.equal(await readFile(config,'utf8'),antes);
});
