import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { altaProyecto } from '../scripts/lib/dashboard-alta.js';
import { crearTarea } from '../scripts/lib/tarea-crear.js';

async function preparar(t) {
  const base = await mkdtemp(join(tmpdir(), 'rsc-dashboard-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const proyecto = join(base, 'Proyecto C');
  await mkdir(proyecto);
  return { base, proyecto, config: join(base, 'local', 'proyectos.json') };
}

test('el alta usa la carpeta real, conserva las filas antiguas y distingue carpetas homónimas', async t => {
  const { base, config, proyecto } = await preparar(t);
  const alias = join(base, 'alias');
  await symlink(proyecto, alias);
  assert.deepEqual(await altaProyecto(undefined, config, proyecto), { id: 'Proyecto-C', existente: false });
  assert.deepEqual(await altaProyecto('otro', config, alias), { id: 'Proyecto-C', existente: true });
  const otro = join(base, 'otro', 'Proyecto C');
  await mkdir(otro, { recursive: true });
  await assert.rejects(altaProyecto('Proyecto-C', config, otro), /otra carpeta/);
  assert.equal((await altaProyecto(undefined, config, otro)).id, 'Proyecto-C-2');
  assert.equal(JSON.parse(await readFile(config)).length, 2);
  await writeFile(config, '{');
  await assert.rejects(altaProyecto('C', config, otro));
  assert.equal(await readFile(config, 'utf8'), '{');
});

test('la ficha de entrada no reemplaza IDs heredados ni archivos existentes', async t => {
  const { proyecto } = await preparar(t);
  const ruta = await crearTarea('C-001', 'Seguir la demostración', proyecto);
  const ficha = await readFile(join(proyecto, ruta), 'utf8');
  assert.match(ficha, /id: C-001/);
  assert.match(ficha, /"paso":"entrada"/);
  await assert.rejects(crearTarea('C-001', 'Otra', proyecto), /ya existe/);
  await writeFile(join(proyecto, '02-DOCS/wiki/ftd/antigua.md'), '---\nid: T1\n---\n# Antigua\n');
  await assert.rejects(crearTarea('T1', 'Nueva', proyecto), /ya existe/);
  await assert.rejects(crearTarea('../escape', 'Nueva', proyecto), /Uso:/);
});

test('el onboarding solo registra al aceptar el plan que incluía el alta', async t => {
  const { proyecto, config } = await preparar(t);
  const cli = fileURLToPath(new URL('../scripts/rsc.js', import.meta.url));
  const args = [cli, 'onboard', '--target', 'codex', '--project-kind', 'software', '--technical-level', 'non-technical',
    '--software-scope', 'small', '--workflow', 'branches', '--goal', 'Demostrar el alta'];
  const opciones = { cwd: proyecto, env: { ...process.env, RSC_DASHBOARD_CONFIG: config }, encoding: 'utf8' };
  const plan = execFileSync(process.execPath, [...args, '--dashboard', 'si'], opciones);
  const id = /Plan id: ([a-f\d]{64})/.exec(plan)[1];
  assert.match(plan, /Dashboard local: si/);
  assert.equal(existsSync(config), false);
  assert.equal(spawnSync(process.execPath, [...args, '--dashboard', 'no', '--accept-plan', id], opciones).status, 3);
  assert.equal(existsSync(config), false);
  const salida = execFileSync(process.execPath, [...args, '--dashboard', 'si', '--accept-plan', id], opciones);
  assert.match(salida, /RSC_ONBOARDING_READY/);
  assert.match(salida, /Proyecto registrado con el ID Proyecto-C/);
  assert.match(execFileSync(process.execPath, [cli, 'dashboard', 'alta'], opciones), /ya registrada/);
  assert.match(execFileSync(process.execPath, [cli, 'tarea', 'crear', 'C-001', 'Prueba desde cero'], opciones), /c-001.md/);
});

test('un movimiento nuevo conserva evidencia, reconoce reintentos y rechaza datos contradictorios', async t => {
  const { proyecto } = await preparar(t);
  const carpeta = join(proyecto, '02-DOCS/wiki/ftd');
  await mkdir(carpeta, { recursive: true });
  const ruta = join(carpeta, 'anterior.md');
  const evidencia = '## Evidencia\n[Prueba](evidencias/uno.json)\n';
  await writeFile(ruta, '---\nid: T1\n---\n# Ficha\n## Transiciones\n\n' + evidencia);
  const cli = fileURLToPath(new URL('../scripts/rsc.js', import.meta.url));
  const args = [cli, 'tarea', 'intento', 'T1', 'rev-2', 'revision', '2', 'superada', 'evidencias/uno.json'];
  const run = a => spawnSync(process.execPath, a, { cwd: proyecto, encoding: 'utf8' });
  assert.equal(run(args).status, 0);
  const texto = await readFile(ruta, 'utf8');
  assert.ok(texto.endsWith(evidencia));
  assert.match(texto, /## Transiciones\n\{"id":"rev-2"/);
  assert.match(run(args).stdout, /ya registrado/);
  assert.equal(run([...args.slice(0, -2), 'fallida', args.at(-1)]).status, 1);
  assert.equal(await readFile(ruta, 'utf8'), texto);
});
