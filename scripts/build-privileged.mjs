import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist-privileged');
const source = path.join(output, 'source');
const artifacts = path.join(output, 'artifacts');

await rm(output, { recursive: true, force: true });
await mkdir(source, { recursive: true });
await cp(path.join(root, 'src'), source, { recursive: true });

const manifestPath = path.join(source, 'manifest.json');
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

const result = spawnSync('web-ext', [
  'build', '-s', source, '-a', artifacts, '--overwrite-dest',
], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
