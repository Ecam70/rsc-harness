import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { forkArchive, FORK_REPO, validRevision } from '../../targets/auto-update.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Get the revision of the installer itself, never that of the project being installed.
function installerRevision() {
  if (existsSync(join(root, '.git'))) {
    const revision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (validRevision(revision)) return revision;
  }
  // npm records the exact archive it unpacked in node_modules/.package-lock.json.
  const modules = dirname(dirname(root.replace(/\/$/, '')));
  try {
    const lock = JSON.parse(readFileSync(join(modules, '.package-lock.json'), 'utf8'));
    const resolved = lock.packages['node_modules/@ericrisco/rsc']?.resolved;
    const revision = resolved?.split('/').at(-1);
    if (validRevision(revision) && resolved === forkArchive(revision)) return revision;
  } catch { /* A manually unpacked archive may have no npm lock. */ }
  return null;
}

export const forkRevision = installerRevision();
export const forkSource = { repository: FORK_REPO, revision: forkRevision };
export const forkCli = forkRevision
  ? `npm exec --yes --package=${forkArchive(forkRevision)} -- rsc`
  : `npm exec --yes --package=${forkArchive('main')} -- rsc`;
