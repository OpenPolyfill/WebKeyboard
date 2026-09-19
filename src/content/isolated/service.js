/** Keyboard Lock state and Fullscreen API backend. */
"use strict";

const keyboardService = (() => {
  const pageDocument = unwrap(window.document);
  const pageElementPrototype = unwrap(window.Element.prototype);
  const pageRequestFullscreen = Reflect.get(
    pageElementPrototype,
    "requestFullscreen",
  );
  const requestFullscreenDescriptor = Reflect.getOwnPropertyDescriptor(
    pageElementPrototype,
    "requestFullscreen",
  );
  let keyboardLockArmed = false;
  let lockInducedBrowser = false;
  let fullscreenRequestObserved = false;
  let lastFullscreenRequestExplicitBrowser = false;
  let fullscreenRequestGeneration = 0;
  /** Creates an API DOMException. */
  function apiError(name, message) {
    return new DOMException(message, name);
  }

  /** Requires the currently active top-level document. */
  function assertActiveTopLevel() {
    if (
      window.top !== window ||
      unwrap(window.wrappedJSObject.document) !== pageDocument
    ) {
      throw apiError(
        "InvalidStateError",
        "Keyboard Lock requires the currently active top-level document",
      );
    }
  }

  /** Parses the caller's Fullscreen API keyboard-lock option. */
  function parseFullscreenKeyboardLock(options) {
    if (options === undefined || options === null) return "none";

    try {
      const source = unwrap(options);
      if (typeof source !== "object" && typeof source !== "function") {
        return "none";
      }

      const value = Reflect.get(source, "keyboardLock", source);
      if (value === undefined) return "none";

      const mode = String(value);
      if (mode === "none" || mode === "browser") return mode;
      return "invalid";
    } catch {
      return "invalid";
    }
  }

  /** Creates page-realm fullscreen options with a forced keyboard-lock mode. */
  function makeKeyboardLockOptions(options, keyboardLock) {
    const forwarded = unwrap(new window.Object());
    const source = unwrap(options);

    if (
      source !== null &&
      source !== undefined &&
      (typeof source === "object" || typeof source === "function")
    ) {
      setPagePrototype(forwarded, source);
    }

    definePageProperty(forwarded, "keyboardLock", {
      value: keyboardLock,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    return forwarded;
  }

  /**
   * Requests fullscreen. An armed Keyboard Lock changes only this call by
   * forcing Firefox's native browser keyboard lock.
   */
  function requestFullscreen(options = undefined) {
    const keyboardLock = parseFullscreenKeyboardLock(options);
    if (keyboardLock === "invalid") {
      return Reflect.apply(pageRequestFullscreen, unwrap(this), arguments);
    }

    const previousLockInducedBrowser = lockInducedBrowser;
    const previousRequestObserved = fullscreenRequestObserved;
    const previousExplicitBrowser = lastFullscreenRequestExplicitBrowser;
    const generation = ++fullscreenRequestGeneration;
    let requestOptions = arguments;

    if (!keyboardLockArmed) {
      lockInducedBrowser = false;
    } else {
      lockInducedBrowser = keyboardLock !== "browser";
      requestOptions = [makeKeyboardLockOptions(options, "browser")];
    }
    fullscreenRequestObserved = true;
    lastFullscreenRequestExplicitBrowser = keyboardLock === "browser";

    let result;
    try {
      result = Reflect.apply(pageRequestFullscreen, unwrap(this), requestOptions);
    } catch (error) {
      if (generation === fullscreenRequestGeneration) {
        lockInducedBrowser = previousLockInducedBrowser;
        fullscreenRequestObserved = previousRequestObserved;
        lastFullscreenRequestExplicitBrowser = previousExplicitBrowser;
      }
      throw error;
    }

    Promise.resolve(result).then(
      () => {
        if (generation === fullscreenRequestGeneration) {
          fullscreenRequestObserved = true;
          lastFullscreenRequestExplicitBrowser = keyboardLock === "browser";
        }
      },
      () => {
        if (generation === fullscreenRequestGeneration) {
          lockInducedBrowser = previousLockInducedBrowser;
          fullscreenRequestObserved = previousRequestObserved;
          lastFullscreenRequestExplicitBrowser = previousExplicitBrowser;
        }
      },
    );

    return result;
  }
  /** Arms the supported all-keys lock. */
  function lock(codes) {
    assertActiveTopLevel();

    if (codes.length > 0) {
      throw apiError(
        "NotSupportedError",
        "WebKeyboard only supports lock() without key codes",
      );
    }

    keyboardLockArmed = true;

    if (
      !pageDocument.fullscreenElement ||
      !fullscreenRequestObserved ||
      lastFullscreenRequestExplicitBrowser ||
      lockInducedBrowser
    ) {
      return;
    }

    const fullscreenElement =
      pageDocument.fullscreenElement || pageDocument.documentElement;
    const generation = ++fullscreenRequestGeneration;
    lockInducedBrowser = true;

    let result;
    try {
      result = Reflect.apply(pageRequestFullscreen, fullscreenElement, [
        makeKeyboardLockOptions(undefined, "browser"),
      ]);
    } catch {
      if (generation === fullscreenRequestGeneration) {
        lockInducedBrowser = false;
      }
      return;
    }

    return Promise.resolve(result).then(
      () => {
        if (generation === fullscreenRequestGeneration) {
          fullscreenRequestObserved = true;
          lastFullscreenRequestExplicitBrowser = false;
        }
      },
      () => {
        if (generation === fullscreenRequestGeneration) {
          lockInducedBrowser = false;
        }
      },
    );
  }

  /** Disarms and best-effort restores native fullscreen keyboard handling. */
  function unlock() {
    try {
      assertActiveTopLevel();
    } catch {
      return;
    }

    keyboardLockArmed = false;
    ++fullscreenRequestGeneration;
    if (!lockInducedBrowser || !pageDocument.fullscreenElement) {
      lockInducedBrowser = false;
      return;
    }

    const fullscreenElement =
      pageDocument.fullscreenElement || pageDocument.documentElement;
    lockInducedBrowser = false;

    try {
      const result = Reflect.apply(pageRequestFullscreen, fullscreenElement, [
        makeKeyboardLockOptions(undefined, "none"),
      ]);
      Promise.resolve(result).catch(() => {});
    } catch {
      // Best effort: native fullscreen may reject without user activation.
    }
  }

  if (window.isSecureContext) {
    const pageRequestFullscreenWrapper = exportToPage(requestFullscreen);
    definePageProperty(pageElementPrototype, "requestFullscreen", {
      value: pageRequestFullscreenWrapper,
      writable: requestFullscreenDescriptor.writable,
      enumerable: requestFullscreenDescriptor.enumerable,
      configurable: requestFullscreenDescriptor.configurable,
    });

  }
  return { lock, unlock };
})();
