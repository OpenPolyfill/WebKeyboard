import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build:privileged'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const playwright = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
const tests = spawnSync(process.execPath, [playwright, 'test'], {
  cwd: root,
  env: { ...process.env, WEBKEYBOARD_PRIVILEGED: '1' },
  stdio: 'inherit',
});
if (tests.error) throw tests.error;
process.exit(tests.status ?? 1);
