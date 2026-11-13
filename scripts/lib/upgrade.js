import { spawnSync } from 'node:child_process';

import { forkArchive } from '../../targets/auto-update.mjs';

export function upgradePlan({ targets = [] } = {}) {
  const targetArg = targets.length ? targets.join(',') : '<target>';
  return {
    installCommand: `npm install -g ${forkArchive('main')}`,
    syncCommand: `rsc sync --target ${targetArg}`,
  };
}

export function runUpgrade({ targets = [], dryRun = false, global = false } = {}) {
  const plan = upgradePlan({ targets });
  if (dryRun || !global) return { ran: false, plan };

  const result = spawnSync('npm', ['install', '-g', forkArchive('main')], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('npm global upgrade failed');
  return { ran: true, plan };
}
