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

  const WRITING_SYSTEM_CODES = new Set([
    "Backquote",
    "Backslash",
    "BracketLeft",
    "BracketRight",
    "Comma",
    "Digit0",
    "Digit1",
    "Digit2",
    "Digit3",
    "Digit4",
    "Digit5",
    "Digit6",
    "Digit7",
    "Digit8",
    "Digit9",
    "Equal",
    "IntlBackslash",
    "IntlRo",
    "IntlYen",
    "KeyA",
    "KeyB",
    "KeyC",
    "KeyD",
    "KeyE",
    "KeyF",
    "KeyG",
    "KeyH",
    "KeyI",
    "KeyJ",
    "KeyK",
    "KeyL",
    "KeyM",
    "KeyN",
    "KeyO",
    "KeyP",
    "KeyQ",
    "KeyR",
    "KeyS",
    "KeyT",
    "KeyU",
    "KeyV",
    "KeyW",
    "KeyX",
    "KeyY",
    "KeyZ",
    "Minus",
    "Period",
    "Quote",
    "Semicolon",
    "Slash",
  ]);

  const VALID_CODES = new Set([
    ...WRITING_SYSTEM_CODES,
    "AltLeft",
    "AltRight",
    "Backspace",
    "CapsLock",
    "ContextMenu",
    "ControlLeft",
    "ControlRight",
    "Enter",
    "MetaLeft",
    "MetaRight",
    "ShiftLeft",
    "ShiftRight",
    "Space",
    "Tab",
    "Convert",
    "KanaMode",
    "Lang1",
    "Lang2",
    "Lang3",
    "Lang4",
    "Lang5",
    "NonConvert",
    "Delete",
    "End",
    "Help",
    "Home",
    "Insert",
    "PageDown",
    "PageUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "NumLock",
    "Numpad0",
    "Numpad1",
    "Numpad2",
    "Numpad3",
    "Numpad4",
    "Numpad5",
    "Numpad6",
    "Numpad7",
    "Numpad8",
    "Numpad9",
    "NumpadAdd",
    "NumpadBackspace",
    "NumpadClear",
    "NumpadClearEntry",
    "NumpadComma",
    "NumpadDecimal",
    "NumpadDivide",
    "NumpadEnter",
    "NumpadEqual",
    "NumpadHash",
    "NumpadMemoryAdd",
    "NumpadMemoryClear",
    "NumpadMemoryRecall",
    "NumpadMemoryStore",
    "NumpadMemorySubtract",
    "NumpadMultiply",
    "NumpadParenLeft",
    "NumpadParenRight",
    "NumpadStar",
    "NumpadSubtract",
    "Escape",
    "Fn",
    "FnLock",
    "Pause",
    "PrintScreen",
    "ScrollLock",
    "BrowserBack",
    "BrowserFavorites",
    "BrowserForward",
    "BrowserHome",
    "BrowserRefresh",
    "BrowserSearch",
    "BrowserStop",
    "Eject",
    "LaunchApp1",
    "LaunchApp2",
    "LaunchMail",
    "MediaPlayPause",
    "MediaSelect",
    "MediaStop",
    "MediaTrackNext",
    "MediaTrackPrevious",
    "Power",
    "Sleep",
    "AudioVolumeDown",
    "AudioVolumeMute",
    "AudioVolumeUp",
    "WakeUp",
    "Abort",
    "Again",
    "Copy",
    "Cut",
    "Find",
    "Hiragana",
    "Hyper",
    "Katakana",
    "Open",
    "Paste",
    "Props",
    "Resume",
    "Select",
    "Super",
    "Suspend",
    "Turbo",
    "Undo",
    "Unidentified",
  ]);

  const DEDICATED_BROWSER_CODES = new Set([
    "Escape",
    "BrowserBack",
    "BrowserFavorites",
    "BrowserForward",
    "BrowserHome",
    "BrowserRefresh",
    "BrowserSearch",
    "BrowserStop",
    "Eject",
    "LaunchApp1",
    "LaunchApp2",
    "LaunchMail",
    "MediaPlayPause",
    "MediaSelect",
    "MediaStop",
    "MediaTrackNext",
    "MediaTrackPrevious",
    "Power",
    "Sleep",
    "AudioVolumeDown",
    "AudioVolumeMute",
    "AudioVolumeUp",
    "WakeUp",
  ]);

  const MODIFIER_CODES = new Set([
    "AltLeft",
    "AltRight",
    "ControlLeft",
    "ControlRight",
    "MetaLeft",
    "MetaRight",
    "ShiftLeft",
    "ShiftRight",
  ]);

  let lockState = null;
  let pageFullscreenKeyboardLock = "none";
  let fullscreenRequestGeneration = 0;
  const suppressedCodes = new Set();

  /** Creates an API DOMException. */
  function apiError(name, message) {
    return new DOMException(message, name);
  }

  /** Checks whether a string is a valid KeyboardEvent.code value. */
  function isValidCode(code) {
    return VALID_CODES.has(code) || /^F[1-9]\d*$/.test(code);
  }

  /** Validates and deduplicates keyboard lock codes. */
  function validateCodes(codes) {
    const result = [];
    const seen = new Set();

    for (const code of codes) {
      if (!isValidCode(code)) {
        throw apiError("InvalidAccessError", `Invalid keyboard code: ${code}`);
      }

      if (!seen.has(code)) {
        seen.add(code);
        result.push(code);
      }
    }

    return result;
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

  /** Reads the caller's Fullscreen API keyboard-lock request. */
  function readFullscreenKeyboardLock(options) {
    if (options === undefined || options === null) return "none";

    const source = unwrap(options);
    if (typeof source !== "object" && typeof source !== "function") {
      return null;
    }

    const value = Reflect.get(source, "keyboardLock", source);
    if (value === undefined) return "none";

    const mode = String(value);
    if (mode !== "none" && mode !== "browser") return null;
    return mode;
  }

  /** Creates page-realm fullscreen options that force browser keyboard lock. */
  function makeBrowserLockOptions(options) {
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
      value: "browser",
      writable: true,
      enumerable: true,
      configurable: true,
    });

    return forwarded;
  }

  /** Implements the page-visible requestFullscreen() wrapper. */
  function requestFullscreen(options = undefined) {
    const requestedMode = readFullscreenKeyboardLock(options);
    if (requestedMode === null) {
      return Reflect.apply(pageRequestFullscreen, unwrap(this), arguments);
    }

    const previousMode = pageFullscreenKeyboardLock;
    const generation = ++fullscreenRequestGeneration;
    pageFullscreenKeyboardLock = requestedMode;

    let result;
    try {
      result = Reflect.apply(pageRequestFullscreen, unwrap(this), [
        makeBrowserLockOptions(options),
      ]);
    } catch (error) {
      if (generation === fullscreenRequestGeneration) {
        pageFullscreenKeyboardLock = previousMode;
      }
      throw error;
    }

    Promise.resolve(result).catch(() => {
      if (generation === fullscreenRequestGeneration) {
        pageFullscreenKeyboardLock = previousMode;
      }
    });

    return result;
  }

  /** Returns whether the current event is a browser-shortcut round trip. */
  function isBrowserShortcutEvent(event) {
    if (MODIFIER_CODES.has(event.code)) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return true;
    if (/^F[1-9]\d*$/.test(event.code)) return true;
    return DEDICATED_BROWSER_CODES.has(event.code);
  }

  /** Returns whether the physical code is owned by Keyboard Lock. */
  function isLocked(code) {
    if (!lockState) return false;
    return lockState.all || lockState.codes.has(code);
  }

  /** Filters browser-reserved events according to the logical lock state. */
  function onKeyEvent(event) {
    if (!pageDocument.fullscreenElement) return;

    if (event.type !== "keydown" && suppressedCodes.has(event.code)) {
      event.stopImmediatePropagation();
      if (event.type === "keyup") suppressedCodes.delete(event.code);
      return;
    }

    if (!isBrowserShortcutEvent(event)) return;
    if (pageFullscreenKeyboardLock === "browser") return;
    if (isLocked(event.code)) return;

    if (event.type === "keydown") suppressedCodes.add(event.code);
    event.stopImmediatePropagation();

    if (event.type === "keydown" && event.code === "Escape" && !lockState) {
      pageDocument.exitFullscreen().catch(() => {});
    }
  }

  /** Resets per-fullscreen routing state after leaving DOM fullscreen. */
  function onFullscreenChange() {
    if (pageDocument.fullscreenElement) return;

    ++fullscreenRequestGeneration;
    pageFullscreenKeyboardLock = "none";
    suppressedCodes.clear();
  }

  /** Handles a Keyboard Lock request. */
  function lock(codes) {
    assertActiveTopLevel();

    try {
      codes = validateCodes(codes);
    } catch (error) {
      lockState = null;
      throw error;
    }

    lockState = {
      all: codes.length === 0,
      codes: new Set(codes),
    };
  }

  /** Handles Keyboard.unlock() when the context is supported. */
  function unlock() {
    try {
      assertActiveTopLevel();
    } catch {
      return;
    }

    lockState = null;
  }

  if (window.isSecureContext) {
    const pageRequestFullscreenWrapper = exportToPage(requestFullscreen);
    definePageProperty(pageElementPrototype, "requestFullscreen", {
      value: pageRequestFullscreenWrapper,
      writable: requestFullscreenDescriptor.writable,
      enumerable: requestFullscreenDescriptor.enumerable,
      configurable: requestFullscreenDescriptor.configurable,
    });

    for (const type of ["keydown", "keypress", "keyup"]) {
      window.addEventListener(type, onKeyEvent, true);
    }
    window.addEventListener("fullscreenchange", onFullscreenChange, true);
  }

  return { lock, unlock };
})();
