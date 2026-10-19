# WebKeyboard

A privileged Firefox compatibility layer for the WICG Keyboard API.

Target: **Firefox 151+**.

## Status

**Keyboard Lock** is implemented, including full and per-code locks for Firefox browser shortcuts.

**Keyboard Map** supports per-origin selection of bundled XKB and custom layouts.
The bundled presets are compiled from the installed xkeyboard-config data for
US, UK, German, French, Japanese, Korean, and Brazilian layouts. “System”
currently falls back to US; active desktop layout detection is out of scope.

Bundled XKB presets are generated with libxkbcommon 1.13.2 from the installed
`evdev` rules using the `pc105` model and the unmodified key level. The catalog
contains the base `us`, `gb`, `de`, `fr`, `jp`, `kr`, and `br` layouts. It is
bundled data, not runtime desktop detection; Shift/AltGr layers and compose
sequences are outside this `KeyboardLayoutMap` dataset.

## Install

WebExtension Experiments must be enabled before loading the addon.

1. Open `about:config`.
2. Set `extensions.experiments.enabled` to `true`.
3. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**.
4. Select `manifest.json` from the unpacked source tree.

For an unsigned persistent install on Developer Edition or Nightly, also set `xpinstall.signatures.required` to `false`.

## API

The addon exposes `navigator.keyboard` in secure contexts with:

```webidl
partial interface Navigator {
  [SecureContext, SameObject] readonly attribute Keyboard keyboard;
};

[SecureContext, Exposed=Window]
interface Keyboard : EventTarget {
  Promise<undefined> lock(optional sequence<DOMString> keyCodes = []);
  undefined unlock();
  Promise<KeyboardLayoutMap> getLayoutMap();
  attribute EventHandler onlayoutchange;
};

[Exposed=Window]
interface KeyboardLayoutMap {
  readonly maplike<DOMString, DOMString>;
};
```

`getLayoutMap()` uses the layout selected for the page's origin in the addon popup.
“System” currently falls back to US because Firefox layout detection is not
available. Standard and user-defined layouts are stored in the addon database;
custom layouts are managed from the popup's editor link. Changing the selected
layout dispatches `layoutchange` on the `Keyboard` instance in open pages.
Existing map objects remain unchanged; call `getLayoutMap()` again to retrieve
the newly selected map.

`navigator.permissions.query({ name: "keyboard-map" })` is also supported and
returns a page-realm `PermissionStatus` with `state` set to `"granted"` or
`"denied"` according to the same Permissions Policy decision.

## Keyboard Lock

The lock is armed by `lock()` and becomes effective while the top-level document is in DOM fullscreen.

```js
await navigator.keyboard.lock(["KeyW"])
```

With the lock above:

- `W` is delivered to the page normally.
- `Ctrl+W` is delivered to the page and Firefox does not close the tab.
- `Ctrl+Shift+W` is delivered to the page and the matching Firefox shortcut is suppressed.
- `Ctrl+T` remains a normal Firefox shortcut and is not forwarded to the page as a reserved browser shortcut.

Calling `lock()` with no codes locks all supported browser-reserved keyboard codes while DOM fullscreen is active.

A newer `lock()` request replaces the previous request. A pending request superseded by a newer request rejects with `AbortError`.

`unlock()` clears the active lock.

Desktop-environment and operating-system global shortcuts remain controlled by the operating system. A compositor may still react to keys such as `Super` even when Firefox also delivers the event to the page.

Firefox also retains its own fullscreen escape path. The fullscreen-exit shortcut remains reserved (`F11` on non-macOS, `Cmd+Ctrl+F` on macOS), and holding `Escape` can still exit keyboard lock/fullscreen.

## Architecture

```text
Page Web API
    ↕
ISOLATED content script
    ↕ runtime.Port
Background
    ↕ WebExtension Experiment API
Firefox chrome / keyboard routing
```

The content script runs at `document_start` and owns the page-facing API, WebIDL-style argument conversion, validation, lock sequencing, and background RPC.

The background script owns document-level request routing and lock ownership. The top-frame control port represents the lifetime of the document; disconnecting it clears any lock still owned by that document.

Keyboard Map Permissions Policy is enforced separately. A read-only
`webRequest.onBeforeRequest`/`onHeadersReceived` observer tracks navigation
lifetimes and replaces response policy on redirects. An eager policy port in
every isolated frame queries the exact parent frame's `<iframe allow>`
delegation through Firefox Xrays before `getLayoutMap()` resolves.

The Experiment backend observes Firefox chrome keyboard events and updates `WindowGlobalParent` keyboard-lock routing per physical `KeyboardEvent.code`. Locked codes use Firefox's content-first keyboard-lock route; unlocked codes keep Firefox's normal browser-shortcut route.

## Secure contexts

The polyfill is not installed when `window.isSecureContext` is false.

## Debugging

Background activity is logged with `console.debug()`. Backend failures are logged with `console.error()`.
