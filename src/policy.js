/** Permissions Policy enforcement for the keyboard-map feature. */
"use strict";

const permissionsPolicy = new Map();
const frameDelegations = new Map();
const frameEndpoints = new Map();
const currentEndpointByFrame = new Map();
const pendingDelegations = new Map();
const pendingNavigations = new Map();

const ALLOW_ALL = Object.freeze({
  kind: "all",
  allows() {
    return true;
  },
});
const DENY_ALL = Object.freeze({
  kind: "none",
  allows() {
    return false;
  },
});
const UNKNOWN_POLICY = Object.freeze({
  kind: "unknown",
  allows() {
    return false;
  },
});
const POLICY_PORT_NAME = "webkeyboard-policy";
let nextEndpointId = 0;
let nextDelegationId = 0;

function frameKey(tabId, frameId) {
  return `${tabId}:${frameId}`;
}

function stripFragment(url) {
  const index = url.indexOf("#");
  return index < 0 ? url : url.slice(0, index);
}

function sameUrlModuloFragment(left, right) {
  return typeof left === "string" &&
    typeof right === "string" &&
    stripFragment(left) === stripFragment(right);
}

function isResponseLessUrl(url) {
  return typeof url === "string" &&
    (url.startsWith("about:blank") || url.startsWith("about:srcdoc"));
}

function normalizeOrigin(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value === "null") return value;
  try {
    const origin = new URL(value).origin;
    return origin === "null" ? null : origin;
  } catch (_) {
    return null;
  }
}

function allowlistFromStructure(structure, selfOrigin) {
  if (structure.kind === "all") return ALLOW_ALL;
  if (structure.kind === "none") return DENY_ALL;
  return {
    kind: "sources",
    allows(targetOrigin) {
      return webKeyboardSources.allows(structure, targetOrigin, selfOrigin);
    },
  };
}

function readStructuredString(value, index) {
  if (value[index] !== '"') return null;
  let result = "";
  let escaped = false;
  for (let cursor = index + 1; cursor < value.length; cursor += 1) {
    const character = value[cursor];
    if (escaped) {
      result += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === '"') {
      return {
        kind: "string",
        value: result,
        quoted: true,
        next: cursor + 1,
      };
    } else {
      result += character;
    }
  }
  return null;
}

function readStructuredToken(value, index, stop) {
  const start = index;
  while (index < value.length && !stop.test(value[index])) index += 1;
  if (start === index) return null;
  const token = value.slice(start, index);
  if (!/^[a-zA-Z0-9*._:+?/-]+$/.test(token)) return null;
  const kind = /^-?\d+(?:\.\d+)?$/.test(token) ? "number" : "token";
  return { kind, value: token, quoted: false, next: index };
}

function skipStructuredSpace(value, index) {
  while (index < value.length && /[ \t]/.test(value[index])) index += 1;
  return index;
}

function readStructuredValue(value, index) {
  if (value[index] === '"') return readStructuredString(value, index);
  if (value[index] === "(") {
    const items = [];
    index += 1;
    index = skipStructuredSpace(value, index);
    while (index < value.length && value[index] !== ")") {
      const item = value[index] === '"'
        ? readStructuredString(value, index)
        : readStructuredToken(value, index, /[ \t)]/);
      if (!item) return null;
      items.push(item);
      index = skipStructuredSpace(value, item.next);
    }
    if (value[index] !== ")") return null;
    return { kind: "inner", items, next: index + 1 };
  }
  return readStructuredToken(value, index, /[ \t,;]/);
}

function skipStructuredParameters(value, index) {
  while (true) {
    index = skipStructuredSpace(value, index);
    if (value[index] !== ";") return index;
    index = skipStructuredSpace(value, index + 1);
    const key = readStructuredToken(value, index, /[ \t=,;]/);
    if (!key) return null;
    index = skipStructuredSpace(value, key.next);
    if (value[index] !== "=") continue;
    index = skipStructuredSpace(value, index + 1);
    const parameter = readStructuredValue(value, index);
    if (!parameter) return null;
    index = parameter.next;
  }
}

function parseStructuredFieldDictionary(value) {
  const dictionary = new Map();
  let index = 0;
  while (true) {
    index = skipStructuredSpace(value, index);
    if (index >= value.length) return dictionary;

    const key = readStructuredToken(value, index, /[ \t=,;]/);
    if (!key || !/^[a-z][a-z0-9_.*-]*$/.test(key.value)) return null;
    index = key.next;

    let member = { kind: "boolean", value: true };
    if (value[index] === "=") {
      index = skipStructuredSpace(value, index + 1);
      member = readStructuredValue(value, index);
      if (!member) return null;
      index = member.next;
    }
    index = skipStructuredParameters(value, index);
    if (index === null) return null;
    dictionary.set(key.value, member);

    index = skipStructuredSpace(value, index);
    if (index >= value.length) return dictionary;
    if (value[index] !== ",") return null;
    index = skipStructuredSpace(value, index + 1);
    if (index >= value.length) return null;
  }
}

function keyboardMapMemberToAllowlist(member, responseUrl) {
  if (member.kind === "boolean" || member.kind === "number") return ALLOW_ALL;
  const items = member.kind === "inner" ? member.items : [member];
  if (items.length === 0) return DENY_ALL;
  const selfOrigin = normalizeOrigin(responseUrl) || "null";
  const sources = [];
  for (const item of items) {
    if (item.kind === "number" || item.kind === "boolean") continue;
    const source = webKeyboardSources.parse(item.value, item.quoted);
    if (source) sources.push(source);
  }
  if (sources.some((source) => source.kind === "all")) return ALLOW_ALL;
  if (sources.length === 0) return ALLOW_ALL;
  return allowlistFromStructure({ kind: "sources", sources }, selfOrigin);
}

function parseKeyboardMapPermissionsPolicy(responseHeaders, responseUrl) {
  const values = (responseHeaders || [])
    .filter((header) =>
      header?.name?.toLowerCase() === "permissions-policy" &&
      typeof header.value === "string")
    .map((header) => header.value);
  if (values.length === 0) return ALLOW_ALL;

  const dictionary = parseStructuredFieldDictionary(values.join(", "));
  if (!dictionary) return ALLOW_ALL;
  const member = dictionary.get("keyboard-map");
  if (!member) return ALLOW_ALL;
  return keyboardMapMemberToAllowlist(member, responseUrl);
}

function navigationKey(tabId, frameId) {
  return frameKey(tabId, frameId);
}

function onBeforeRequest(details) {
  if (!Number.isInteger(details.tabId) || !Number.isInteger(details.frameId)) return;
  pendingNavigations.set(navigationKey(details.tabId, details.frameId), {
    requestId: details.requestId,
    tabId: details.tabId,
    frameId: details.frameId,
    parentFrameId: Number.isInteger(details.parentFrameId) ? details.parentFrameId : -1,
    url: details.url,
    responseUrl: null,
    declaredPolicy: ALLOW_ALL,
    observedResponse: false,
  });
}

function onHeadersReceived(details) {
  const navigation = pendingNavigations.get(
    navigationKey(details.tabId, details.frameId),
  );
  if (!navigation || navigation.requestId !== details.requestId) return;
  navigation.responseUrl = details.url || navigation.url;
  navigation.declaredPolicy = parseKeyboardMapPermissionsPolicy(
    details.responseHeaders || [],
    navigation.responseUrl,
  );
  navigation.observedResponse = true;
}

function endpointDocumentIsLive(endpoint) {
  return !!endpoint &&
    !endpoint.retired &&
    frameEndpoints.get(endpoint.port) === endpoint &&
    currentEndpointByFrame.get(endpoint.frameKey) === endpoint;
}

function cancelEndpointDelegations(endpoint) {
  for (const [requestId, pending] of pendingDelegations) {
    if (pending.parent !== endpoint && pending.child !== endpoint) continue;
    pendingDelegations.delete(requestId);
    pending.resolve(false);
  }
}

function retireEndpoint(endpoint) {
  if (!endpoint || endpoint.retired) return;
  endpoint.retired = true;
  if (frameEndpoints.get(endpoint.port) === endpoint) {
    frameEndpoints.delete(endpoint.port);
  }
  if (currentEndpointByFrame.get(endpoint.frameKey) === endpoint) {
    currentEndpointByFrame.delete(endpoint.frameKey);
  }
  cancelEndpointDelegations(endpoint);
  permissionsPolicy.delete(endpoint.id);
  frameDelegations.delete(endpoint.id);
}

function registerFrameEndpoint(port) {
  const sender = port.sender || {};
  const tabId = sender.tab?.id;
  const frameId = Number.isInteger(sender.frameId) && sender.frameId >= 0
    ? sender.frameId
    : null;
  const origin = typeof sender.origin === "string" && sender.origin
    ? sender.origin
    : null;
  const url = typeof sender.url === "string" ? sender.url : "";
  const documentId = typeof sender.documentId === "string" && sender.documentId
    ? sender.documentId
    : null;
  if (!Number.isInteger(tabId) || frameId === null || !origin) return null;

  const key = frameKey(tabId, frameId);
  const previous = currentEndpointByFrame.get(key);
  if (previous) retireEndpoint(previous);

  const endpoint = {
    id: `endpoint-${++nextEndpointId}`,
    port,
    tabId,
    frameId,
    documentId,
    origin,
    url,
    frameKey: key,
    parentFrameId: Number.isInteger(sender.parentFrameId) ? sender.parentFrameId : null,
    retired: false,
  };
  frameEndpoints.set(port, endpoint);
  currentEndpointByFrame.set(key, endpoint);
  return endpoint;
}

function bindPendingNavigation(endpoint) {
  const navigation = pendingNavigations.get(
    navigationKey(endpoint.tabId, endpoint.frameId),
  );
  if (isResponseLessUrl(endpoint.url)) {
    permissionsPolicy.set(endpoint.id, {
      origin: endpoint.origin,
      parentFrameId: navigation?.parentFrameId ?? endpoint.parentFrameId,
      declared: ALLOW_ALL,
      responseLess: true,
    });
    return true;
  }

  if (!navigation || !navigation.observedResponse) {
    permissionsPolicy.set(endpoint.id, {
      origin: endpoint.origin,
      parentFrameId: null,
      declared: UNKNOWN_POLICY,
      responseLess: false,
    });
    return false;
  }

  const matchingUrl = navigation.responseUrl &&
    sameUrlModuloFragment(navigation.responseUrl, endpoint.url);
  permissionsPolicy.set(endpoint.id, {
    origin: endpoint.origin,
    parentFrameId: matchingUrl ? navigation.parentFrameId : null,
    declared: matchingUrl ? navigation.declaredPolicy : UNKNOWN_POLICY,
    responseLess: false,
  });
  return matchingUrl;
}

function parentEndpointFor(child) {
  if (!child || child.frameId === 0) return null;
  const entry = permissionsPolicy.get(child.id);
  if (!entry || !Number.isInteger(entry.parentFrameId) || entry.parentFrameId < 0) {
    return null;
  }
  const parent = currentEndpointByFrame.get(
    frameKey(child.tabId, entry.parentFrameId),
  );
  return endpointDocumentIsLive(parent) ? parent : null;
}

function headerAllowsEndpoint(endpoint) {
  let current = endpoint;
  const visited = new Set();
  while (current) {
    if (!endpointDocumentIsLive(current) || visited.has(current.id)) return false;
    visited.add(current.id);

    const entry = permissionsPolicy.get(current.id);
    if (!entry || entry.declared === UNKNOWN_POLICY) return false;
    if (!entry.declared.allows(current.origin)) return false;
    if (current.frameId === 0) return true;

    const parent = parentEndpointFor(current);
    if (!parent) return false;
    const parentEntry = permissionsPolicy.get(parent.id);
    if (!parentEntry || parentEntry.declared === UNKNOWN_POLICY) return false;
    if (!parentEntry.declared.allows(current.origin)) return false;
    current = parent;
  }
  return false;
}

function queryFrameDelegation(child) {
  const parent = parentEndpointFor(child);
  if (!parent) return Promise.resolve(false);
  const requestId = `delegation:${++nextDelegationId}`;
  return new Promise((resolve) => {
    pendingDelegations.set(requestId, { child, parent, resolve });
    try {
      parent.port.postMessage({
        action: "frameDelegationQuery",
        requestId,
        childFrameId: child.frameId,
        childDocumentId: child.documentId,
        childOrigin: child.origin,
        parentOrigin: parent.origin,
      });
    } catch (_) {
      pendingDelegations.delete(requestId);
      resolve(false);
    }
  });
}

function handleFrameDelegationResult(endpoint, message) {
  const pending = pendingDelegations.get(message.requestId);
  if (!pending || pending.parent !== endpoint) return;
  pendingDelegations.delete(message.requestId);
  const valid = endpointDocumentIsLive(pending.parent) &&
    endpointDocumentIsLive(pending.child);
  const delegated = valid && message.delegated === true;
  if (valid) frameDelegations.set(pending.child.id, delegated);
  pending.resolve(delegated);
}

async function ensureFrameDelegations(endpoint) {
  let child = endpoint;
  const visited = new Set();
  while (child && child.frameId !== 0) {
    if (!endpointDocumentIsLive(child) || visited.has(child.id)) return false;
    visited.add(child.id);
    const delegated = await queryFrameDelegation(child);
    if (!endpointDocumentIsLive(child)) return false;
    frameDelegations.set(child.id, delegated);
    if (!delegated) return false;
    child = parentEndpointFor(child);
    if (!child) return false;
  }
  return !!child && endpointDocumentIsLive(child);
}

async function getKeyboardMapPolicy(endpoint) {
  if (!endpointDocumentIsLive(endpoint)) return "denied";
  if (!headerAllowsEndpoint(endpoint)) return "denied";
  if (endpoint.frameId !== 0 && !(await ensureFrameDelegations(endpoint))) {
    return "denied";
  }
  if (!endpointDocumentIsLive(endpoint)) return "denied";
  return "granted";
}

function reply(port, id, result) {
  try {
    port.postMessage({ type: "response", id, result });
  } catch (_) {}
}

function handlePolicyPortMessage(endpoint, message) {
  if (!endpointDocumentIsLive(endpoint) || !message) return;
  if (message.action === "frameDelegationResult") {
    handleFrameDelegationResult(endpoint, message);
    return;
  }
  if (
    message.type !== "request" ||
    !Number.isInteger(message.id) ||
    message.operation !== "getPolicy"
  ) return;
  getKeyboardMapPolicy(endpoint).then(
    (keyboardMap) => reply(endpoint.port, message.id, { keyboardMap }),
    () => reply(endpoint.port, message.id, { keyboardMap: "denied" }),
  );
}

function connectPolicyPort(port) {
  if (port.name !== POLICY_PORT_NAME) return;
  const endpoint = registerFrameEndpoint(port);
  if (!endpoint) {
    try {
      port.disconnect();
    } catch (_) {}
    return;
  }
  bindPendingNavigation(endpoint);
  port.onMessage.addListener((message) => {
    handlePolicyPortMessage(endpoint, message);
  });
  port.onDisconnect.addListener(() => retireEndpoint(endpoint));
}

browser.webRequest.onBeforeRequest.addListener(
  onBeforeRequest,
  { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
);
browser.webRequest.onHeadersReceived.addListener(
  onHeadersReceived,
  { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
  ["responseHeaders"],
);
browser.runtime.onConnect.addListener(connectPolicyPort);
