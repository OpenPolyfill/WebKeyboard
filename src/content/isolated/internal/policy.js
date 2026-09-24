/** Isolated-world policy transport and iframe delegation checks. */
"use strict";

const keyboardPolicy = (() => {
  const PORT_NAME = "webkeyboard-policy";
  const port = browser.runtime.connect({ name: PORT_NAME });
  const pending = new Map();
  let nextId = 0;

  function splitDirectives(value) {
    const parts = [];
    let start = 0;
    let quote = null;
    let escaped = false;
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ";") {
        parts.push(value.slice(start, index));
        start = index + 1;
      }
    }
    if (quote) return null;
    parts.push(value.slice(start));
    return parts;
  }

  function tokenizeDirective(value) {
    const tokens = [];
    let index = 0;
    while (index < value.length) {
      while (/\s/.test(value[index])) index += 1;
      if (index >= value.length) break;
      if (value[index] === '"' || value[index] === "'") {
        const quote = value[index++];
        let token = "";
        let closed = false;
        while (index < value.length) {
          const character = value[index++];
          if (character === "\\") {
            if (index >= value.length) return null;
            token += value[index++];
          } else if (character === quote) {
            closed = true;
            break;
          } else {
            token += character;
          }
        }
        if (!closed) return null;
        tokens.push({ value: token, quoted: true, quote });
      } else {
        const start = index;
        while (index < value.length && !/\s/.test(value[index])) index += 1;
        tokens.push({ value: value.slice(start, index), quoted: false, quote: null });
      }
    }
    return tokens;
  }

  function sourceOrigin(frame, parentOrigin) {
    let raw;
    try {
      raw = frame.getAttribute("src");
    } catch (_) {
      return null;
    }
    if (!raw) {
      try {
        return document.location?.origin || new URL(document.baseURI).origin || parentOrigin;
      } catch (_) {
        return parentOrigin;
      }
    }
    try {
      const origin = new URL(raw, document.baseURI).origin;
      return origin === "null" ? parentOrigin : origin;
    } catch (_) {
      return null;
    }
  }

  function containerAllows(frame, tokens, query) {
    for (const token of tokens) {
      const lower = token.value.toLowerCase();
      if (lower === "none") {
        if (token.quoted && token.quote === "'") continue;
        continue;
      }
      if (!token.quoted && token.value === "*") return true;
      if (lower === "self") {
        if (token.quoted && token.quote === "'" &&
            query.childOrigin === query.parentOrigin) return true;
        continue;
      }
      if (lower === "src") {
        if (token.quoted && token.quote === "'") {
          const origin = sourceOrigin(frame, query.parentOrigin);
          if (origin && origin === query.childOrigin) return true;
        }
        continue;
      }
      const source = webKeyboardSources.parse(token.value, token.quoted);
      if (source && webKeyboardSources.allows(
        { kind: "sources", sources: [source] },
        query.childOrigin,
        query.parentOrigin,
      )) return true;
    }
    return false;
  }

  function iframeAllowsKeyboardMap(frame, query) {
    let raw;
    try {
      raw = frame.getAttribute("allow");
    } catch (_) {
      return false;
    }
    if (raw === null) return query.childOrigin === query.parentOrigin;
    if (raw.trim() === "") {
      const origin = sourceOrigin(frame, query.parentOrigin);
      return !!origin && origin === query.childOrigin;
    }

    const declarations = splitDirectives(raw);
    if (!declarations) return false;
    let selected = null;
    for (const declaration of declarations) {
      const tokens = tokenizeDirective(declaration.trim());
      if (!tokens || tokens.length === 0) continue;
      if (tokens[0].value.toLowerCase() !== "keyboard-map") continue;
      selected = tokens.slice(1);
    }
    if (selected === null) return query.childOrigin === query.parentOrigin;
    if (selected.length === 0) {
      selected = [{ value: "src", quoted: true, quote: "'" }];
    }
    return containerAllows(frame, selected, query);
  }

  async function frameDelegationForChild(query) {
    try {
      const getFrameId = browser.runtime.getFrameId;
      if (typeof getFrameId !== "function") return false;
      const getDocumentId = typeof browser.runtime.getDocumentId === "function"
        ? browser.runtime.getDocumentId
        : null;

      for (const frame of document.querySelectorAll("iframe,frame")) {
        let frameId;
        try {
          frameId = await getFrameId(frame.contentWindow);
        } catch (_) {
          continue;
        }
        if (frameId !== query.childFrameId) continue;

        if (getDocumentId && query.childDocumentId) {
          let documentId;
          try {
            documentId = await getDocumentId(frame.contentWindow);
          } catch (_) {
            return false;
          }
          if (documentId !== query.childDocumentId) return false;
        }
        return iframeAllowsKeyboardMap(frame, query);
      }
    } catch (_) {}
    return false;
  }

  function request(operation) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        port.postMessage({ type: "request", id, operation });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }

  port.onMessage.addListener((message) => {
    if (!message) return;
    if (message.action === "frameDelegationQuery") {
      frameDelegationForChild(message).then((delegated) => {
        try {
          port.postMessage({
            action: "frameDelegationResult",
            requestId: message.requestId,
            delegated,
          });
        } catch (_) {}
      });
      return;
    }
    if (message.type !== "response" || !Number.isInteger(message.id)) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(message.error);
    else entry.resolve(message.result);
  });

  async function allowsKeyboardMap() {
    try {
      const result = await request("getPolicy");
      return result?.keyboardMap === "granted";
    } catch (_) {
      return false;
    }
  }

  return { allowsKeyboardMap };
})();
