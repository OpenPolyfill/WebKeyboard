# WebKeyboard

A Firefox compatibility layer for the WICG Keyboard API.

Target: **Firefox 151+**.

This branch implements Keyboard Lock on top of Firefox's public Fullscreen API instead of a WebExtension Experiment backend.

## Status

**Keyboard Lock** is implemented, including full and per-code locks for Firefox browser shortcuts.

**Keyboard Map is not implemented in v0.1.0.**

## Install

Load `src/manifest.json` as a temporary add-on from `about:debugging` → **This Firefox** → **Load Temporary Add-on**.

This branch does not use a background context or WebExtension Experiment API.

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
};
```

## Keyboard Lock

`lock()` and `unlock()` only update logical state in the isolated content script.

Every DOM `requestFullscreen()` call is delegated with `keyboardLock: "browser"` so Firefox's native fullscreen keyboard routing is already armed before a later `navigator.keyboard.lock()` call. The isolated capture listener then decides which browser-shortcut events are visible to the page:

- a code owned by `navigator.keyboard.lock()` is allowed through;
- an unlocked browser shortcut is stopped before page listeners without calling `preventDefault()`, so Firefox can still run its browser action;
- a page that explicitly requested `requestFullscreen({ keyboardLock: "browser" })` keeps Firefox's native passthrough behavior;
- `requestFullscreen({ keyboardLock: "none" })` is internally upgraded to `"browser"` and the `none` behavior is emulated by the capture filter.

This makes lock-before-fullscreen and lock-after-fullscreen use the same state machine and avoids a second Fullscreen API request when `lock()` or `unlock()` changes state.

## Architecture

```text
Page Web API
    ↕
ISOLATED content script
    ├─ navigator.keyboard logical state
    ├─ requestFullscreen() wrapper
    └─ keyboard-event capture filter
    ↕
Firefox Fullscreen API keyboardLock="browser"
```

## Limitations

Firefox still considers the DOM fullscreen session natively browser-keyboard-locked because the backend keeps `keyboardLock: "browser"` armed. Browser chrome behavior tied to that native state, especially the fullscreen Escape path and related UI, cannot be fully virtualized by a content script.

When Firefox exposes its internal remote-reply marker to the isolated Xray listener, the filter uses it to identify browser-shortcut round trips exactly. Otherwise it falls back to shortcut-shaped keyboard events (modifier chords, function keys, and dedicated browser/media keys), which can hide a page-defined chord that Firefox itself would not reserve.

## Secure contexts

The polyfill and Fullscreen API wrapper are installed only when `window.isSecureContext` is true.
