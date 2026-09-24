'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const permissionsSource = fs.readFileSync(
  'src/content/isolated/internal/permissions.js',
  'utf8',
);
const source = fs.readFileSync('src/content/isolated/facade.js', 'utf8');
const pageMapSizeGetter = Reflect.getOwnPropertyDescriptor(
  Map.prototype,
  'size',
).get;

function makeEnvironment(allowed, previousQuery) {
  const permissions = { query: previousQuery };
  class PagePermissionStatus extends EventTarget {}
  class PageNavigator {}
  Object.defineProperty(PageNavigator.prototype, 'userAgent', {
    get() { return 'fixture'; },
  });

  const pageWindow = {
    navigator: { permissions },
    PermissionStatus: PagePermissionStatus,
  };
  const window = {
    Object,
    EventTarget,
    Navigator: PageNavigator,
    isSecureContext: false,
    navigator: pageWindow.navigator,
    wrappedJSObject: pageWindow,
  };
  const context = {
    window,
    keyboardPolicy: {
      allowsKeyboardMap() {
        return Promise.resolve(allowed);
      },
    },
    unwrap(value) { return value; },
    exportToPage(fn) { return fn; },
    definePageProperty(target, key, descriptor) {
      Object.defineProperty(target, key, descriptor);
    },
    setPagePrototype(target, prototype) {
      Object.setPrototypeOf(target, prototype);
    },
    createPageMap() { return new Map(); },
    pageMapSizeGetter,
    pageMapGet: Map.prototype.get,
    pageMapHas: Map.prototype.has,
    pageMapSet: Map.prototype.set,
    pageMapEntries: Map.prototype.entries,
    pageMapKeys: Map.prototype.keys,
    pageMapValues: Map.prototype.values,
    pageMapForEach: Map.prototype.forEach,
    pageTypeError(message) { return new TypeError(message); },
    pagePromise(task) {
      return Promise.resolve().then(task);
    },
    rejectedPagePromise(error) {
      return Promise.reject(error);
    },
  };

  vm.runInNewContext(`${permissionsSource}\n${source}`, context);
  return { permissions, PagePermissionStatus };
}

async function queryState(label, allowed) {
  const previousQuery = () => Promise.resolve({ state: 'previous' });
  const { permissions, PagePermissionStatus } = makeEnvironment(
    allowed,
    previousQuery,
  );
  const status = await permissions.query({ name: 'keyboard-map' });
  assert.equal(status.state, allowed ? 'granted' : 'denied', label);
  assert.equal(status instanceof PagePermissionStatus, true);
  assert.equal(typeof status.addEventListener, 'function');
  assert.equal(typeof status.removeEventListener, 'function');
  assert.equal(typeof status.dispatchEvent, 'function');

  let firstChanges = 0;
  let secondChanges = 0;
  status.onchange = () => {
    firstChanges += 1;
  };
  status.onchange = () => {
    secondChanges += 1;
  };
  status.dispatchEvent(new Event('change'));
  assert.equal(firstChanges, 0);
  assert.equal(secondChanges, 1);
  status.onchange = null;
  status.dispatchEvent(new Event('change'));
  assert.equal(secondChanges, 1);
}

async function stackingCases() {
  const calls = [];
  const previousResult = { source: 'previous-wrapper' };
  const previousQuery = function (descriptor) {
    calls.push({ receiver: this, descriptor, arguments });
    return Promise.resolve(previousResult);
  };
  const { permissions } = makeEnvironment(true, previousQuery);

  assert.equal(permissions.query.name, 'query');
  assert.equal(permissions.query.length, 1);

  const geolocation = { name: 'geolocation' };
  assert.equal(await permissions.query(geolocation), previousResult);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].receiver, permissions);
  assert.equal(calls[0].descriptor, geolocation);
  assert.equal(calls[0].arguments.length, 1);
  assert.equal(calls[0].arguments[0], geolocation);

  const otherPolyfill = { name: 'some-other-polyfilled-feature' };
  assert.equal(await permissions.query(otherPolyfill), previousResult);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].descriptor, otherPolyfill);

  const status = await permissions.query({ name: 'keyboard-map' });
  assert.equal(status.state, 'granted');
  assert.equal(calls.length, 2, 'keyboard-map must not recurse to previous query');
}

(async () => {
  await queryState('allowed top-level document', true);
  await queryState('Permissions-Policy keyboard-map=()', false);
  await queryState('same-origin delegated iframe', true);
  await queryState('cross-origin iframe without delegation', false);
  await queryState('cross-origin iframe explicitly delegated', true);
  await queryState('ancestor deny plus descendant allow', false);
  await stackingCases();
  console.log('stacked permissions fixture passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
