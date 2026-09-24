'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sourceMatcherSource = fs.readFileSync('src/policy-sources.js', 'utf8');
const backgroundSource = fs.readFileSync('src/policy.js', 'utf8');
const contentSource = fs.readFileSync(
  'src/content/isolated/internal/policy.js',
  'utf8',
);
const serviceSource = fs.readFileSync(
  'src/content/isolated/service.js',
  'utf8',
);
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function makePort(sender = null) {
  const messageListeners = [];
  const disconnectListeners = [];
  return {
    name: 'webkeyboard-policy',
    sender,
    posted: [],
    onMessage: { addListener(listener) { messageListeners.push(listener); } },
    onDisconnect: { addListener(listener) { disconnectListeners.push(listener); } },
    postMessage(message) { this.posted.push(message); },
    disconnect() { this.emitDisconnect(); },
    emitMessage(message) {
      for (const listener of messageListeners) listener(message);
    },
    emitDisconnect() {
      for (const listener of disconnectListeners) listener();
    },
  };
}

function makeBackground() {
  let beforeRequestListener;
  let headerListener;
  const connectListeners = [];
  const browser = {
    webRequest: {
      onBeforeRequest: {
        addListener(listener, filter) {
          beforeRequestListener = { listener, filter };
        },
      },
      onHeadersReceived: {
        addListener(listener, filter, extraInfoSpec) {
          headerListener = { listener, filter, extraInfoSpec };
        },
      },
    },
    runtime: {
      onConnect: { addListener(listener) { connectListeners.push(listener); } },
    },
  };
  const context = { browser, URL, Set, Map, Promise, console };
  vm.runInNewContext(`${sourceMatcherSource}\n${backgroundSource}`, context);

  return {
    browser,
    beforeRequestListener,
    headerListener,
    navigate(details) {
      const event = { ...details };
      beforeRequestListener.listener(event);
      if (details.observeHeaders !== false) headerListener.listener(event);
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
  const response = port.posted.find(
    (message) => message.type === 'response' && message.id === id,
  );
  assert.ok(response, `policy endpoint should answer request ${id}`);
  return response.result?.keyboardMap === 'granted';
}

function topNavigation(background, details = {}) {
  background.navigate({
    tabId: 1,
    frameId: 0,
    requestId: details.requestId || `top-${details.documentId || 'document'}`,
    documentId: details.documentId || 'top',
    url: 'https://parent.example/index.html',
    parentFrameId: -1,
    responseHeaders: [],
    ...details,
  });
}

function connect(background, details) {
  return background.connect({
    tab: { id: 1 },
    frameId: details.frameId,
    documentId: details.documentId,
    origin: details.origin,
    url: details.url,
    parentFrameId: details.parentFrameId,
  });
}

function findDelegationQuery(parent, frameId) {
  return parent.posted.find(
    (message) => message.action === 'frameDelegationQuery' &&
      message.childFrameId === frameId,
  );
}

async function answerDelegation(childPort, parentPort, frameId, delegated) {
  const id = frameId + 100;
  childPort.emitMessage({ type: 'request', id, operation: 'getPolicy' });
  await flush();
  await flush();
  const query = findDelegationQuery(parentPort, frameId);
  assert.ok(query, `delegation query for frame ${frameId}`);
  parentPort.emitMessage({
    action: 'frameDelegationResult',
    requestId: query.requestId,
    delegated,
  });
  await flush();
  await flush();
  const response = childPort.posted.find(
    (message) => message.type === 'response' && message.id === id,
  );
  assert.ok(response);
  return response.result?.keyboardMap === 'granted';
}

async function backgroundCases() {
  const background = makeBackground();
  assert.deepEqual(plain(background.headerListener.filter), {
    urls: ['<all_urls>'],
    types: ['main_frame', 'sub_frame'],
  });
  assert.deepEqual(plain(background.headerListener.extraInfoSpec), ['responseHeaders']);
  assert.deepEqual(plain(background.beforeRequestListener.filter), {
    urls: ['<all_urls>'],
    types: ['main_frame', 'sub_frame'],
  });

  topNavigation(background, { documentId: 'top-no-header' });
  const top = connect(background, {
    frameId: 0,
    documentId: 'top-no-header',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  });
  assert.equal(await policyResult(top, 1), true);

  topNavigation(background, {
    documentId: 'top-deny',
    responseHeaders: [{ name: 'Permissions-Policy', value: 'keyboard-map=()' }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 0,
    documentId: 'top-deny',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  }), 2), false);

  topNavigation(background, {
    documentId: 'top-self',
    responseHeaders: [{ name: 'Permissions-Policy', value: 'keyboard-map=self' }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 0,
    documentId: 'top-self',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  }), 3), true);

  topNavigation(background, {
    documentId: 'top-origin',
    responseHeaders: [{
      name: 'Permissions-Policy',
      value: 'keyboard-map="https://child.example"',
    }],
  });
  const originParent = connect(background, {
    frameId: 0,
    documentId: 'top-origin',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  });
  assert.equal(await policyResult(originParent, 4), false);

  topNavigation(background, {
    documentId: 'top-duplicate',
    responseHeaders: [{
      name: 'Permissions-Policy',
      value: 'keyboard-map=(), keyboard-map=*',
    }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 0,
    documentId: 'top-duplicate',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  }), 5), true);

  topNavigation(background, {
    documentId: 'top-duplicate-deny',
    responseHeaders: [{
      name: 'Permissions-Policy',
      value: 'keyboard-map=*, keyboard-map=()',
    }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 0,
    documentId: 'top-duplicate-deny',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  }), 6), false);

  topNavigation(background, {
    documentId: 'top-malformed',
    responseHeaders: [{
      name: 'Permissions-Policy',
      value: 'keyboard-map=(), camera=("unterminated',
    }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 0,
    documentId: 'top-malformed',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  }), 7), true);

  topNavigation(background, {
    documentId: 'top-list',
    responseHeaders: [{
      name: 'Permissions-Policy',
      value: 'keyboard-map=(self);report-to="foo"',
    }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 0,
    documentId: 'top-list',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  }), 31), true);
  topNavigation(background, {
    documentId: 'top-list-origin',
    responseHeaders: [{
      name: 'Permissions-Policy',
      value: 'keyboard-map=(self "https://example.com")',
    }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 0,
    documentId: 'top-list-origin',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  }), 32), true);

  topNavigation(background, {
    documentId: 'top-invalid-space',
    responseHeaders: [{ name: 'Permissions-Policy', value: 'keyboard-map = ()' }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 0,
    documentId: 'top-invalid-space',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  }), 8), true);

  topNavigation(background, {
    documentId: 'top-invalid-case',
    responseHeaders: [{ name: 'Permissions-Policy', value: 'Keyboard-Map=()' }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 0,
    documentId: 'top-invalid-case',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  }), 9), true);

  topNavigation(background, { documentId: 'top-parent' });
  const parent = connect(background, {
    frameId: 0,
    documentId: 'top-parent',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  });
  background.navigate({
    tabId: 1,
    frameId: 1,
    requestId: 'child-1',
    documentId: 'child-1',
    url: 'https://child.example/frame.html',
    parentFrameId: 0,
    responseHeaders: [],
  });
  const sameChild = connect(background, {
    frameId: 1,
    documentId: 'child-1',
    origin: 'https://child.example',
    url: 'https://child.example/frame.html',
  });
  assert.equal(await answerDelegation(sameChild, parent, 1, true), true);

  background.navigate({
    tabId: 1,
    frameId: 2,
    requestId: 'child-2',
    documentId: 'child-2',
    url: 'https://child.example/frame.html',
    parentFrameId: 0,
    responseHeaders: [],
  });
  const crossChild = connect(background, {
    frameId: 2,
    documentId: 'child-2',
    origin: 'https://child.example',
    url: 'https://child.example/frame.html',
  });
  assert.equal(await answerDelegation(crossChild, parent, 2, false), false);

  background.navigate({
    tabId: 1,
    frameId: 3,
    requestId: 'child-3',
    documentId: 'child-3',
    url: 'https://child.example/frame.html',
    parentFrameId: 0,
    responseHeaders: [{ name: 'Permissions-Policy', value: 'keyboard-map=()' }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 3,
    documentId: 'child-3',
    origin: 'https://child.example',
    url: 'https://child.example/frame.html',
  }), 10), false);

  background.navigate({
    tabId: 1,
    frameId: 4,
    requestId: 'unknown-http',
    documentId: 'unknown-http',
    url: 'https://unknown.example/frame.html',
    parentFrameId: 0,
    responseHeaders: [],
    observeHeaders: false,
  });
  const unknown = connect(background, {
    frameId: 4,
    documentId: 'unknown-http',
    origin: 'https://unknown.example',
    url: 'https://unknown.example/frame.html',
  });
  assert.equal(await policyResult(unknown, 11), false);

  background.navigate({
    tabId: 1,
    frameId: 5,
    requestId: 'redirect',
    documentId: 'redirect-old',
    url: 'https://child.example/old',
    parentFrameId: 0,
    responseHeaders: [{ name: 'Permissions-Policy', value: 'keyboard-map=()' }],
  });
  background.navigate({
    tabId: 1,
    frameId: 5,
    requestId: 'redirect',
    documentId: 'redirect-new',
    url: 'https://child.example/new',
    parentFrameId: 0,
    responseHeaders: [],
  });
  const redirectChild = connect(background, {
    frameId: 5,
    documentId: 'redirect-new',
    origin: 'https://child.example',
    url: 'https://child.example/new',
  });
  assert.equal(await answerDelegation(redirectChild, parent, 5, true), true);

  background.navigate({
    tabId: 1,
    frameId: 6,
    requestId: 'redirect-deny',
    documentId: 'redirect-allow',
    url: 'https://child.example/allow',
    parentFrameId: 0,
    responseHeaders: [{ name: 'Permissions-Policy', value: 'keyboard-map=*' }],
  });
  background.navigate({
    tabId: 1,
    frameId: 6,
    requestId: 'redirect-deny',
    documentId: 'redirect-deny',
    url: 'https://child.example/deny',
    parentFrameId: 0,
    responseHeaders: [{ name: 'Permissions-Policy', value: 'keyboard-map=()' }],
  });
  assert.equal(await policyResult(connect(background, {
    frameId: 6,
    documentId: 'redirect-deny',
    origin: 'https://child.example',
    url: 'https://child.example/deny',
  }), 12), false);

  background.navigate({
    tabId: 1,
    frameId: 7,
    requestId: 'replace-old',
    documentId: 'replace-old',
    url: 'https://child.example/same',
    parentFrameId: 0,
    responseHeaders: [],
  });
  const oldEndpoint = connect(background, {
    frameId: 7,
    documentId: 'replace-old',
    origin: 'https://child.example',
    url: 'https://child.example/same',
  });
  background.navigate({
    tabId: 1,
    frameId: 7,
    requestId: 'replace-new',
    documentId: 'replace-new',
    url: 'https://child.example/same',
    parentFrameId: 0,
    responseHeaders: [],
  });
  const newEndpoint = connect(background, {
    frameId: 7,
    documentId: 'replace-new',
    origin: 'https://child.example',
    url: 'https://child.example/same',
  });
  assert.equal(await answerDelegation(newEndpoint, parent, 7, true), true);
  oldEndpoint.emitMessage({ type: 'request', id: 99, operation: 'getPolicy' });
  await flush();
  assert.equal(oldEndpoint.posted.some((message) => message.id === 99), false);

  const nestedBackground = makeBackground();
  topNavigation(nestedBackground, {
    documentId: 'nested-top',
    responseHeaders: [{ name: 'Permissions-Policy', value: 'keyboard-map=()' }],
  });
  const nestedTop = connect(nestedBackground, {
    frameId: 0,
    documentId: 'nested-top',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  });
  for (const [frameId, documentId, url, parentFrameId] of [
    [1, 'nested-parent', 'https://parent.example/frame', 0],
    [2, 'nested-child', 'https://child.example/frame', 1],
  ]) {
    nestedBackground.navigate({
      tabId: 1,
      frameId,
      requestId: `nested-${frameId}`,
      documentId,
      url,
      parentFrameId,
      responseHeaders: [],
    });
  }
  connect(nestedBackground, {
    frameId: 1,
    documentId: 'nested-parent',
    origin: 'https://parent.example',
    url: 'https://parent.example/frame',
  });
  const nestedChild = connect(nestedBackground, {
    frameId: 2,
    documentId: 'nested-child',
    origin: 'https://child.example',
    url: 'https://child.example/frame',
  });
  assert.equal(await policyResult(nestedChild, 13), false);
  assert.equal(await policyResult(nestedTop, 14), false);

  const siblingBackground = makeBackground();
  topNavigation(siblingBackground, { documentId: 'siblings-top' });
  const siblingTop = connect(siblingBackground, {
    frameId: 0,
    documentId: 'siblings-top',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  });
  const siblings = [];
  for (const frameId of [1, 2]) {
    siblingBackground.navigate({
      tabId: 1,
      frameId,
      requestId: `sibling-${frameId}`,
      documentId: `sibling-${frameId}`,
      url: 'https://child.example/same',
      parentFrameId: 0,
      responseHeaders: [],
    });
    siblings.push(connect(siblingBackground, {
      frameId,
      documentId: `sibling-${frameId}`,
      origin: 'https://child.example',
      url: 'https://child.example/same',
    }));
  }
  assert.equal(await answerDelegation(siblings[0], siblingTop, 1, true), true);
  assert.equal(await answerDelegation(siblings[1], siblingTop, 2, false), false);

  const responseLessBackground = makeBackground();
  topNavigation(responseLessBackground, { documentId: 'about-top' });
  const responseLessTop = connect(responseLessBackground, {
    frameId: 0,
    documentId: 'about-top',
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  });
  const aboutChild = connect(responseLessBackground, {
    frameId: 1,
    documentId: 'about-child',
    origin: 'https://parent.example',
    url: 'about:blank',
    parentFrameId: 0,
  });
  assert.equal(await answerDelegation(aboutChild, responseLessTop, 1, true), true);
  const noDocumentBackground = makeBackground();
  noDocumentBackground.navigate({
    tabId: 1,
    frameId: 0,
    requestId: 'no-document',
    url: 'https://parent.example/index.html',
    parentFrameId: -1,
    responseHeaders: [],
  });
  assert.equal(await policyResult(connect(noDocumentBackground, {
    frameId: 0,
    origin: 'https://parent.example',
    url: 'https://parent.example/index.html',
  }), 15), true);
}

function sourceMatcherCases() {
  const context = { URL };
  vm.runInNewContext(
    `${sourceMatcherSource}\nglobalThis.sourceMatcherFixture = webKeyboardSources;`,
    context,
  );
  const matcher = context.sourceMatcherFixture;
  assert.equal(matcher.allows({ kind: 'sources', sources: [matcher.parse('http:', false)] }, 'https://a.example', 'https://self.example'), true);
  assert.equal(matcher.allows({ kind: 'sources', sources: [matcher.parse('http:', false)] }, 'http://a.example', 'https://self.example'), true);
  assert.equal(matcher.allows({ kind: 'sources', sources: [matcher.parse('https://*.example:8443', false)] }, 'https://a.example:8443', 'https://self.example'), true);
  assert.equal(matcher.allows({ kind: 'sources', sources: [matcher.parse('http://example.com', false)] }, 'https://example.com', 'https://self.example'), true);
  assert.equal(matcher.allows({ kind: 'sources', sources: [matcher.parse('http://example.com', false)] }, 'https://example.com:444', 'https://self.example'), false);
  assert.equal(matcher.allows({ kind: 'sources', sources: [matcher.parse('https://*.example', false)] }, 'https://a.example:444', 'https://self.example'), false);
  assert.equal(matcher.allows({ kind: 'sources', sources: [matcher.parse('https://example.com:*', false)] }, 'https://example.com:444', 'https://self.example'), true);
}

function makeContentPolicy(iframes, documentApi = true) {
  const port = makePort();
  const runtime = {
    connect() { return port; },
    getFrameId(contentWindow) { return contentWindow.frameId; },
  };
  if (documentApi) runtime.getDocumentId = (contentWindow) => contentWindow.documentId;
  const browser = { runtime };
  const document = {
    baseURI: 'https://parent.example/index.html',
    location: { origin: 'https://parent.example' },
    querySelectorAll() { return iframes; },
  };
  const context = {
    browser,
    document,
    URL,
    Promise,
    console,
  };
  vm.runInNewContext(
    `${sourceMatcherSource}\n${contentSource}\nglobalThis.keyboardPolicyFixture = keyboardPolicy;`,
    context,
  );
  return { port, policy: context.keyboardPolicyFixture };
}

async function contentCases() {
  function iframe({ allow = null, src = '', frameId = 1, documentId = 'child' }) {
    return {
      contentWindow: { frameId, documentId },
      getAttribute(name) {
        if (name === 'allow') return allow;
        if (name === 'src') return src;
        return null;
      },
    };
  }

  async function query(iframes, childOrigin, frameId = 1, documentId = 'child', documentApi = true) {
    const { port } = makeContentPolicy(iframes, documentApi);
    port.emitMessage({
      action: 'frameDelegationQuery',
      requestId: 'query-1',
      childFrameId: frameId,
      childDocumentId: documentId,
      childOrigin,
      parentOrigin: 'https://parent.example',
    });
    await flush();
    const response = port.posted.find((message) => message.action === 'frameDelegationResult');
    assert.ok(response);
    return response.delegated;
  }

  assert.equal(await query([iframe({})], 'https://parent.example'), true);
  assert.equal(await query([iframe({})], 'https://child.example'), false);
  assert.equal(await query([iframe({ allow: 'keyboard-map', src: 'https://child.example/frame' })], 'https://child.example'), true);
  assert.equal(await query([iframe({ allow: 'keyboard-map *' })], 'https://child.example'), true);
  assert.equal(await query([iframe({ allow: "keyboard-map 'src'", src: 'https://child.example/frame' })], 'https://child.example'), true);
  assert.equal(await query([iframe({ allow: "keyboard-map 'self'" })], 'https://parent.example'), true);
  assert.equal(await query([iframe({ allow: "keyboard-map 'none'" })], 'https://child.example'), false);
  assert.equal(await query([iframe({ allow: 'keyboard-map none' })], 'https://child.example'), false);
  assert.equal(await query([iframe({ allow: "keyboard-map 'none'; keyboard-map *" })], 'https://child.example'), true);
  assert.equal(await query([iframe({ allow: "keyboard-map *; keyboard-map 'none'" })], 'https://child.example'), false);
  assert.equal(await query([iframe({ allow: '', src: 'https://child.example/frame' })], 'https://child.example'), true);
  assert.equal(await query([iframe({ allow: "keyboard-map 'none'", frameId: 1 }), iframe({ allow: 'keyboard-map *', frameId: 2 })], 'https://child.example', 2), true);
  assert.equal(await query([iframe({ allow: 'keyboard-map *', frameId: 3, documentId: 'actual' })], 'https://child.example', 3, 'wrong'), false);
  assert.equal(await query([iframe({ allow: 'keyboard-map *', frameId: 3, documentId: 'actual' })], 'https://child.example', 3, 'wrong', false), true);
  assert.equal(await query([{ ...iframe({ allow: 'keyboard-map *', frameId: 4, documentId: 'child' }) }], 'https://child.example', 4), true);
}

async function serviceCases() {
  const operations = [];
  const context = {
    DOMException,
    Promise,
    Set,
    unwrap(value) { return value; },
    request(operation, payload) {
      operations.push({ operation, payload });
      return Promise.resolve();
    },
  };
  const setup = [
    'const window = { document: {}, wrappedJSObject: {} };',
    'window.wrappedJSObject.document = window.document;',
    'window.top = window;',
  ].join('\n');
  vm.runInNewContext(
    `${setup}\n${serviceSource}\nglobalThis.keyboardServiceFixture = keyboardService;`,
    context,
  );
  await context.keyboardServiceFixture.lock(['KeyW']);
  const lockOperation = operations.shift();
  assert.equal(lockOperation.operation, 'lock');
  context.keyboardServiceFixture.unlock();
  await flush();
  await flush();
  const unlockOperation = operations.shift();
  assert.equal(unlockOperation.operation, 'unlock');
}

(async () => {
  sourceMatcherCases();
  await backgroundCases();
  await contentCases();
  await serviceCases();
  console.log('keyboard-map policy fixture passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
