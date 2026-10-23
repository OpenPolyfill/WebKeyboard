# WebKeyboard

A privileged Firefox compatibility layer for the WICG Keyboard API.

Target: **Firefox 151+**.

## Status

**Keyboard Lock** is implemented, including full and per-code locks for Firefox browser shortcuts.

**Keyboard Map** supports per-origin selection of bundled XKB and custom layouts.
Bundled presets are available for US, UK, German, French, Japanese, Korean,
and Brazilian layouts. “System” uses the native host's OS-derived key map
directly; it does not convert a detected layout ID into one of those presets.
If the host is unavailable, the addon retains its US fallback.

System maps follow Chromium's `KeyboardLayoutMap` generation: unshifted
characters for writing-system `KeyboardEvent.code` values, choosing the first
ASCII-capable map according to the platform backend. Bundled XKB presets are
generated from `evdev` rules with the `pc105` model for explicit preset choices.

## Install

Load `manifest.json` as a temporary add-on from `about:debugging` → **This Firefox** → **Load Temporary Add-on**. The default build uses the public Fullscreen API and does not require WebExtension Experiments.

For the optional privileged upgrade, run `npm run build:privileged` and load the resulting add-on from `dist-privileged`. This build registers `src/experiment/schema.json` and `src/experiment/api.js`; it requires `extensions.experiments.enabled` in `about:config`. The default `npm run build` omits Experiments and remains usable with all-key locking.

For an unsigned persistent install on Developer Edition or Nightly, also set `xpinstall.signatures.required` to `false`.

Optional: install the native host to provide the OS-derived key map when
“System” is selected. It requires Rust/Cargo and, on Linux, GTK 3/GDK and
libxkbcommon development files. Restart Firefox after installation:

```sh
# Linux and macOS
sh native/install-unix.sh

# Windows PowerShell, from the repository root
.\native\install-windows.ps1
```

Linux reads unshifted key values from GDK's current keymap (including X11 and
Wayland), then falls back to the XKB server map through `xkbcomp` and
libxkbcommon, GNOME input-source configuration, and `setxkbmap`. It chooses the
first ASCII-capable group, matching Chromium's GTK backend. Windows queries the
foreground layout first, then other installed layouts with
`MapVirtualKeyEx`/`ToUnicodeEx`. macOS uses the active ASCII-capable Text Input
Source and `UCKeyTranslate`.

The generation logic follows Chromium's
[shared map builder](https://github.com/chromium/chromium/blob/main/ui/events/keycodes/dom/dom_keyboard_layout_map_base.cc)
and its [Linux](https://github.com/chromium/chromium/blob/main/ui/gtk/gtk_ui.cc),
[Windows](https://github.com/chromium/chromium/blob/main/ui/events/keycodes/dom/dom_keyboard_layout_map_win.cc),
and [macOS](https://github.com/chromium/chromium/blob/main/ui/events/keycodes/dom/dom_keyboard_layout_map_mac.mm)
backends.


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
In “System” mode it asks the native host for an OS-derived map on each call and
returns that map directly, even when the layout is not bundled with the addon.
Without the optional host it uses US. Standard and user-defined layouts are
stored in the addon database; custom layouts are managed from the popup's editor
link. Changing the selected layout dispatches `layoutchange` on the `Keyboard`
instance in open pages. In System mode, KDE/Plasma Linux and macOS use native
layout-change notifications; the addon polls once per second on other
platforms/desktops where it has no event source. Monitoring starts after a page
registers a listener and stops when its content context closes or its origin
leaves System mode.
Existing map objects remain unchanged; call `getLayoutMap()` again to retrieve
the newly selected map.

`navigator.permissions.query({ name: "keyboard-map" })` is also supported and
returns a page-realm `PermissionStatus` with `state` set to `"granted"` or
`"denied"` according to the same Permissions Policy decision.

## Keyboard Lock

`lock()` with no codes arms an all-key lock. When fullscreen is already active or is requested later, the addon best-effort passes `keyboardLock: "browser"` through the public Fullscreen API; `unlock()` best-effort restores `"none"`. Selective key-code locking is available only with the optional privileged backend; without it, requests with codes reject.

```js
await navigator.keyboard.lock()
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
  ├─ public Fullscreen API (all-key fallback)
  ├─ optional WebExtension Experiment API (selective lock upgrade)
  └─ Native Messaging (optional)
       Rust host → OS keyboard layout APIs
```


The content script runs at `document_start` and owns the page-facing API, WebIDL-style argument conversion, validation, lock sequencing, and background RPC.

The background script owns document-level request routing and lock ownership. The top-frame control port represents the lifetime of the document; disconnecting it clears any lock still owned by that document.

Keyboard Map Permissions Policy is enforced separately. A read-only
`webRequest.onBeforeRequest`/`onHeadersReceived` observer tracks navigation
lifetimes and replaces response policy on redirects. An eager policy port in
every isolated frame queries the exact parent frame's `<iframe allow>`
delegation through Firefox Xrays before `getLayoutMap()` resolves.

The optional Experiment backend observes Firefox chrome keyboard events and updates `WindowGlobalParent` keyboard-lock routing per physical `KeyboardEvent.code`. It is an upgrade for selective key locking; the default build does not require it.

## Secure contexts

The polyfill is not installed when `window.isSecureContext` is false.

`npm test` runs the Rust unit tests, builds the debug native host, temporarily
registers its manifest, and runs the Firefox browser suite against it. An
existing native host registration is backed up and restored; if none exists,
the temporary registration is removed after the run. The runner also fails if
Firefox never launches the debug host.

```sh
npm ci
npx playwright install firefox
npm test
```

The native host build requires Rust/Cargo and, on Linux, GTK 3/GDK and
libxkbcommon development files. The Rust tests can also be run independently:

```sh
cargo test --manifest-path native/Cargo.toml
```


## Debugging

Background activity is logged with `console.debug()`. Backend failures are logged with `console.error()`.
