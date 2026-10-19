/** WebKeyboard background context router. */
"use strict";

let layoutCatalogPromise;
const layoutDataPromises = new Map();
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
      const effectiveId = savedId === "system" ? "xkb:us" : savedId;
      if (effectiveId.startsWith("custom:")) {
        const custom = await layoutDatabase.get("customLayouts", effectiveId.slice(7));
        return custom
          ? { layoutId: senderIsAddon ? savedId : effectiveId, data: custom.data }
          : { layoutId: senderIsAddon ? "system" : "xkb:us", data: (await getLayoutData("xkb:us")).data };
      }
      const layout = await getLayoutData(effectiveId) || await getLayoutData("xkb:us");
      return {
        layoutId: senderIsAddon ? savedId : effectiveId,
        data: layout.data,
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
