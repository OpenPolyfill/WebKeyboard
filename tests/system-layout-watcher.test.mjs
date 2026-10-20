import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { parseNativeMessageFrames } from '../scripts/native-messaging-frames.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backgroundSource = await readFile(path.join(root, 'src/background.js'), 'utf8');

function createPort(url, tabId) {
  const messages = [];
  let disconnectListener;
  return {
    name: 'webkeyboard-control',
    sender: { tab: { id: tabId }, frameId: 0, url },
    messages,
    onMessage: { addListener() {} },
    onDisconnect: { addListener(listener) { disconnectListener = listener; } },
    postMessage(message) { messages.push(message); },
    disconnect() { disconnectListener?.(); },
  };
}

function encodeNativeMessage(message) {
  const payload = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  if (os.endianness() === 'LE') header.writeUInt32LE(payload.length);
  else header.writeUInt32BE(payload.length);
  return Buffer.concat([header, payload]);
}

function createBackgroundHarness({ nativeEvents = false } = {}) {
  const originChoices = new Map([
    ['https://manual.example', { layoutId: 'xkb:de' }],
  ]);
  let context;
  let connectListener;
  let intervalCallback;
  const clearedIntervals = [];
  const nativePorts = [];
  const createNativePort = () => {
    const messageListeners = [];
    const disconnectListeners = [];
    let disconnected = false;
    const port = {
      onMessage: { addListener(listener) { messageListeners.push(listener); } },
      onDisconnect: { addListener(listener) { disconnectListeners.push(listener); } },
      postMessage(message) {
        const response = {
          id: message.id,
          layoutMap: context.currentSystemLayout.data,
          layoutName: context.currentSystemLayout.name,
        };
        if (message.action === 'watchLayoutChanges') {
          response.eventSupported = nativeEvents;
        }
        setTimeout(() => {
          if (!disconnected) messageListeners.forEach((listener) => listener(response));
        }, 0);
      },
      emit(message) {
        messageListeners.forEach((listener) => listener(message));
      },
      disconnect() {
        if (disconnected) return;
        disconnected = true;
        disconnectListeners.forEach((listener) => listener());
      },
      get disconnected() { return disconnected; },
    };
    nativePorts.push(port);
    return port;
  };
  context = {
    URL,
    browser: {
      runtime: {
        connectNative: createNativePort,
        onMessage: { addListener() {} },
        onConnect: { addListener(listener) { connectListener = listener; } },
      },
    },
    currentSystemLayout: {
      name: 'English (US)',
      data: { KeyA: 'a', KeyY: 'y', KeyZ: 'z' },
    },
    originChoices,
    console: { debug() {}, error() {} },
    setInterval(callback) {
      intervalCallback = callback;
      return 42;
    },
    clearInterval(id) { clearedIntervals.push(id); },
  };
  vm.createContext(context);
  vm.runInContext(backgroundSource, context);
  vm.runInContext(`
    layoutDatabase.get = async (store, key) =>
      store === 'origins' ? originChoices.get(key) ?? null : null;
    getSystemLayout = async () => currentSystemLayout;
  `, context);

  return {
    context,
    connectListener,
    nativePorts,
    get intervalCallback() { return intervalCallback; },
    clearedIntervals,
  };
}

async function settleMonitor(context) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (vm.runInContext(
      'systemLayoutMonitorMode !== "starting" && !systemLayoutMonitorStarting && !systemLayoutPollInFlight',
      context,
    )) return;
  }
  assert.fail('system layout monitor did not settle');
}

async function requestLayoutWatch(context, port) {
  context.testPort = port;
  await vm.runInContext(
    'handleControlRequest(testPort, testPort.sender, { operation: "watchLayoutChanges" })',
    context,
  );
  await settleMonitor(context);
}


test('layoutchange watcher emits only when a watched System map changes', async () => {
  const harness = createBackgroundHarness();
  const manual = createPort('https://manual.example/page', 1);
  harness.connectListener(manual);
  await requestLayoutWatch(harness.context, manual);
  assert.equal(harness.intervalCallback, undefined, 'manual layouts must not start system polling');

  const system = createPort('https://system.example/page', 2);
  harness.connectListener(system);
  await requestLayoutWatch(harness.context, system);
  assert.equal(typeof harness.intervalCallback, 'function');

  harness.context.currentSystemLayout = {
    name: 'German',
    data: { KeyA: 'a', KeyY: 'z', KeyZ: 'y' },
  };
  harness.intervalCallback();
  await settleMonitor(harness.context);

  const systemChanges = system.messages.filter((message) => message.type === 'layoutchange');
  assert.equal(systemChanges.length, 1);
  assert.equal(systemChanges[0].origin, 'https://system.example');
  assert.deepEqual(
    manual.messages.filter((message) => message.type === 'layoutchange'),
    [],
  );

  harness.intervalCallback();
  await settleMonitor(harness.context);
  assert.equal(system.messages.filter((message) => message.type === 'layoutchange').length, 1);

  system.disconnect();
  manual.disconnect();
  assert.deepEqual(harness.clearedIntervals, [42]);
});

test('native layout push relays changes without polling', async () => {
  const harness = createBackgroundHarness({ nativeEvents: true });
  const manual = createPort('https://manual.example/page', 1);
  const system = createPort('https://system.example/page', 2);
  harness.connectListener(manual);
  harness.connectListener(system);

  await requestLayoutWatch(harness.context, manual);
  await requestLayoutWatch(harness.context, system);
  assert.equal(
    vm.runInContext('systemLayoutMonitorMode', harness.context),
    'native',
  );
  assert.equal(harness.intervalCallback, undefined);

  const watchPort = harness.nativePorts[0];
  watchPort.emit({
    type: 'layoutchange',
    layoutName: 'German',
    layoutMap: { KeyA: 'a', KeyY: 'z', KeyZ: 'y' },
  });
  const systemChanges = system.messages.filter((message) => message.type === 'layoutchange');
  assert.equal(systemChanges.length, 1);
  assert.equal(systemChanges[0].origin, 'https://system.example');
  assert.equal(systemChanges[0].type, 'layoutchange');
  assert.deepEqual(
    manual.messages.filter((message) => message.type === 'layoutchange'),
    [],
  );

  watchPort.emit({
    type: 'layoutchange',
    layoutName: 'German',
    layoutMap: { KeyA: 'a', KeyY: 'z', KeyZ: 'y' },
  });
  assert.equal(
    system.messages.filter((message) => message.type === 'layoutchange').length,
    1,
  );

  system.disconnect();
  manual.disconnect();
  assert.equal(watchPort.disconnected, true);
});

test('disconnect during layout lookup does not retain a stale System origin', async () => {
  const harness = createBackgroundHarness();
  let resolveChoice;
  harness.context.pendingSystemLayoutChoice = () =>
    new Promise((resolve) => { resolveChoice = resolve; });
  vm.runInContext(
    'originUsesSystemLayout = pendingSystemLayoutChoice',
    harness.context,
  );

  const system = createPort('https://system.example/page', 4);
  harness.connectListener(system);
  harness.context.testPort = system;
  const registration = vm.runInContext(
    'handleControlRequest(testPort, testPort.sender, { operation: "watchLayoutChanges" })',
    harness.context,
  );
  assert.equal(typeof resolveChoice, 'function');

  system.disconnect();
  resolveChoice(true);
  await registration;

  assert.equal(
    vm.runInContext('systemLayoutOrigins.has("https://system.example")', harness.context),
    false,
  );
  assert.equal(
    vm.runInContext('systemLayoutMonitorMode', harness.context),
    'stopped',
  );
  assert.equal(harness.nativePorts.length, 0);
});

test('native frame parser allows unsolicited layout events around a response', () => {
  const event = {
    type: 'layoutchange',
    layoutName: 'German',
    layoutMap: { KeyY: 'z', KeyZ: 'y' },
  };
  const response = { id: 1, layoutMap: { KeyY: 'z' }, eventSupported: true };
  const frames = parseNativeMessageFrames(Buffer.concat([
    encodeNativeMessage(event),
    encodeNativeMessage(response),
    encodeNativeMessage(event),
  ]));

  assert.deepEqual(frames, [event, response, event]);
});
