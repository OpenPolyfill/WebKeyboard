import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staging = await mkdtemp(path.join(tmpdir(), 'webkeyboard-privileged-'));
try {
  const source = path.join(root, 'src');
  await cp(source, staging, { recursive: true });
  const manifestPath = path.join(staging, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.experiment_apis = {
    keyboard: {
      schema: 'experiment/schema.json',
      parent: {
        scopes: ['addon_parent'],
        paths: [['keyboard']],
        script: 'experiment/api.js',
      },
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = spawnSync('npx', [
    'web-ext', 'build', '-s', staging, '-a', path.join(root, 'dist-privileged'), '--overwrite-dest',
  ], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  await rm(staging, { recursive: true, force: true });
}
