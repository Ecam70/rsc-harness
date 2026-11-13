import { mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

export function dashboardConfig() {
  if (process.env.RSC_DASHBOARD_CONFIG) return resolve(process.env.RSC_DASHBOARD_CONFIG);
  if (process.platform === 'darwin') return join(homedir(), 'Library/Application Support/ai-factory-t002/proyectos.json');
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'ai-factory/proyectos.json');
}

const idValido = id => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);

async function registradoEn(raiz) {
  try { return await realpath(raiz); }
  catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) return resolve(raiz);
    throw error;
  }
}

export async function altaProyecto(id, config = dashboardConfig(), carpeta = process.cwd()) {
  if (id !== undefined && !idValido(id)) throw new Error('El ID admite letras, números, guiones y guiones bajos.');
  const raiz = await realpath(carpeta);
  await mkdir(dirname(config), { recursive: true, mode: 0o700 });
  const bloqueo = config + '.lock';
  try { await writeFile(bloqueo, String(process.pid), { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Otra alta está en curso. Reintenta cuando termine.');
    throw error;
  }
  const temporal = config + '.' + randomUUID();
  try {
    let proyectos = [];
    try { proyectos = JSON.parse(await readFile(config, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!Array.isArray(proyectos) || proyectos.some(p => !idValido(p?.id) || typeof p.raiz !== 'string' || !p.raiz)
        || new Set(proyectos.map(p => p.id)).size !== proyectos.length) throw new Error('Lista de proyectos no válida.');
    for (const proyecto of proyectos) {
      if (await registradoEn(proyecto.raiz) === raiz) return { id: proyecto.id, existente: true };
    }
    const base = basename(raiz).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'proyecto';
    const ids = new Set(proyectos.map(p => p.id));
    if (id && ids.has(id)) throw new Error('Ese ID ya identifica otra carpeta.');
    let elegido = id || base;
    for (let n = 2; ids.has(elegido); n++) elegido = base + '-' + n;
    proyectos.push({ id: elegido, raiz });
    await writeFile(temporal, JSON.stringify(proyectos, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(temporal, config);
    return { id: elegido, existente: false };
  } finally {
    try { await unlink(temporal); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    finally { await unlink(bloqueo); }
  }
}
