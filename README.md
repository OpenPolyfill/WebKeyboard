# WebKeyboard

A Firefox compatibility layer for the WICG Keyboard API.

Target: **Firefox 151+**.

This branch implements Keyboard Lock on top of Firefox's public Fullscreen API instead of a WebExtension Experiment backend.

## Status

- **Keyboard Lock:**
  - Supports all-key `lock()` and `unlock()` best effort.
  - Selective key locks are unsupported.
- **Keyboard Map is not implemented**

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

## Support matrix

| `lock()` position | `lock()` input | `requestFullscreen()` | `unlock()` | Support |
| --- | --- | --- | --- | --- |
| Before | Empty sequence | option omitted or `keyboardLock: "none"` | Tries native `keyboardLock: "none"` | Partial |
| Before | Empty sequence | `keyboardLock: "browser"` | Keeps native browser locking | Functional |
| After | Empty sequence | option omitted or `keyboardLock: "none"` | `lock()` tries `"browser"`; `unlock()` tries `"none"` | Partial |
| After | Empty sequence | `keyboardLock: "browser"` | No second request; keeps native browser locking | Functional |
| Before | Empty sequence | Request rejects | No native change | Functional |
| Before | Empty sequence | No fullscreen request | No native request | Functional |
| Any | Empty sequence | Any option | Not fullscreen; no native request | Functional |
| - | - | Any option | Passthrough; no native downgrade | Functional |
| Any | Non-empty sequence | Any option | Not applicable | Unsupported |

## Secure contexts

The polyfill and Fullscreen API wrapper are installed only when `window.isSecureContext` is true.
