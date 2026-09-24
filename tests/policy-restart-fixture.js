'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sourceMatcherSource = fs.readFileSync('src/policy-sources.js', 'utf8');
const backgroundSource = fs.readFileSync('src/policy.js', 'utf8');

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function makePort(sender) {
  const messageListeners = [];
  const disconnectListeners = [];
  return {
    name: 'webkeyboard-policy',
    sender,
    posted: [],
    onMessage: { addListener(listener) { messageListeners.push(listener); } },
    onDisconnect: { addListener(listener) { disconnectListeners.push(listener); } },
    postMessage(message) { this.posted.push(message); },
    emitMessage(message) {
      for (const listener of messageListeners) listener(message);
    },
    emitDisconnect() {
      for (const listener of disconnectListeners) listener();
    },
  };
}

function makeSessionStorage(backing) {
  return {
    async get(key) {
      if (typeof key === 'string') {
        return backing.has(key) ? { [key]: structuredClone(backing.get(key)) } : {};
      }
      throw new Error('fixture only supports string keys');
    },
    async set(values) {
      for (const [key, value] of Object.entries(values)) {
        backing.set(key, structuredClone(value));
      }
    },
  };
}

function makeBackground(sessionBacking) {
  let beforeRequestListener;
  let headerListener;
  const connectListeners = [];
  const browser = {
    storage: { session: makeSessionStorage(sessionBacking) },
    webRequest: {
      onBeforeRequest: {
        addListener(listener) { beforeRequestListener = listener; },
      },
      onHeadersReceived: {
        addListener(listener) { headerListener = listener; },
      },
    },
    runtime: {
      onConnect: { addListener(listener) { connectListeners.push(listener); } },
    },
  };
  const context = { browser, URL, Set, Map, Promise, console };
  vm.runInNewContext(`${sourceMatcherSource}\n${backgroundSource}`, context);
  return {
    navigate(details) {
      beforeRequestListener(details);
      headerListener(details);
    },
    connect(sender) {
      const port = makePort(sender);
      for (const listener of connectListeners) listener(port);
      return port;
    },
  };
}

async function policyResult(port, id) {
  port.emitMessage({ type: 'request', id, operation: 'getPolicy' });
  await flush();
  await flush();
  await flush();
  const response = port.posted.find(
    (message) => message.type === 'response' && message.id === id,
  );
  assert.ok(response, `policy endpoint should answer request ${id}`);
  return response.result?.keyboardMap;
}

function sender(documentId = 'live-document') {
  return {
    tab: { id: 7 },
    frameId: 0,
    documentId,
    origin: 'https://example.test',
    url: 'https://example.test/index.html',
    parentFrameId: -1,
  };
}

async function restartCase(responseHeaders, expected) {
  const sessionBacking = new Map();
  let background = makeBackground(sessionBacking);
  background.navigate({
    tabId: 7,
    frameId: 0,
    requestId: 'navigation',
    documentId: 'live-document',
    url: 'https://example.test/index.html',
    parentFrameId: -1,
    responseHeaders,
  });

  const firstPort = background.connect(sender());
  const before = await policyResult(firstPort, 1);
  assert.equal(before, expected);
  assert.ok(sessionBacking.size > 0, 'policy snapshot persisted before restart');

  firstPort.emitDisconnect();
  background = null;

  const restarted = makeBackground(sessionBacking);
  const secondPort = restarted.connect(sender());
  const after = await policyResult(secondPort, 2);
  assert.equal(after, before);
}

(async () => {
  await restartCase([], 'granted');
  await restartCase(
    [{ name: 'Permissions-Policy', value: 'keyboard-map=()' }],
    'denied',
  );

  const sessionBacking = new Map();
  const first = makeBackground(sessionBacking);
  first.navigate({
    tabId: 7,
    frameId: 0,
    requestId: 'navigation',
    documentId: 'document-a',
    url: 'https://example.test/index.html',
    parentFrameId: -1,
    responseHeaders: [],
  });
  assert.equal(await policyResult(first.connect(sender('document-a')), 3), 'granted');

  const restarted = makeBackground(sessionBacking);
  assert.equal(
    await policyResult(restarted.connect(sender('document-b')), 4),
    'denied',
    'persisted documentId must not authorize a different document',
  );

  console.log('keyboard-map policy restart fixture passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
