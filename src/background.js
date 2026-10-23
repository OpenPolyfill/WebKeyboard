/** WebKeyboard background context router. */
"use strict";

let layoutCatalogPromise;
const CONTROL_PORT_NAME = "webkeyboard-control";
const lockOwners = new Map();
const layoutDataPromises = new Map();

const NATIVE_LAYOUT_HOST = "com.openpolyfill.webkeyboard";
const nativeLayoutRequests = new Map();
let nativeLayoutPort;
let nativeLayoutWatchPort;
let nextNativeLayoutRequestId = 0;

function attachNativeLayoutPort(port) {
  port.onMessage.addListener((message) => {
    if (message?.type === "layoutchange") {
      if (port === nativeLayoutWatchPort) handleNativeLayoutChange(message);
      return;
    }
    if (!Number.isSafeInteger(message?.id)) return;
    const pending = nativeLayoutRequests.get(message.id);
    if (!pending) return;
    nativeLayoutRequests.delete(message.id);
    pending.resolve({
      available: message && Object.prototype.hasOwnProperty.call(message, "layoutMap"),
      layoutMap: message?.layoutMap,
      layoutName: typeof message?.layoutName === "string" ? message.layoutName : null,
      eventSupported: message?.eventSupported === true,
    });
  });
  port.onDisconnect.addListener(() => {
    if (nativeLayoutPort === port) nativeLayoutPort = undefined;
    if (nativeLayoutWatchPort === port) {
      nativeLayoutWatchPort = undefined;
      if (
        systemLayoutMonitorMode === "native" &&
        watchedSystemOrigins().size !== 0
      ) {
        startSystemLayoutPolling();
      }
    }
    for (const [id, pending] of nativeLayoutRequests) {
      if (pending.port !== port) continue;
      pending.resolve({ available: false, eventSupported: false });
      nativeLayoutRequests.delete(id);
    }
  });
}

function connectNativeLayoutHost() {
  if (nativeLayoutPort) return nativeLayoutPort;
  let port;
  try {
    port = browser.runtime.connectNative(NATIVE_LAYOUT_HOST);
  } catch {
    return null;
  }
  nativeLayoutPort = port;
  attachNativeLayoutPort(port);
  return port;
}

function connectNativeLayoutWatchHost() {
  if (nativeLayoutWatchPort) return nativeLayoutWatchPort;
  let port;
  try {
    port = browser.runtime.connectNative(NATIVE_LAYOUT_HOST);
  } catch {
    return null;
  }
  nativeLayoutWatchPort = port;
  attachNativeLayoutPort(port);
  return port;
}

function requestNativeLayout(port, action) {
  const id = ++nextNativeLayoutRequestId;
  return new Promise((resolve) => {
    nativeLayoutRequests.set(id, { port, resolve });
    try {
      port.postMessage({ id, action });
    } catch {
      nativeLayoutRequests.delete(id);
      if (nativeLayoutPort === port) nativeLayoutPort = undefined;
      if (nativeLayoutWatchPort === port) nativeLayoutWatchPort = undefined;
      resolve({ available: false, eventSupported: false });
    }
  });
}

async function getSystemLayout() {
  const port = connectNativeLayoutHost();
  if (!port) return fallbackSystemLayout();
  const response = await requestNativeLayout(port, "getLayout");
  if (!response.available) return fallbackSystemLayout();
  return {
    data: validLayoutData(response.layoutMap) ? response.layoutMap : {},
    name: response.layoutName,
  };
}

async function fallbackSystemLayout() {
  const layout = await getLayoutData("xkb:us");
  return { data: layout?.data || {}, name: layout?.name || "English (US)" };
}


function getLayoutCatalog() {
  if (!layoutCatalogPromise) {
    layoutCatalogPromise = fetch(browser.runtime.getURL("layouts/index.json"))
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load bundled XKB layout index");
        return response.json();
      })
      .then((catalog) => catalog.layouts);
  }
  return layoutCatalogPromise;
}
async function getLayoutData(id) {
  const entry = (await getLayoutCatalog()).find((layout) => layout.id === id);
  if (!entry) return null;
  if (!layoutDataPromises.has(id)) {
    layoutDataPromises.set(
      id,
      fetch(browser.runtime.getURL(`layouts/${entry.file}`))
        .then((response) => {
          if (!response.ok) throw new Error(`Unable to load XKB layout ${id}`);
          return response.json();
        })
        .then((layout) => {
          if (
            layout.id !== id ||
            typeof layout.name !== "string" ||
            !validLayoutData(layout.data)
          ) {
            throw new Error(`Invalid bundled XKB layout ${id}`);
          }
          return layout;
        }),
    );
  }
  return layoutDataPromises.get(id);
}

const layoutPorts = new Set();
const layoutWatchPorts = new Set();
const systemLayoutOrigins = new Set();
const SYSTEM_LAYOUT_POLL_INTERVAL_MS = 1000;
let systemLayoutPollTimer;
let systemLayoutMonitorMode = "stopped";
let systemLayoutMonitorStarting;
let systemLayoutMonitorGeneration = 0;
let lastSystemLayoutSignature;
let pendingNativeSystemLayout;
let systemLayoutPollInFlight = false;
function notifyOriginLayoutChange(origin) {
  for (const port of layoutPorts) {
    if (canonicalOrigin(port.sender?.url) !== origin) continue;
    try {
      port.postMessage({ type: "layoutchange", origin });
    } catch {
      layoutPorts.delete(port);
    }
  }
}
const layoutDatabase = (() => {
  let opening;
  function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open("webkeyboard-layouts", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("origins", { keyPath: "origin" });
        db.createObjectStore("customLayouts", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return opening;
  }
  async function run(store, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const result = action(tx.objectStore(store));
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  return {
    get: (store, key) => run(store, "readonly", (s) => s.get(key)),
    all: (store) => run(store, "readonly", (s) => s.getAll()),
    put: (store, value) => run(store, "readwrite", (s) => s.put(value)),
    delete: (store, key) => run(store, "readwrite", (s) => s.delete(key)),
  };
})();

function systemLayoutSignature(layout) {
  const entries = Object.entries(layout?.data || {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return JSON.stringify([
    typeof layout?.name === "string" ? layout.name : null,
    entries,
  ]);
}

async function originUsesSystemLayout(origin) {
  const choice = await layoutDatabase.get("origins", origin);
  if (!choice?.layoutId || choice.layoutId === "system") return true;
  if (choice.layoutId.startsWith("custom:")) {
    const custom = await layoutDatabase.get("customLayouts", choice.layoutId.slice(7));
    return !custom;
  }
  return false;
}

function publishSystemLayoutChange(layout) {
  const origins = watchedSystemOrigins();
  if (origins.size === 0) {
    stopSystemLayoutWatcher();
    return;
  }
  const signature = systemLayoutSignature(layout);
  if (lastSystemLayoutSignature === undefined) {
    lastSystemLayoutSignature = signature;
    return;
  }
  if (signature === lastSystemLayoutSignature) return;
  lastSystemLayoutSignature = signature;
  for (const origin of origins) notifyOriginLayoutChange(origin);
}

function handleNativeLayoutChange(message) {
  if (!validLayoutData(message.layoutMap)) return;
  const layout = {
    data: message.layoutMap,
    name: typeof message.layoutName === "string" ? message.layoutName : null,
  };
  if (
    systemLayoutMonitorMode === "starting" &&
    lastSystemLayoutSignature === undefined
  ) {
    pendingNativeSystemLayout = layout;
    return;
  }
  publishSystemLayoutChange(layout);
}

async function pollSystemLayoutChange() {
  if (
    systemLayoutMonitorMode !== "poll" ||
    systemLayoutPollInFlight ||
    watchedSystemOrigins().size === 0
  ) {
    return;
  }
  systemLayoutPollInFlight = true;
  try {
    publishSystemLayoutChange(await getSystemLayout());
  } catch (error) {
    debug("system layout monitor failed", serializeError(error));
  } finally {
    systemLayoutPollInFlight = false;
  }
}

function watchedSystemOrigins() {
  const origins = new Set();
  for (const port of layoutWatchPorts) {
    if (!layoutPorts.has(port)) continue;
    const origin = canonicalOrigin(port.sender?.url);
    if (origin && systemLayoutOrigins.has(origin)) origins.add(origin);
  }
  return origins;
}

function startSystemLayoutPolling() {
  if (watchedSystemOrigins().size === 0) return;
  if (systemLayoutMonitorMode === "stopped" || systemLayoutMonitorMode === "starting") {
    lastSystemLayoutSignature = undefined;
  }
  systemLayoutMonitorMode = "poll";
  pendingNativeSystemLayout = undefined;
  if (systemLayoutPollTimer) return;
  systemLayoutPollTimer = setInterval(
    () => void pollSystemLayoutChange(),
    SYSTEM_LAYOUT_POLL_INTERVAL_MS,
  );
  void pollSystemLayoutChange();
}

function startSystemLayoutWatcher() {
  if (watchedSystemOrigins().size === 0) {
    stopSystemLayoutWatcher();
    return;
  }
  if (systemLayoutMonitorMode !== "stopped" || systemLayoutMonitorStarting) return;

  const generation = ++systemLayoutMonitorGeneration;
  systemLayoutMonitorMode = "starting";
  lastSystemLayoutSignature = undefined;
  pendingNativeSystemLayout = undefined;
  const starting = (async () => {
    const port = connectNativeLayoutWatchHost();
    if (!port) {
      startSystemLayoutPolling();
      return;
    }
    const response = await requestNativeLayout(port, "watchLayoutChanges");
    if (
      generation !== systemLayoutMonitorGeneration ||
      watchedSystemOrigins().size === 0
    ) {
      if (nativeLayoutWatchPort === port) {
        nativeLayoutWatchPort = undefined;
        port.disconnect();
      }
      return;
    }
    if (response.available && response.eventSupported) {
      systemLayoutMonitorMode = "native";
      lastSystemLayoutSignature = systemLayoutSignature({
        data: validLayoutData(response.layoutMap) ? response.layoutMap : {},
        name: response.layoutName,
      });
      const pending = pendingNativeSystemLayout;
      pendingNativeSystemLayout = undefined;
      if (pending) publishSystemLayoutChange(pending);
      return;
    }
    if (nativeLayoutWatchPort === port) {
      nativeLayoutWatchPort = undefined;
      port.disconnect();
    }
    startSystemLayoutPolling();
  })();
  systemLayoutMonitorStarting = starting;
  void starting.finally(() => {
    if (systemLayoutMonitorStarting === starting) {
      systemLayoutMonitorStarting = undefined;
    }
  });
}

function stopSystemLayoutWatcher() {
  if (watchedSystemOrigins().size !== 0) return;
  systemLayoutMonitorGeneration += 1;
  systemLayoutMonitorStarting = undefined;
  if (systemLayoutPollTimer) {
    clearInterval(systemLayoutPollTimer);
    systemLayoutPollTimer = undefined;
  }
  if (nativeLayoutWatchPort) {
    const port = nativeLayoutWatchPort;
    nativeLayoutWatchPort = undefined;
    port.disconnect();
  }
  systemLayoutMonitorMode = "stopped";
  lastSystemLayoutSignature = undefined;
  pendingNativeSystemLayout = undefined;
}

async function updateSystemLayoutWatcher(origin) {
  const isWatched = [...layoutWatchPorts].some(
    (port) => layoutPorts.has(port) && canonicalOrigin(port.sender?.url) === origin,
  );
  if (!isWatched) return;
  const usesSystemLayout = await originUsesSystemLayout(origin);
  const stillWatched = [...layoutWatchPorts].some(
    (port) => layoutPorts.has(port) && canonicalOrigin(port.sender?.url) === origin,
  );
  if (!stillWatched) return;
  if (usesSystemLayout) systemLayoutOrigins.add(origin);
  else systemLayoutOrigins.delete(origin);
  if (watchedSystemOrigins().size === 0) stopSystemLayoutWatcher();
  else startSystemLayoutWatcher();
}

function validLayoutData(data) {
  return data && typeof data === "object" && !Array.isArray(data) &&
    Object.entries(data).every(([code, value]) =>
      /^(Key[A-Z]|Digit[0-9]|Backquote|Backslash|BracketLeft|BracketRight|Comma|Equal|Minus|Period|Quote|Semicolon|Slash|IntlBackslash|IntlRo|IntlYen)$/.test(code) &&
      typeof value === "string" && value.length > 0,
    );
}

function canonicalOrigin(value) {
  try {
    const origin = new URL(value).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

async function handleLayoutMessage(message, sender) {
  const senderIsAddon = sender.url?.startsWith(browser.runtime.getURL(""));
  const origin = senderIsAddon
    ? canonicalOrigin(message.origin)
    : canonicalOrigin(sender.url);
  switch (message.action) {
    case "getLayout": {
      const choice = await layoutDatabase.get("origins", origin);
      const legacyIds = { US: "xkb:us", UK: "xkb:gb", DE: "xkb:de", FR: "xkb:fr" };
      const savedId = choice?.layoutId === "system"
        ? "system"
        : legacyIds[choice?.layoutId] || choice?.layoutId || "system";
      let systemLayout = senderIsAddon || savedId === "system"
        ? await getSystemLayout()
        : undefined;
      if (savedId === "system") {
        return {
          layoutId: "system",
          data: systemLayout.data,
          systemLayoutName: systemLayout.name,
        };
      }
      if (savedId.startsWith("custom:")) {
        const custom = await layoutDatabase.get("customLayouts", savedId.slice(7));
        if (custom) {
          return {
            layoutId: savedId,
            data: custom.data,
            ...(systemLayout ? { systemLayoutName: systemLayout.name } : {}),
          };
        }
        systemLayout ||= await getSystemLayout();
        return {
          layoutId: "system",
          data: systemLayout.data,
          systemLayoutName: systemLayout.name,
        };
      }
      const layout = await getLayoutData(savedId) || await getLayoutData("xkb:us");
      return {
        layoutId: savedId,
        data: layout.data,
        ...(systemLayout ? { systemLayoutName: systemLayout.name } : {}),
      };
    }
    case "setOriginLayout": {
      if (!senderIsAddon || !origin) throw new Error("Layout selection requires the addon popup");
      const id = message.layoutId;
      const custom = typeof id === "string" && id.startsWith("custom:") &&
        await layoutDatabase.get("customLayouts", id.slice(7));
      if (!(id === "system" || (await getLayoutCatalog()).some((x) => x.id === id) || custom)) throw new Error("Invalid layout selection");
      const current = await layoutDatabase.get("origins", origin);
      await layoutDatabase.put("origins", { origin, layoutId: id });
      await updateSystemLayoutWatcher(origin);
      if (current?.layoutId !== id) notifyOriginLayoutChange(origin);
      return true;
    }
    case "listLayouts": {
      if (!senderIsAddon) throw new Error("Invalid layout selector");
      const layouts = await Promise.all(
        (await getLayoutCatalog()).map((entry) => getLayoutData(entry.id)),
      );
      return layouts.map(({ id, name }) => ({ id, name }));
    }
    case "getLayoutPreset": {
      if (!senderIsAddon) throw new Error("Invalid layout editor");
      const layout = await getLayoutData(message.id);
      if (!layout) throw new Error("Unknown bundled layout");
      return layout;
    }
    case "listCustomLayouts":
      if (!senderIsAddon) throw new Error("Invalid layout editor");
      return layoutDatabase.all("customLayouts");
    case "saveCustomLayout": {
      const item = message.layout;
      if (!senderIsAddon || !item || typeof item.name !== "string" || !item.name.trim() || !validLayoutData(item.data)) throw new Error("Invalid custom layout");
      const saved = { id: item.id || crypto.randomUUID(), name: item.name.trim(), data: item.data };
      await layoutDatabase.put("customLayouts", saved);
      return saved;
    }
    case "deleteCustomLayout":
      if (!senderIsAddon) throw new Error("Invalid layout editor");
      await layoutDatabase.delete("customLayouts", message.id);
      return true;
    default:
      throw new Error("Unsupported layout operation");
  }
}

browser.runtime.onMessage?.addListener((message, sender) => {
  if (!message || message.type !== "webkeyboard-layout") return undefined;
  return handleLayoutMessage(message, sender);
});

/**
 * Writes a structured WebKeyboard debug message.
 * @param {string} event Debug event name.
 * @param {*} details Optional details.
 */
function debug(event, details) {
  if (details === undefined) {
    console.debug(`${event}`);
  } else {
    console.debug(`${event}`, details);
  }
}

/**
 * Converts an error to a message-safe object.
 * @param {*} error Error value.
 * @returns {{name:string,message:string}} Serialized error.
 */
function serializeError(error) {
  return {
    name: typeof error?.name === "string" ? error.name : "Error",
    message: typeof error?.message === "string" ? error.message : String(error),
  };
}

/**
 * Sends a control-port response.
 * @param {browser.runtime.Port} port Destination port.
 * @param {number} id Request identifier.
 * @param {*} result Successful result.
 * @param {*} error Failure value.
 */
function reply(port, id, result, error) {
  try {
    port.postMessage({
      type: "response",
      id,
      ...(error ? { error: serializeError(error) } : { result }),
    });
  } catch {}
}

/**
 * Handles one isolated content request.
 * @param {browser.runtime.Port} port Requesting port.
 * @param {browser.runtime.MessageSender} sender Port sender.
 * @param {object} request Control request.
 * @returns {Promise<*>} Operation result.
 */
async function handleControlRequest(port, sender, request) {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) {
    throw new Error("WebKeyboard request has no tab");
  }

  switch (request.operation) {
    case "getKeyboardBackend": {
      try {
        return {
          privileged:
            typeof browser.keyboard?.lock === "function" &&
            typeof browser.keyboard?.unlock === "function",
        };
      } catch {
        return { privileged: false };
      }
    }
    case "lock": {
      const codes = request.payload;
      lockOwners.set(tabId, port);
      debug("lock request", { tabId, codes });

      try {
        await browser.keyboard.lock(tabId, codes);
        debug("lock applied", { tabId, codes });
        return undefined;
      } catch (error) {
        if (lockOwners.get(tabId) === port) {
          lockOwners.delete(tabId);
        }
        console.error("lock failed", { tabId, error });
        throw error;
      }
    }

    case "unlock": {
      const owner = lockOwners.get(tabId);
      if (owner && owner !== port) {
        debug("unlock ignored for stale document", { tabId });
        return undefined;
      }

      lockOwners.delete(tabId);
      await browser.keyboard.unlock(tabId);
      debug("unlock applied", { tabId });
      return undefined;
    }

    case "watchLayoutChanges": {
      const origin = canonicalOrigin(sender.url);
      if (!origin) throw new Error("Layout change watch has no page origin");
      layoutWatchPorts.add(port);
      await updateSystemLayoutWatcher(origin);
      return undefined;
    }
    default:
      throw new DOMException(
        "Unsupported WebKeyboard operation",
        "NotSupportedError",
      );
  }
}

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== CONTROL_PORT_NAME || !port.sender?.tab) return;

  const sender = port.sender;
  const tabId = sender.tab.id;
  const frameId = sender.frameId;
  layoutPorts.add(port);
  debug("control port connected", { tabId, frameId });

  port.onMessage.addListener((request) => {
    if (
      !request ||
      request.type !== "request" ||
      !Number.isInteger(request.id)
    ) {
      return;
    }

    handleControlRequest(port, sender, request).then(
      (result) => reply(port, request.id, result, null),
      (error) => reply(port, request.id, null, error),
    );
  });

  port.onDisconnect.addListener(() => {
    layoutPorts.delete(port);
    layoutWatchPorts.delete(port);
    const origin = canonicalOrigin(sender.url);
    if (origin && ![...layoutWatchPorts].some(
      (watchPort) => canonicalOrigin(watchPort.sender?.url) === origin,
    )) {
      systemLayoutOrigins.delete(origin);
    }
    stopSystemLayoutWatcher();

    if (lockOwners.get(tabId) !== port) return;

    lockOwners.delete(tabId);
    browser.keyboard.unlock(tabId).then(
      () => debug("lock cleared on document disconnect", { tabId }),
      (error) =>
        console.error("disconnect unlock failed", {
          tabId,
          error,
        }),
    );
  });
});
