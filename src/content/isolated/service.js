/** Keyboard Lock state and API algorithm implementation. */
"use strict";

const keyboardService = (() => {
  const pageDocument = unwrap(window.document);
  const fullscreenLock = (() => {
    const pageElementPrototype = unwrap(window.Element.prototype);
    const nativeRequestFullscreen = Reflect.get(pageElementPrototype, "requestFullscreen");
    const requestDescriptor = Reflect.getOwnPropertyDescriptor(pageElementPrototype, "requestFullscreen");
    let armed = false;
    let induced = false;
    let generation = 0;

    function withKeyboardLock(options, mode) {
      const forwarded = unwrap(new window.Object());
      const source = unwrap(options);
      if (source && (typeof source === "object" || typeof source === "function")) {
        setPagePrototype(forwarded, source);
      }
      definePageProperty(forwarded, "keyboardLock", {
        value: mode, writable: true, enumerable: true, configurable: true,
      });
      return forwarded;
    }

    function parseKeyboardLock(options) {
      if (options === undefined || options === null) return "none";
      try {
        let source = unwrap(options);
        if (source === null || (typeof source !== "object" && typeof source !== "function")) return "invalid";
        while (source !== null) {
          const property = Reflect.getOwnPropertyDescriptor(source, "keyboardLock");
          if (property) {
            if ("get" in property || "set" in property) return "invalid";
            const value = property.value;
            if (value === undefined) return "none";
            return value === "none" || value === "browser" ? value : "invalid";
          }
          source = Reflect.getPrototypeOf(source);
        }
        return "none";
      } catch (_) {
        return "invalid";
      }
    }

    function requestWithKeyboardLock(element, mode) {
      try {
        Promise.resolve(Reflect.apply(nativeRequestFullscreen, element, [
          withKeyboardLock(undefined, mode),
        ])).catch(() => {});
      } catch (_) {}
    }

    function wrappedRequestFullscreen(options = undefined) {
      const requestedLock = parseKeyboardLock(options);
      const current = ++generation;
      let args = arguments;
      if (requestedLock !== "invalid" && armed) {
        induced = requestedLock !== "browser";
        args = [withKeyboardLock(options, "browser")];
      } else {
        induced = false;
      }
      let result;
      try {
        result = Reflect.apply(nativeRequestFullscreen, unwrap(this), args);
      } catch (error) {
        if (current === generation) induced = false;
        throw error;
      }
      Promise.resolve(result).catch(() => {
        if (current === generation) induced = false;
      });
      return result;
    }

    if (window.isSecureContext && typeof nativeRequestFullscreen === "function" && requestDescriptor) {
      definePageProperty(pageElementPrototype, "requestFullscreen", {
        value: exportToPage(wrappedRequestFullscreen),
        writable: requestDescriptor.writable,
        enumerable: requestDescriptor.enumerable,
        configurable: requestDescriptor.configurable,
      });
    }

    return {
      arm() {
        armed = true;
        if (pageDocument.fullscreenElement && !induced) {
          induced = true;
          requestWithKeyboardLock(pageDocument.fullscreenElement, "browser");
        }
      },
      disarm() {
        armed = false;
        ++generation;
        if (induced && pageDocument.fullscreenElement) {
          requestWithKeyboardLock(pageDocument.fullscreenElement, "none");
        }
        induced = false;
      },
    };
  })();


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

  let mutationTail = Promise.resolve();
  let pendingLock = null;

  /**
   * Creates an API DOMException.
   * @param {string} name DOMException name.
   * @param {string} message Error message.
   * @returns {DOMException} Created exception.
   */
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

  /** Serializes lock-state mutations. */
  function queueMutation(task) {
    const run = mutationTail.then(task);
    mutationTail = run.catch(() => {});
    return run;
  }

  /** Rejects the current pending lock request as superseded. */
  function abortPendingLock() {
    if (!pendingLock) return;

    pendingLock.superseded = true;
    pendingLock.reject(
      apiError(
        "AbortError",
        "Keyboard lock request was superseded by a newer request",
      ),
    );
    pendingLock = null;
  }

  /**
   * Handles a Keyboard Lock request.
   * @param {string[]} codes Converted physical key codes.
   * @returns {Promise<void>} Lock completion promise.
   */
  function lock(codes) {
    assertActiveTopLevel();
    abortPendingLock();

    try {
      codes = validateCodes(codes);
    } catch (error) {
      return queueMutation(async () => {
        fullscreenLock.disarm();
        try {
          await request("unlock");
        } finally {
          throw error;
        }
      });
    }

    return new Promise((resolve, reject) => {
      const entry = { reject, superseded: false };
      pendingLock = entry;

      queueMutation(async () => {
        if (entry.superseded) return;

        try {
          try {
            await request("lock", codes);
          } catch (error) {
            if (codes.length !== 0) {
              throw apiError(
                "NotSupportedError",
                "Selective keyboard locking requires the optional privileged backend",
              );
            }
          }
          if (!entry.superseded && codes.length === 0) fullscreenLock.arm();
          if (!entry.superseded) resolve(undefined);
        } catch (error) {
          fullscreenLock.disarm();
          if (!entry.superseded) reject(error);
        } finally {
          if (pendingLock === entry) pendingLock = null;
        }
      });
    });
  }

  /** Handles Keyboard.unlock() when the context is supported. */
  function unlock() {
    try {
      assertActiveTopLevel();
    } catch {
      return;
    }

    queueMutation(() => {
      fullscreenLock.disarm();
      return request("unlock");
    }).catch(() => {});
  }

  return { lock, unlock };
})();
