import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNativeMessageFrames } from './native-messaging-frames.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST_NAME = 'com.openpolyfill.webkeyboard';
const EXTENSION_ID = '@webkeyboard.openpolyfill';
const MANIFEST_FILE = `${HOST_NAME}.json`;
const PLAYWRIGHT_CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

function runSync(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    ...options,
  });
}

function checkSync(label, command, args, options = {}) {
  const result = runSync(command, args, options);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`${label} failed with exit code ${result.status}${details ? `:\n${details}` : ''}`);
  }
  return result;
}

function hostExecutable() {
  const name = process.platform === 'win32'
    ? 'webkeyboard-native-host.exe'
    : 'webkeyboard-native-host';
  return path.join(ROOT, 'native', 'target', 'debug', name);
}

function generatedManifest(hostPath) {
  const result = checkSync('Native manifest generation', hostPath, ['--print-manifest']);
  const manifest = JSON.parse(result.stdout.trim());
  if (
    manifest.name !== HOST_NAME ||
    manifest.type !== 'stdio' ||
    path.resolve(manifest.path) !== path.resolve(hostPath) ||
    !manifest.allowed_extensions?.includes(EXTENSION_ID)
  ) {
    throw new Error('Debug host generated an unexpected native messaging manifest');
  }
  return manifest;
}

function probeSystemLayout(hostPath, action = 'getLayout') {
  const request = Buffer.from(JSON.stringify({ id: 1, action }));
  const header = Buffer.alloc(4);
  if (os.endianness() === 'LE') header.writeUInt32LE(request.length);
  else header.writeUInt32BE(request.length);
  const result = runSync(hostPath, [], {
    encoding: null,
    input: Buffer.concat([header, request]),
    maxBuffer: 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Debug host layout probe failed: ${result.stderr?.toString() || result.status}`);
  }
  const messages = parseNativeMessageFrames(result.stdout);
  const responses = messages.filter((message) => message?.id === 1);
  if (responses.length !== 1) {
    throw new Error('Debug host did not return exactly one correlated native message');
  }
  if (messages.some((message) => message?.id !== 1 && message?.type !== 'layoutchange')) {
    throw new Error('Debug host returned an unexpected native message frame');
  }
  const response = responses[0];
  if (
    response.id !== 1 ||
    !response.layoutMap ||
    typeof response.layoutMap !== 'object' ||
    Array.isArray(response.layoutMap)
  ) {
    throw new Error('Debug host returned an invalid system layout map');
  }
  if (
    action === 'watchLayoutChanges' &&
    typeof response.eventSupported !== 'boolean'
  ) {
    throw new Error('Debug host returned an invalid layout watcher capability');
  }
  return response;
}

function installManifestFile(manifest) {
  let directory;
  if (process.platform === 'linux') {
    directory = path.join(os.homedir(), '.mozilla', 'native-messaging-hosts');
  } else if (process.platform === 'darwin') {
    directory = path.join(os.homedir(), 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts');
  } else {
    throw new Error(`Unsupported native manifest platform: ${process.platform}`);
  }

  const target = path.join(directory, MANIFEST_FILE);
  const directoryExisted = fs.existsSync(directory);
  fs.mkdirSync(directory, { recursive: true });
  const backup = `${target}.webkeyboard-test-backup-${process.pid}-${randomUUID()}`;
  const staged = `${target}.webkeyboard-test-${process.pid}-${randomUUID()}`;
  let backedUp = false;
  try {
    if (fs.existsSync(target)) {
      const stat = fs.lstatSync(target);
      if (!stat.isFile() && !stat.isSymbolicLink()) {
        throw new Error(`Refusing to replace non-file native manifest target: ${target}`);
      }
      fs.renameSync(target, backup);
      backedUp = true;
    }
    fs.writeFileSync(staged, JSON.stringify(manifest), { mode: 0o600 });
    fs.renameSync(staged, target);
  } catch (error) {
    fs.rmSync(staged, { force: true });
    if (backedUp && fs.existsSync(backup) && !fs.existsSync(target)) {
      fs.renameSync(backup, target);
    }
    if (!directoryExisted) {
      try { fs.rmdirSync(directory); } catch {}
    }
    throw error;
  }

  return () => {
    fs.rmSync(target, { force: true });
    if (backedUp) fs.renameSync(backup, target);
    if (!directoryExisted) {
      try { fs.rmdirSync(directory); } catch {}
    }
  };
}

function installWindowsManifest(manifest) {
  const registryKey = `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${HOST_NAME}`;
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'webkeyboard-native-test-'));
  const manifestPath = path.join(temporaryDirectory, MANIFEST_FILE);
  const backupPath = path.join(temporaryDirectory, 'original-registration.reg');
  let keyExisted;
  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest), { mode: 0o600 });
    const query = runSync('reg.exe', ['query', registryKey]);
    if (query.error) throw query.error;
    keyExisted = query.status === 0;
    if (query.status !== 0 && query.status !== 1) {
      throw new Error(`Unable to inspect native messaging registry key: ${query.stderr || query.stdout}`);
    }
    if (keyExisted) checkSync('Native registry backup', 'reg.exe', ['export', registryKey, backupPath, '/y']);
  } catch (error) {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }

  const restore = () => {
    const removal = runSync('reg.exe', ['delete', registryKey, '/f']);
    if (removal.error) throw removal.error;
    if (keyExisted) {
      checkSync('Native registry restore', 'reg.exe', ['import', backupPath]);
    } else {
      const remaining = runSync('reg.exe', ['query', registryKey]);
      if (remaining.error) throw remaining.error;
      if (remaining.status === 0) throw new Error('Temporary native messaging registry key was not removed');
    }
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  };

  try {
    checkSync('Temporary native host registration', 'reg.exe', [
      'add', registryKey, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f',
    ]);
  } catch (error) {
    try { restore(); } catch (restoreError) {
      throw new AggregateError([error, restoreError], `Registration failed; backup retained in ${temporaryDirectory}`);
    }
    throw error;
  }
  return restore;
}

function runningHostPids(hostPath) {
  const pids = new Set();
  if (process.platform === 'linux') {
    const expected = fs.realpathSync(hostPath);
    for (const entry of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(entry)) continue;
      try {
        const executable = fs.readlinkSync(`/proc/${entry}/exe`).replace(/ \(deleted\)$/, '');
        if (path.resolve(executable) === expected) pids.add(entry);
      } catch {}
    }
    return pids;
  }
  if (process.platform === 'darwin') {
    const result = checkSync('Native host process inspection', 'ps', ['-A', '-ww', '-o', 'pid=', '-o', 'command=']);
    for (const line of result.stdout.split(/\r?\n/)) {
      const match = line.match(/^\s*(\d+)\s+(.+)$/);
      if (!match) continue;
      const command = match[2].trim();
      if (command.startsWith(hostPath) || command.startsWith(`"${hostPath}"`)) pids.add(match[1]);
    }
    return pids;
  }
  if (process.platform === 'win32') {
    const escapedPath = path.resolve(hostPath).replace(/'/g, "''");
    const script = `$target = [System.IO.Path]::GetFullPath('${escapedPath}'); Get-CimInstance Win32_Process -Filter \"Name='webkeyboard-native-host.exe'\" | Where-Object { $_.ExecutablePath -and ([System.IO.Path]::GetFullPath($_.ExecutablePath) -ieq $target) } | ForEach-Object { $_.ProcessId }`;
    const result = checkSync('Native host process inspection', 'powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command', script,
    ]);
    for (const pid of result.stdout.split(/\r?\n/).map((value) => value.trim())) {
      if (/^\d+$/.test(pid)) pids.add(pid);
    }
    return pids;
  }
  throw new Error(`Unsupported process-inspection platform: ${process.platform}`);
}

function runPlaywright(hostPath, env, baselinePids) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PLAYWRIGHT_CLI, 'test', '--workers=1', ...process.argv.slice(2)], {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    });
    let hostStarted = false;
    let inspectionError;
    const inspect = () => {
      if (hostStarted) return;
      try {
        for (const pid of runningHostPids(hostPath)) {
          if (!baselinePids.has(pid)) {
            hostStarted = true;
            break;
          }
        }
      } catch (error) {
        inspectionError = error;
      }
    };
    const timer = setInterval(inspect, process.platform === 'win32' ? 250 : 75);
    const forwardSignal = (signal) => child.kill(process.platform === 'win32' ? 'SIGTERM' : signal);
    const onInterrupt = () => forwardSignal('SIGINT');
    const onTerminate = () => forwardSignal('SIGTERM');
    process.on('SIGINT', onInterrupt);
    process.on('SIGTERM', onTerminate);

    const cleanup = () => {
      clearInterval(timer);
      process.off('SIGINT', onInterrupt);
      process.off('SIGTERM', onTerminate);
    };
    child.once('error', (error) => {
      cleanup();
      reject(error);
    });
    child.once('exit', (code, signal) => {
      inspect();
      cleanup();
      resolve({ code: code ?? 1, signal, hostStarted, inspectionError });
    });
  });
}

async function main() {
  const hostPath = hostExecutable();
  checkSync('System layout watcher tests', process.execPath, ['--test', path.join(ROOT, 'tests', 'system-layout-watcher.test.mjs')], { stdio: 'inherit' });
  checkSync('Rust unit tests', process.env.CARGO || 'cargo', ['test', '--manifest-path', path.join(ROOT, 'native', 'Cargo.toml')], { stdio: 'inherit' });
  checkSync('Debug native host build', process.env.CARGO || 'cargo', ['build', '--manifest-path', path.join(ROOT, 'native', 'Cargo.toml')], { stdio: 'inherit' });
  if (!fs.existsSync(hostPath)) throw new Error(`Debug native host binary not found: ${hostPath}`);

  const manifest = generatedManifest(hostPath);
  const systemLayout = probeSystemLayout(hostPath);
  const systemWatcher = probeSystemLayout(hostPath, 'watchLayoutChanges');
  console.log(
    `Native layout-change events: ${systemWatcher.eventSupported ? 'available' : 'unsupported; polling fallback will be used'}.`,
  );
  const layoutMap = systemLayout.layoutMap;
  const expectedMap = {
    keyA: layoutMap.KeyA ?? null,
    keyY: layoutMap.KeyY ?? null,
    keyZ: layoutMap.KeyZ ?? null,
  };
  const expectedChoice = typeof systemLayout.layoutName === 'string'
    ? `System (${systemLayout.layoutName})`
    : 'System';
  const env = {
    ...process.env,
    WEBKEYBOARD_EXPECT_SYSTEM_MAP: JSON.stringify(expectedMap),
    WEBKEYBOARD_EXPECT_SYSTEM_SIZE: String(Object.keys(layoutMap).length),
    WEBKEYBOARD_EXPECT_SYSTEM_CHOICE: expectedChoice,
  };

  const baselinePids = runningHostPids(hostPath);
  let restoreRegistration;
  try {
    restoreRegistration = process.platform === 'win32'
      ? installWindowsManifest(manifest)
      : installManifestFile(manifest);
    const result = await runPlaywright(hostPath, env, baselinePids);
    if (result.code !== 0) throw new Error(`Playwright exited with code ${result.code}${result.signal ? ` (${result.signal})` : ''}`);
    if (!result.hostStarted) {
      const detail = result.inspectionError ? ` Process inspection failed: ${result.inspectionError.message}` : '';
      throw new Error(`Firefox tests passed without launching the debug native host.${detail}`);
    }
    console.log(`Verified Firefox launched the debug native host (${hostPath}).`);
  } finally {
    restoreRegistration?.();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
