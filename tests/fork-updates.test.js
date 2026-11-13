import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { forkArchive, updateNotice } from '../targets/auto-update.mjs';

const repo = 'Ecam70/rsc-harness';
const before = 'a'.repeat(40);
const after = 'b'.repeat(40);

test('same-version EAM revision: fetch only fork, offer exact archive; never downgrade a PR checkout', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'eam-update-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.rsc'));
  writeFileSync(join(root, '.rsc', '.version'), '4.1.5');
  writeFileSync(join(root, '.rsc', '.no-auto-update'), '');
  writeFileSync(join(root, '.rsc.json'), JSON.stringify({ targets: ['codex'], forkSource: { repository: repo, revision: before } }));
  let status = 'ahead';
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    urls.push(String(url));
    const response = new Map([
      [`https://api.github.com/repos/${repo}/commits/main`, { sha: after }],
      [`https://raw.githubusercontent.com/${repo}/${after}/package.json`, { version: '4.1.5' }],
      [`https://api.github.com/repos/${repo}/compare/${before}...${after}`, { status }],
    ]).get(String(url));
    assert.ok(response, url);
    return Response.json(response);
  });
  assert.ok((await updateNotice(root, {})).includes(`--package=${forkArchive(after)} -- rsc sync`));
  assert.equal(urls.length, 3);
  status = 'behind';
  assert.equal(await updateNotice(root, {}), '');
  status = 'diverged';
  assert.equal(await updateNotice(root, {}), '');

  // Let the real launcher pick its arguments. Capture them via PATH, without running an installer.
  if (process.platform === 'win32') return;
  status = 'ahead';
  rmSync(join(root, '.rsc', '.no-auto-update'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'npx'), '#!/bin/sh\nprintf "%s\\n" "$@" > called.txt\n', { mode: 0o755 });
  assert.match(await updateNotice(root, { ...process.env, PATH: bin }), /rsc updating/);
  let args;
  for (let n = 0; n < 100 && !args; n++) {
    await new Promise((resolve) => setTimeout(resolve, 15));
    try { args = readFileSync(join(root, 'called.txt'), 'utf8').trim().split('\n'); } catch { /* pending */ }
  }
  assert.deepEqual(args, ['-y', `--package=${forkArchive(after)}`, '--', 'rsc', 'sync', '--target', 'codex']);
});
