/** WebKeyboard privileged backend. */

"use strict";

const KEY_EVENT_TYPES = ["keydown", "keypress", "keyup"];

this.keyboard = class extends ExtensionAPI {
  /**
   * Initializes privileged backend state.
   * @param {object} extension Owning extension instance.
   */
  constructor(extension) {
    super(extension);
    this.extensionRef = extension;
    this.initialized = false;
    this.attachedWindows = new WeakSet();
    this.windowListener = null;

    this.locks = new WeakMap();
    this.lockedBrowsersByTabId = new Map();

    this.onChromeKeyCapture = this.onChromeKeyCapture.bind(this);
    this.onChromeKeySystem = this.onChromeKeySystem.bind(this);
    this.onChromeFullscreenChange = this.onChromeFullscreenChange.bind(this);
  }

  /**
   * Logs a privileged backend error.
   * @param {*} error Error value.
   */
  logError(error) {
    console.error("WebKeyboard privileged backend:", error);
  }

  /**
   * Initializes browser-window listeners once.
   */
  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      this.attachWindow(win);
    }

    this.windowListener = {
      /**
       * Attaches listeners when a browser window opens.
       * @param {object} xulWindow Opened XUL window.
       */
      onOpenWindow: (xulWindow) => {
        let win = null;
        try {
          win = xulWindow.docShell?.domWindow || null;
        } catch (_) {}
        if (!win) {
          return;
        }
        const attach = () => this.attachWindow(win);
        if (win.document?.readyState === "complete") {
          attach();
        } else {
          win.addEventListener("load", attach, { once: true });
        }
      },
      /**
       * Handles browser window close notifications.
       */
      onCloseWindow: () => {},
    };
    Services.wm.addListener(this.windowListener);
  }

  /**
   * Attaches keyboard and fullscreen listeners to a browser window.
   * @param {Window} win Browser chrome window.
   */
  attachWindow(win) {
    try {
      if (!win || this.attachedWindows.has(win)) {
        return;
      }
      this.attachedWindows.add(win);

      for (const type of KEY_EVENT_TYPES) {
        win.addEventListener(type, this.onChromeKeyCapture, {
          capture: true,
        });

        win.addEventListener(type, this.onChromeKeySystem, {
          capture: true,
          mozSystemGroup: true,
        });
      }

      win.addEventListener("fullscreenchange", this.onChromeFullscreenChange, {
        capture: true,
      });
    } catch (error) {
      this.logError(error);
    }
  }

  /**
   * Removes keyboard and fullscreen listeners from a browser window.
   * @param {Window} win Browser chrome window.
   */
  detachWindow(win) {
    try {
      for (const type of KEY_EVENT_TYPES) {
        win?.removeEventListener(type, this.onChromeKeyCapture, {
          capture: true,
        });
        win?.removeEventListener(type, this.onChromeKeySystem, {
          capture: true,
          mozSystemGroup: true,
        });
      }
      win?.removeEventListener(
        "fullscreenchange",
        this.onChromeFullscreenChange,
        {
          capture: true,
        },
      );
    } catch (_) {}
  }

  /**
   * Resolves a WebExtension tab id to its browser element.
   * @param {number} tabId WebExtension tab id.
   * @returns {Element} Remote browser element.
   */
  getBrowserForTab(tabId) {
    const tab = this.extensionRef.tabManager.get(tabId);
    if (!tab) {
      throw new Error(`No tab for id ${tabId}`);
    }

    const nativeTab = tab.nativeTab;
    const browser =
      nativeTab?.linkedBrowser ||
      nativeTab?.browser ||
      nativeTab?.ownerGlobal?.gBrowser?.getBrowserForTab?.(nativeTab);

    if (!browser) {
      throw new Error(`Could not resolve <browser> for tab ${tabId}`);
    }
    return browser;
  }

  /**
   * Returns the remote browser targeted by a chrome keyboard event.
   * @param {Event} event Chrome keyboard event.
   * @returns {Element|null} Remote browser element.
   */
  getRemoteBrowserFromEvent(event) {
    const target = event?.target;
    return target?.isRemoteBrowser === true ? target : null;
  }

  /**
   * Checks whether a browser element owns DOM fullscreen.
   * @param {Element} browser Browser element.
   * @returns {boolean} Whether it is the fullscreen element.
   */
  isBrowserInDOMFullscreen(browser) {
    try {
      return browser?.ownerDocument?.fullscreenElement === browser;
    } catch (_) {
      return false;
    }
  }

  /**
   * Checks whether a lock state includes an event physical code.
   * @param {object} state Stored lock state.
   * @param {KeyboardEvent} event Keyboard event.
   * @returns {boolean} Whether the event is locked.
   */
  lockMatchesEvent(state, event) {
    return !!state && (state.all || state.codes.has(event.code));
  }

  /**
   * Updates fullscreen keyboard-lock routing for a browser.
   * @param {Element} browser Browser element.
   * @param {"none"|"browser"} mode Routing mode.
   */
  setChromeFullscreenKeyboardLock(browser, mode) {
    const windowGlobal = browser?.browsingContext?.currentWindowGlobal;
    if (!windowGlobal) {
      throw new Error("Missing WindowGlobalParent for keyboard lock");
    }
    if (typeof windowGlobal.updateFullscreenKeyboardLockStatus !== "function") {
      throw new Error("Fullscreen keyboard-lock routing is unavailable");
    }
    if (browser.ownerDocument?.fullscreenKeyboardLock === mode) return;
    windowGlobal.updateFullscreenKeyboardLockStatus(mode);
  }

  /**
   * Resets per-event keyboard routing when a locked browser enters fullscreen.
   * @param {Event} event Chrome fullscreenchange event.
   */
  onChromeFullscreenChange(event) {
    try {
      const win = event.currentTarget;
      const browser = win?.document?.fullscreenElement || null;
      if (!browser?.isRemoteBrowser) {
        return;
      }

      const state = this.locks.get(browser);
      if (!state) {
        return;
      }

      this.setChromeFullscreenKeyboardLock(browser, "none");
    } catch (error) {
      this.logError(error);
    }
  }

  /**
   * Selects keyboard routing for the current physical key event.
   * @param {KeyboardEvent} event Chrome keyboard event.
   */
  onChromeKeyCapture(event) {
    try {
      if (event.isReplyEventFromRemoteContent) {
        return;
      }

      const browser = this.getRemoteBrowserFromEvent(event);
      if (!browser || !this.isBrowserInDOMFullscreen(browser)) {
        return;
      }

      const state = this.locks.get(browser);
      if (!state) {
        return;
      }

      const locked = this.lockMatchesEvent(state, event);

      this.setChromeFullscreenKeyboardLock(
        browser,
        locked ? "browser" : "none",
      );
    } catch (error) {
      this.logError(error);
    }
  }

  /**
   * Suppresses browser actions for locked reply events.
   * @param {KeyboardEvent} event Chrome keyboard event.
   */
  onChromeKeySystem(event) {
    try {
      const browser = this.getRemoteBrowserFromEvent(event);
      if (!browser) {
        return;
      }

      const state = this.locks.get(browser);
      if (!state || !event.isReplyEventFromRemoteContent) {
        return;
      }

      if (this.lockMatchesEvent(state, event)) {
        event.preventDefault();
      }
    } catch (error) {
      this.logError(error);
    }
  }

  /**
   * Builds the privileged WebExtension Experiment API.
   * @returns {object} Experiment API object.
   */
  getAPI() {
    this.init();

    return {
      keyboard: {
        /**
         * Applies a keyboard lock for a tab.
         * @param {number} tabId WebExtension tab id.
         * @param {string[]} codes Physical key codes to lock.
         */
        lock: (tabId, codes) => {
          const browser = this.getBrowserForTab(tabId);
          this.locks.set(browser, {
            all: codes.length === 0,
            codes: new Set(codes),
          });
          this.lockedBrowsersByTabId.set(tabId, browser);

          try {
            if (this.isBrowserInDOMFullscreen(browser)) {
              this.setChromeFullscreenKeyboardLock(browser, "none");
            }
          } catch (error) {
            this.locks.delete(browser);
            this.lockedBrowsersByTabId.delete(tabId);
            throw error;
          }
        },

        /**
         * Clears a keyboard lock for a tab.
         * @param {number} tabId WebExtension tab id.
         */
        unlock: (tabId) => {
          const browser = this.lockedBrowsersByTabId.get(tabId);
          this.lockedBrowsersByTabId.delete(tabId);
          if (!browser) return;

          this.locks.delete(browser);
          this.setChromeFullscreenKeyboardLock(browser, "none");
        },
      },
    };
  }

  /**
   * Clears lock state and detaches privileged listeners.
   */
  onShutdown() {
    try {
      for (const browser of this.lockedBrowsersByTabId.values()) {
        this.locks.delete(browser);
        this.setChromeFullscreenKeyboardLock(browser, "none");
      }
      this.lockedBrowsersByTabId.clear();

      if (this.windowListener) {
        Services.wm.removeListener(this.windowListener);
        this.windowListener = null;
      }
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        this.detachWindow(win);
      }
      this.initialized = false;
    } catch (error) {
      this.logError(error);
    }
  }
};
