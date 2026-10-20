/** Page-realm navigator.permissions.query integration for keyboard-map. */
"use strict";

(() => {
  const PageEventTarget = window.EventTarget;
  const pageWindow = window.wrappedJSObject;
  const pageEventTargetPrototype = PageEventTarget.prototype;
  const pageAddEventListener = pageEventTargetPrototype.addEventListener;
  const pageRemoveEventListener = pageEventTargetPrototype.removeEventListener;
  const permissionStatusHandlers = new WeakMap();
  const permissionStatusListeners = new WeakMap();
  let pagePermissionStatusPrototype = pageEventTargetPrototype;

  try {
    if (pageWindow.PermissionStatus?.prototype) {
      pagePermissionStatusPrototype = unwrap(pageWindow.PermissionStatus.prototype);
    }
  } catch (_) {}

  function normalizeEventHandlerValue(value) {
    const handler = unwrap(value);
    if (
      handler === null ||
      (typeof handler !== "object" && typeof handler !== "function")
    ) {
      return null;
    }
    return handler;
  }

  function getOnChange() {
    const status = unwrap(this);
    return permissionStatusHandlers.get(status) ?? null;
  }

  function setOnChange(value) {
    const status = unwrap(this);
    if (!permissionStatusHandlers.has(status)) {
      throw pageTypeError("Illegal invocation");
    }

    const handler = normalizeEventHandlerValue(value);
    const previousListener = permissionStatusListeners.get(status);
    if (handler === null) {
      if (previousListener) {
        Reflect.apply(pageRemoveEventListener, status, ["change", previousListener]);
        permissionStatusListeners.delete(status);
      }
      permissionStatusHandlers.set(status, null);
      return;
    }

    permissionStatusHandlers.set(status, handler);
    if (previousListener) return;

    const listener = exportToPage((event) => {
      const current = permissionStatusHandlers.get(status);
      if (typeof current !== "function") return;
      const result = Reflect.apply(current, status, [event]);
      if (result === false) event.preventDefault();
    });
    permissionStatusListeners.set(status, listener);
    Reflect.apply(pageAddEventListener, status, ["change", listener]);
  }

  function createPermissionStatus(state) {
    const status = unwrap(new PageEventTarget());
    setPagePrototype(status, pagePermissionStatusPrototype);
    permissionStatusHandlers.set(status, null);
    definePageProperty(status, "state", {
      value: state,
      writable: false,
      enumerable: true,
      configurable: false,
    });
    definePageProperty(status, "onchange", {
      get: exportToPage(getOnChange),
      set: exportToPage(setOnChange),
      enumerable: true,
      configurable: true,
    });
    return status;
  }

  let permissionsObject;
  let previousQuery;
  try {
    permissionsObject = pageWindow.navigator?.permissions;
    previousQuery = permissionsObject?.query;
  } catch (_) {
    return;
  }
  if (!permissionsObject || typeof previousQuery !== "function") return;

  const visibleDescriptor = Reflect.getOwnPropertyDescriptor(
    permissionsObject,
    "query",
  );
  if (
    visibleDescriptor &&
    visibleDescriptor.configurable === false &&
    visibleDescriptor.writable === false
  ) return;

  function query(descriptor) {
    let name;
    try {
      name = unwrap(descriptor)?.name;
    } catch (_) {
      return Reflect.apply(previousQuery, permissionsObject, arguments);
    }
    if (name !== "keyboard-map") {
      return Reflect.apply(previousQuery, permissionsObject, arguments);
    }

    return pagePromise(async () => {
      const state = (await keyboardPolicy.allowsKeyboardMap())
        ? "granted"
        : "denied";
      return createPermissionStatus(state);
    });
  }

  const pageQuery = exportToPage(query);
  definePageProperty(pageQuery, "name", {
    value: "query",
    writable: false,
    enumerable: false,
    configurable: true,
  });
  definePageProperty(pageQuery, "length", {
    value: 1,
    writable: false,
    enumerable: false,
    configurable: true,
  });
  definePageProperty(permissionsObject, "query", {
    value: pageQuery,
    writable: true,
    enumerable: visibleDescriptor?.enumerable ?? true,
    configurable: visibleDescriptor?.configurable ?? true,
  });
})();
