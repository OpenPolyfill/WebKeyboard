/** WebKeyboard WebIDL facade. */
"use strict";

if (window.isSecureContext) {
  const PageObject = window.Object;
  const PageEventTarget = window.EventTarget;
  const PageNavigator = window.Navigator;
  const pageWindow = window.wrappedJSObject;
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
    ["Digit1", "1"],
    ["Digit2", "2"],
    ["Digit3", "3"],
    ["Digit4", "4"],
    ["Digit5", "5"],
    ["Digit6", "6"],
    ["Digit7", "7"],
    ["Digit8", "8"],
    ["Digit9", "9"],
    ["Digit0", "0"],
    ["Minus", "-"],
    ["Equal", "="],
    ["KeyQ", "q"],
    ["KeyW", "w"],
    ["KeyE", "e"],
    ["KeyR", "r"],
    ["KeyT", "t"],
    ["KeyY", "y"],
    ["KeyU", "u"],
    ["KeyI", "i"],
    ["KeyO", "o"],
    ["KeyP", "p"],
    ["BracketLeft", "["],
    ["BracketRight", "]"],
    ["Backslash", "\\"],
    ["KeyA", "a"],
    ["KeyS", "s"],
    ["KeyD", "d"],
    ["KeyF", "f"],
    ["KeyG", "g"],
    ["KeyH", "h"],
    ["KeyJ", "j"],
    ["KeyK", "k"],
    ["KeyL", "l"],
    ["Semicolon", ";"],
    ["Quote", "'"],
    ["KeyZ", "z"],
    ["KeyX", "x"],
    ["KeyC", "c"],
    ["KeyV", "v"],
    ["KeyB", "b"],
    ["KeyN", "n"],
    ["KeyM", "m"],
    ["Comma", ","],
    ["Period", "."],
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

  const pageLayoutMapMethods = [
    ["get", exportToPage(getLayoutMapValue)],
    ["has", exportToPage(hasLayoutMapKey)],
    ["entries", exportToPage(getLayoutMapEntries)],
    ["keys", exportToPage(getLayoutMapKeys)],
    ["values", exportToPage(getLayoutMapValues)],
    ["forEach", exportToPage(forEachLayoutMapEntry)],
  ];
  for (const [name, method] of pageLayoutMapMethods) {
    definePageProperty(KeyboardLayoutMapPrototype, name, {
      value: method,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }

  const pageLayoutMapSizeGetter = exportToPage(getLayoutMapSize);
  definePageProperty(KeyboardLayoutMapPrototype, "size", {
    get: pageLayoutMapSizeGetter,
    set: undefined,
    enumerable: false,
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

    return pagePromise(createKeyboardLayoutMap);
  }

  /** Implements Keyboard.onlayoutchange. */
  function getOnLayoutChange() {
    const receiver = requireBrand(this, keyboardBrand);
    return layoutChangeHandlers.get(receiver) ?? null;
  }

  /** Implements the Keyboard.onlayoutchange EventHandler setter. */
  function setOnLayoutChange(value) {
    const receiver = requireBrand(this, keyboardBrand);
    if (value !== null && value !== undefined && typeof value !== "function") {
      throw pageTypeError("Keyboard.onlayoutchange is not callable");
    }

    const previousListener = layoutChangeListeners.get(receiver);
    if (previousListener) {
      Reflect.apply(pageRemoveEventListener, receiver, [
        "layoutchange",
        previousListener,
      ]);
      layoutChangeListeners.delete(receiver);
    }

    if (value === null || value === undefined) {
      layoutChangeHandlers.delete(receiver);
      return;
    }

    const listener = exportToPage((event) =>
      Reflect.apply(value, receiver, [event]),
    );
    layoutChangeHandlers.set(receiver, value);
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
