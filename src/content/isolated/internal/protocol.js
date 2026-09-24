/** WebKeyboard content-to-background request transport. */
"use strict";

const request = (() => {
  const PORT_NAME = "webkeyboard-control";

  let port = null;
  const pending = new Map();
  let nextId = 0;
  let disconnected = false;

  /** Creates a transport state error. */
  function stateError(message) {
    return new DOMException(message, "InvalidStateError");
  }

  /** Connects the background control port. */
  function connect() {
    if (port || disconnected) return;

    try {
      port = browser.runtime.connect({ name: PORT_NAME });
    } catch (error) {
      disconnected = true;
      console.error("WebKeyboard: background port connection failed", error);
      return;
    }

    port.onMessage.addListener((message) => {
      if (!message || typeof message !== "object") return;
      if (message.type !== "response" || !Number.isInteger(message.id)) return;

      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) {
        const error = new Error(
          message.error.message || "WebKeyboard background error",
        );
        error.name = message.error.name || "Error";
        entry.reject(error);
      } else {
        entry.resolve(message.result);
      }
    });

    port.onDisconnect.addListener(() => {
      if (disconnected) return;
      disconnected = true;
      port = null;
      const error = stateError("WebKeyboard background connection closed");
      for (const entry of pending.values()) entry.reject(error);
      pending.clear();
    });
  }

  return (operation, payload = null) => {
    connect();
    if (disconnected || !port) {
      return Promise.reject(
        stateError("WebKeyboard background connection unavailable"),
      );
    }

    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      try {
        port.postMessage({ type: "request", id, operation, payload });
      } catch (error) {
        pending.delete(id);
        disconnected = true;
        port = null;
        reject(error);
      }
    });
  };
})();
