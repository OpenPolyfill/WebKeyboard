/** WebKeyboard WebIDL facade. */
"use strict";

if (window.isSecureContext) {
  const PageObject = window.Object;
  const PageEventTarget = window.EventTarget;
  const PageNavigator = window.Navigator;
  const pageWindow = window.wrappedJSObject;
  const keyboardBrand = new WeakSet();
  const navigatorBrandGetter = Reflect.getOwnPropertyDescriptor(
    PageNavigator.prototype,
    "userAgent",
  )?.get;

  let pageLockMethod = null;
  let pageUnlockMethod = null;
  let navigatorKeyboardGetter = null;

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

  pageLockMethod = exportToPage(lock);
  pageUnlockMethod = exportToPage(unlock);

  for (const [name, method] of [
    ["lock", pageLockMethod],
    ["unlock", pageUnlockMethod],
  ]) {
    definePageProperty(KeyboardPrototype, name, {
      value: method,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

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
