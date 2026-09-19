/** WebKeyboard background context router. */
"use strict";

const CONTROL_PORT_NAME = "webkeyboard-control";

const lockOwners = new Map();

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
    debug("control port disconnected", { tabId, frameId });

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
