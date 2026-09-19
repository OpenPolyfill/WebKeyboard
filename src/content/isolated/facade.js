/** WebKeyboard WebIDL facade. */
"use strict";

{
  const PageObject = window.Object;
  const PageEventTarget = window.EventTarget;
  const PageNavigator = window.Navigator;
  const pageWindow = window.wrappedJSObject;
  const pageDocument = unwrap(window.document);
  const pageEventTargetPrototype = PageEventTarget.prototype;
  const pageAddEventListener = pageEventTargetPrototype.addEventListener;
  const pageRemoveEventListener =
    pageEventTargetPrototype.removeEventListener;
  const keyboardBrand = new WeakSet();
  const keyboardLayoutMapBrand = new WeakSet();
  const keyboardLayoutMapBackings = new WeakMap();
  const layoutChangeHandlers = new WeakMap();
  const layoutChangeListeners = new WeakMap();
  const navigatorBrandGetter = Reflect.getOwnPropertyDescriptor(
    PageNavigator.prototype,
    "userAgent",
  )?.get;

  const STANDARD_US_LAYOUT = Object.freeze([
    ["Backquote", "`"],
    ["Backslash", "\\"],
    ["BracketLeft", "["],
    ["BracketRight", "]"],
    ["Comma", ","],
    ["Digit0", "0"],
    ["Digit1", "1"],
    ["Digit2", "2"],
    ["Digit3", "3"],
    ["Digit4", "4"],
    ["Digit5", "5"],
    ["Digit6", "6"],
    ["Digit7", "7"],
    ["Digit8", "8"],
    ["Digit9", "9"],
    ["Equal", "="],
    ["KeyA", "a"],
    ["KeyB", "b"],
    ["KeyC", "c"],
    ["KeyD", "d"],
    ["KeyE", "e"],
    ["KeyF", "f"],
    ["KeyG", "g"],
    ["KeyH", "h"],
    ["KeyI", "i"],
    ["KeyJ", "j"],
    ["KeyK", "k"],
    ["KeyL", "l"],
    ["KeyM", "m"],
    ["KeyN", "n"],
    ["KeyO", "o"],
    ["KeyP", "p"],
    ["KeyQ", "q"],
    ["KeyR", "r"],
    ["KeyS", "s"],
    ["KeyT", "t"],
    ["KeyU", "u"],
    ["KeyV", "v"],
    ["KeyW", "w"],
    ["KeyX", "x"],
    ["KeyY", "y"],
    ["KeyZ", "z"],
    ["Minus", "-"],
    ["Period", "."],
    ["Quote", "'"],
    ["Semicolon", ";"],
    ["Slash", "/"],
  ]);

  /** Implements the non-constructible KeyboardLayoutMap interface. */
  function KeyboardLayoutMap() {
    illegalConstructor();
  }

  const KeyboardLayoutMapObject = exportToPage(KeyboardLayoutMap);
  const KeyboardLayoutMapPrototype = unwrap(new PageObject());

  definePageProperty(KeyboardLayoutMapObject, "prototype", {
    value: KeyboardLayoutMapPrototype,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  definePageProperty(KeyboardLayoutMapPrototype, "constructor", {
    value: KeyboardLayoutMapObject,
    writable: true,
    enumerable: false,
    configurable: true,
  });

  definePageProperty(KeyboardLayoutMapPrototype, Symbol.toStringTag, {
    value: "KeyboardLayoutMap",
    writable: false,
    enumerable: false,
    configurable: true,
  });

  function getKeyboardLayoutMapBacking(value) {
    const receiver = requireBrand(value, keyboardLayoutMapBrand);
    return { receiver, backing: keyboardLayoutMapBackings.get(receiver) };
  }

  /** Implements KeyboardLayoutMap.size. */
  function getLayoutMapSize() {
    const { backing } = getKeyboardLayoutMapBacking(this);
    return Reflect.apply(pageMapSizeGetter, backing, []);
  }

  /** Implements KeyboardLayoutMap.get(). */
  function getLayoutMapValue(key) {
    const { backing } = getKeyboardLayoutMapBacking(this);
    return Reflect.apply(pageMapGet, backing, [convertDOMString(key)]);
  }

  /** Implements KeyboardLayoutMap.has(). */
  function hasLayoutMapKey(key) {
    const { backing } = getKeyboardLayoutMapBacking(this);
    return Reflect.apply(pageMapHas, backing, [convertDOMString(key)]);
  }

  /** Implements KeyboardLayoutMap.entries(). */
  function getLayoutMapEntries() {
    const { backing } = getKeyboardLayoutMapBacking(this);
    return Reflect.apply(pageMapEntries, backing, []);
  }

  /** Implements KeyboardLayoutMap.keys(). */
  function getLayoutMapKeys() {
    const { backing } = getKeyboardLayoutMapBacking(this);
    return Reflect.apply(pageMapKeys, backing, []);
  }

  /** Implements KeyboardLayoutMap.values(). */
  function getLayoutMapValues() {
    const { backing } = getKeyboardLayoutMapBacking(this);
    return Reflect.apply(pageMapValues, backing, []);
  }

  /** Implements KeyboardLayoutMap.forEach(). */
  function forEachLayoutMapEntry(callback, thisArg) {
    const { receiver, backing } = getKeyboardLayoutMapBacking(this);
    if (typeof callback !== "function") {
      throw pageTypeError("KeyboardLayoutMap.forEach callback is not callable");
    }

    const callbackWrapper = exportToPage((value, key) =>
      Reflect.apply(callback, thisArg, [value, key, receiver]),
    );
    return Reflect.apply(pageMapForEach, backing, [callbackWrapper]);
  }

  function setPageFunctionMetadata(method, name, length) {
    definePageProperty(method, "name", {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true,
    });
    definePageProperty(method, "length", {
      value: length,
      writable: false,
      enumerable: false,
      configurable: true,
    });
  }

  const pageLayoutMapMethods = [
    ["get", exportToPage(getLayoutMapValue), 1],
    ["has", exportToPage(hasLayoutMapKey), 1],
    ["entries", exportToPage(getLayoutMapEntries), 0],
    ["keys", exportToPage(getLayoutMapKeys), 0],
    ["values", exportToPage(getLayoutMapValues), 0],
    ["forEach", exportToPage(forEachLayoutMapEntry), 1],
  ];
  for (const [name, method, length] of pageLayoutMapMethods) {
    setPageFunctionMetadata(method, name, length);
    definePageProperty(KeyboardLayoutMapPrototype, name, {
      value: method,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  const pageLayoutMapSizeGetter = exportToPage(getLayoutMapSize);
  setPageFunctionMetadata(pageLayoutMapSizeGetter, "get size", 0);
  definePageProperty(KeyboardLayoutMapPrototype, "size", {
    get: pageLayoutMapSizeGetter,
    set: undefined,
    enumerable: true,
    configurable: true,
  });

  const pageLayoutMapEntriesMethod = pageLayoutMapMethods[2][1];
  definePageProperty(KeyboardLayoutMapPrototype, Symbol.iterator, {
    value: pageLayoutMapEntriesMethod,
    writable: true,
    enumerable: false,
    configurable: true,
  });

  /** Creates a new map with the fixed standard US-QWERTY layout. */
  function createKeyboardLayoutMap() {
    const instance = unwrap(new PageObject());
    const backing = createPageMap();
    setPagePrototype(instance, KeyboardLayoutMapPrototype);

    for (const [code, key] of STANDARD_US_LAYOUT) {
      Reflect.apply(pageMapSet, backing, [code, key]);
    }

    keyboardLayoutMapBrand.add(instance);
    keyboardLayoutMapBackings.set(instance, backing);
    return instance;
  }

  definePageProperty(pageWindow, "KeyboardLayoutMap", {
    value: KeyboardLayoutMapObject,
    writable: true,
    enumerable: false,
    configurable: true,
  });

  /**
   * Checks the Permissions Policy gate for Keyboard Map.
   *
   * Firefox currently does not expose document.permissionsPolicy for this
   * polyfilled feature. In that case, the default "self" allowlist can be
   * reproduced for top-level and same-origin documents. An explicit
   * cross-origin iframe allow="keyboard-map" cannot be observed from the
   * child in that environment, so the conservative fallback rejects it.
   */
  function isKeyboardMapAllowed() {
    let policy = null;
    try {
      policy = pageDocument.permissionsPolicy ?? null;
    } catch (_) {}

    if (policy && typeof policy.allowsFeature === "function") {
      try {
        return !!Reflect.apply(policy.allowsFeature, policy, ["keyboard-map"]);
      } catch (_) {}
    }

    try {
      if (window.top === window) return true;

      const currentOrigin = pageDocument.location?.origin;
      const topDocument = unwrap(window.top.document);
      return (
        typeof currentOrigin === "string" &&
        currentOrigin === topDocument.location?.origin
      );
    } catch (_) {
      return false;
    }
  }

  if (window.isSecureContext) {
  /** Implements the non-constructible Keyboard interface constructor. */
  function Keyboard() {
    illegalConstructor();
  }

  const KeyboardObject = exportToPage(Keyboard);
  const KeyboardPrototype = unwrap(new PageObject());

  setPagePrototype(KeyboardObject, PageEventTarget);
  setPagePrototype(KeyboardPrototype, PageEventTarget.prototype);

  definePageProperty(KeyboardObject, "prototype", {
    value: KeyboardPrototype,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  definePageProperty(KeyboardPrototype, "constructor", {
    value: KeyboardObject,
    writable: true,
    enumerable: false,
    configurable: true,
  });

  definePageProperty(KeyboardPrototype, Symbol.toStringTag, {
    value: "Keyboard",
    writable: false,
    enumerable: false,
    configurable: true,
  });

  let pageLockMethod = null;
  let pageUnlockMethod = null;
  let pageGetLayoutMapMethod = null;
  let navigatorKeyboardGetter = null;

  /** Implements Keyboard.lock(). */
  function lock(keyCodes = []) {
    const resolved = resolveEventTargetReceiver(
      this,
      keyboardBrand,
      "Keyboard",
      "lock",
      pageLockMethod,
    );
    if (resolved.method) {
      return Reflect.apply(resolved.method, resolved.receiver, arguments);
    }

    let codes;
    try {
      codes = arguments.length > 0 ? convertDOMStringSequence(keyCodes) : [];
    } catch (error) {
      return rejectedPagePromise(error);
    }

    return pagePromise(() => keyboardService.lock(codes));
  }

  /** Implements Keyboard.unlock(). */
  function unlock() {
    const resolved = resolveEventTargetReceiver(
      this,
      keyboardBrand,
      "Keyboard",
      "unlock",
      pageUnlockMethod,
    );
    if (resolved.method) {
      Reflect.apply(resolved.method, resolved.receiver, arguments);
      return;
    }

    keyboardService.unlock();
  }

  /** Implements Keyboard.getLayoutMap(). */
  function getLayoutMap() {
    const resolved = resolveEventTargetReceiver(
      this,
      keyboardBrand,
      "Keyboard",
      "getLayoutMap",
      pageGetLayoutMapMethod,
    );
    if (resolved.method) {
      return Reflect.apply(resolved.method, resolved.receiver, arguments);
    }

    if (!isKeyboardMapAllowed()) {
      return rejectedPagePromise(
        new DOMException(
          "Keyboard Map is disabled by Permissions Policy",
          "SecurityError",
        ),
      );
    }

    return pagePromise(createKeyboardLayoutMap);
  }

  /** Applies EventHandler's LegacyTreatNonObjectAsNull conversion. */
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

  /** Runs the current layoutchange EventHandler value. */
  function runLayoutChangeHandler(receiver, event) {
    const handler = layoutChangeHandlers.get(receiver);
    if (typeof handler !== "function") return;

    const result = Reflect.apply(handler, receiver, [event]);
    if (result === false) {
      Reflect.apply(event.preventDefault, event, []);
    }
  }

  /** Implements Keyboard.onlayoutchange. */
  function getOnLayoutChange() {
    const receiver = requireBrand(this, keyboardBrand);
    return layoutChangeHandlers.get(receiver) ?? null;
  }

  /** Implements the Keyboard.onlayoutchange EventHandler setter. */
  function setOnLayoutChange(value) {
    const receiver = requireBrand(this, keyboardBrand);
    const handler = normalizeEventHandlerValue(value);

    if (handler === null) {
      layoutChangeHandlers.delete(receiver);
      const listener = layoutChangeListeners.get(receiver);
      if (listener) {
        Reflect.apply(pageRemoveEventListener, receiver, [
          "layoutchange",
          listener,
        ]);
        layoutChangeListeners.delete(receiver);
      }
      return;
    }

    layoutChangeHandlers.set(receiver, handler);
    if (layoutChangeListeners.has(receiver)) return;

    const listener = exportToPage((event) =>
      runLayoutChangeHandler(receiver, event),
    );
    layoutChangeListeners.set(receiver, listener);
    Reflect.apply(pageAddEventListener, receiver, ["layoutchange", listener]);
  }

  pageLockMethod = exportToPage(lock);
  pageUnlockMethod = exportToPage(unlock);
  pageGetLayoutMapMethod = exportToPage(getLayoutMap);
  const pageOnLayoutChangeGetter = exportToPage(getOnLayoutChange);
  const pageOnLayoutChangeSetter = exportToPage(setOnLayoutChange);

  for (const [name, method] of [
    ["lock", pageLockMethod],
    ["unlock", pageUnlockMethod],
    ["getLayoutMap", pageGetLayoutMapMethod],
  ]) {
    definePageProperty(KeyboardPrototype, name, {
      value: method,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  definePageProperty(KeyboardPrototype, "onlayoutchange", {
    get: pageOnLayoutChangeGetter,
    set: pageOnLayoutChangeSetter,
    enumerable: true,
    configurable: true,
  });

  const keyboardInstance = unwrap(new PageEventTarget());
  setPagePrototype(keyboardInstance, KeyboardPrototype);
  keyboardBrand.add(keyboardInstance);

  definePageProperty(pageWindow, "Keyboard", {
    value: KeyboardObject,
    writable: true,
    enumerable: false,
    configurable: true,
  });

  /** Returns the Keyboard singleton for a Navigator receiver. */
  function getKeyboard() {
    const receiver = requireNativeGetterReceiver(this, navigatorBrandGetter);
    const localNavigator = unwrap(window.navigator);
    if (receiver === localNavigator) return keyboardInstance;

    const prototype = Reflect.getPrototypeOf(receiver);
    const descriptor = prototype
      ? Reflect.getOwnPropertyDescriptor(prototype, "keyboard")
      : null;
    const getter = descriptor?.get;

    if (
      typeof getter !== "function" ||
      unwrap(getter) === unwrap(navigatorKeyboardGetter)
    ) {
      illegalInvocation();
    }

    return Reflect.apply(getter, receiver, []);
  }

  navigatorKeyboardGetter = exportToPage(getKeyboard);
  definePageProperty(navigatorKeyboardGetter, "name", {
    value: "get keyboard",
    writable: false,
    enumerable: false,
    configurable: true,
  });

  definePageProperty(PageNavigator.prototype, "keyboard", {
    get: navigatorKeyboardGetter,
    set: undefined,
    enumerable: true,
    configurable: true,
  });
}
}
