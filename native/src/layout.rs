use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq)]
pub struct NativeLayout {
    pub name: Option<String>,
    pub data: BTreeMap<String, String>,
}

#[allow(dead_code)]
#[derive(Clone, Copy)]
struct DomCode {
    code: &'static str,
    xkb_keycode: u32,
    windows_scancode: u32,
    mac_keycode: u16,
}

const WRITING_SYSTEM_KEYS: &[DomCode] = &[
    DomCode {
        code: "Backquote",
        xkb_keycode: 0x31,
        windows_scancode: 0x29,
        mac_keycode: 0x32,
    },
    DomCode {
        code: "Digit1",
        xkb_keycode: 0x0a,
        windows_scancode: 0x02,
        mac_keycode: 0x12,
    },
    DomCode {
        code: "Digit2",
        xkb_keycode: 0x0b,
        windows_scancode: 0x03,
        mac_keycode: 0x13,
    },
    DomCode {
        code: "Digit3",
        xkb_keycode: 0x0c,
        windows_scancode: 0x04,
        mac_keycode: 0x14,
    },
    DomCode {
        code: "Digit4",
        xkb_keycode: 0x0d,
        windows_scancode: 0x05,
        mac_keycode: 0x15,
    },
    DomCode {
        code: "Digit5",
        xkb_keycode: 0x0e,
        windows_scancode: 0x06,
        mac_keycode: 0x17,
    },
    DomCode {
        code: "Digit6",
        xkb_keycode: 0x0f,
        windows_scancode: 0x07,
        mac_keycode: 0x16,
    },
    DomCode {
        code: "Digit7",
        xkb_keycode: 0x10,
        windows_scancode: 0x08,
        mac_keycode: 0x1a,
    },
    DomCode {
        code: "Digit8",
        xkb_keycode: 0x11,
        windows_scancode: 0x09,
        mac_keycode: 0x1c,
    },
    DomCode {
        code: "Digit9",
        xkb_keycode: 0x12,
        windows_scancode: 0x0a,
        mac_keycode: 0x19,
    },
    DomCode {
        code: "Digit0",
        xkb_keycode: 0x13,
        windows_scancode: 0x0b,
        mac_keycode: 0x1d,
    },
    DomCode {
        code: "Minus",
        xkb_keycode: 0x14,
        windows_scancode: 0x0c,
        mac_keycode: 0x1b,
    },
    DomCode {
        code: "Equal",
        xkb_keycode: 0x15,
        windows_scancode: 0x0d,
        mac_keycode: 0x18,
    },
    DomCode {
        code: "IntlYen",
        xkb_keycode: 0x84,
        windows_scancode: 0x7d,
        mac_keycode: 0x5d,
    },
    DomCode {
        code: "KeyQ",
        xkb_keycode: 0x18,
        windows_scancode: 0x10,
        mac_keycode: 0x0c,
    },
    DomCode {
        code: "KeyW",
        xkb_keycode: 0x19,
        windows_scancode: 0x11,
        mac_keycode: 0x0d,
    },
    DomCode {
        code: "KeyE",
        xkb_keycode: 0x1a,
        windows_scancode: 0x12,
        mac_keycode: 0x0e,
    },
    DomCode {
        code: "KeyR",
        xkb_keycode: 0x1b,
        windows_scancode: 0x13,
        mac_keycode: 0x0f,
    },
    DomCode {
        code: "KeyT",
        xkb_keycode: 0x1c,
        windows_scancode: 0x14,
        mac_keycode: 0x11,
    },
    DomCode {
        code: "KeyY",
        xkb_keycode: 0x1d,
        windows_scancode: 0x15,
        mac_keycode: 0x10,
    },
    DomCode {
        code: "KeyU",
        xkb_keycode: 0x1e,
        windows_scancode: 0x16,
        mac_keycode: 0x20,
    },
    DomCode {
        code: "KeyI",
        xkb_keycode: 0x1f,
        windows_scancode: 0x17,
        mac_keycode: 0x22,
    },
    DomCode {
        code: "KeyO",
        xkb_keycode: 0x20,
        windows_scancode: 0x18,
        mac_keycode: 0x1f,
    },
    DomCode {
        code: "KeyP",
        xkb_keycode: 0x21,
        windows_scancode: 0x19,
        mac_keycode: 0x23,
    },
    DomCode {
        code: "BracketLeft",
        xkb_keycode: 0x22,
        windows_scancode: 0x1a,
        mac_keycode: 0x21,
    },
    DomCode {
        code: "BracketRight",
        xkb_keycode: 0x23,
        windows_scancode: 0x1b,
        mac_keycode: 0x1e,
    },
    DomCode {
        code: "Backslash",
        xkb_keycode: 0x33,
        windows_scancode: 0x2b,
        mac_keycode: 0x2a,
    },
    DomCode {
        code: "KeyA",
        xkb_keycode: 0x26,
        windows_scancode: 0x1e,
        mac_keycode: 0x00,
    },
    DomCode {
        code: "KeyS",
        xkb_keycode: 0x27,
        windows_scancode: 0x1f,
        mac_keycode: 0x01,
    },
    DomCode {
        code: "KeyD",
        xkb_keycode: 0x28,
        windows_scancode: 0x20,
        mac_keycode: 0x02,
    },
    DomCode {
        code: "KeyF",
        xkb_keycode: 0x29,
        windows_scancode: 0x21,
        mac_keycode: 0x03,
    },
    DomCode {
        code: "KeyG",
        xkb_keycode: 0x2a,
        windows_scancode: 0x22,
        mac_keycode: 0x05,
    },
    DomCode {
        code: "KeyH",
        xkb_keycode: 0x2b,
        windows_scancode: 0x23,
        mac_keycode: 0x04,
    },
    DomCode {
        code: "KeyJ",
        xkb_keycode: 0x2c,
        windows_scancode: 0x24,
        mac_keycode: 0x26,
    },
    DomCode {
        code: "KeyK",
        xkb_keycode: 0x2d,
        windows_scancode: 0x25,
        mac_keycode: 0x28,
    },
    DomCode {
        code: "KeyL",
        xkb_keycode: 0x2e,
        windows_scancode: 0x26,
        mac_keycode: 0x25,
    },
    DomCode {
        code: "Semicolon",
        xkb_keycode: 0x2f,
        windows_scancode: 0x27,
        mac_keycode: 0x29,
    },
    DomCode {
        code: "Quote",
        xkb_keycode: 0x30,
        windows_scancode: 0x28,
        mac_keycode: 0x27,
    },
    DomCode {
        code: "IntlBackslash",
        xkb_keycode: 0x5e,
        windows_scancode: 0x56,
        mac_keycode: 0x0a,
    },
    DomCode {
        code: "KeyZ",
        xkb_keycode: 0x34,
        windows_scancode: 0x2c,
        mac_keycode: 0x06,
    },
    DomCode {
        code: "KeyX",
        xkb_keycode: 0x35,
        windows_scancode: 0x2d,
        mac_keycode: 0x07,
    },
    DomCode {
        code: "KeyC",
        xkb_keycode: 0x36,
        windows_scancode: 0x2e,
        mac_keycode: 0x08,
    },
    DomCode {
        code: "KeyV",
        xkb_keycode: 0x37,
        windows_scancode: 0x2f,
        mac_keycode: 0x09,
    },
    DomCode {
        code: "KeyB",
        xkb_keycode: 0x38,
        windows_scancode: 0x30,
        mac_keycode: 0x0b,
    },
    DomCode {
        code: "KeyN",
        xkb_keycode: 0x39,
        windows_scancode: 0x31,
        mac_keycode: 0x2d,
    },
    DomCode {
        code: "KeyM",
        xkb_keycode: 0x3a,
        windows_scancode: 0x32,
        mac_keycode: 0x2e,
    },
    DomCode {
        code: "Comma",
        xkb_keycode: 0x3b,
        windows_scancode: 0x33,
        mac_keycode: 0x2b,
    },
    DomCode {
        code: "Period",
        xkb_keycode: 0x3c,
        windows_scancode: 0x34,
        mac_keycode: 0x2f,
    },
    DomCode {
        code: "Slash",
        xkb_keycode: 0x3d,
        windows_scancode: 0x35,
        mac_keycode: 0x2c,
    },
    DomCode {
        code: "IntlRo",
        xkb_keycode: 0x61,
        windows_scancode: 0x73,
        mac_keycode: 0x5e,
    },
];

#[allow(dead_code)]
#[derive(Clone, Copy)]
enum KeyValue {
    Unicode(u32),
    ZenkakuHankaku,
}

pub fn detect_system_layout() -> Option<NativeLayout> {
    #[cfg(target_os = "linux")]
    {
        return linux::detect();
    }
    #[cfg(target_os = "windows")]
    {
        return windows::detect();
    }
    #[cfg(target_os = "macos")]
    {
        return macos::detect();
    }
    #[allow(unreachable_code)]
    None
}

pub fn start_system_layout_listener(callback: Box<dyn Fn() + Send + 'static>) -> bool {
    #[cfg(target_os = "linux")]
    {
        return linux::start_event_listener(callback);
    }
    #[cfg(target_os = "macos")]
    {
        return macos::start_event_listener(callback);
    }
    #[cfg(target_os = "windows")]
    {
        let _ = callback;
        false
    }
}

fn value_to_string(value: KeyValue) -> Option<String> {
    if matches!(value, KeyValue::ZenkakuHankaku) {
        return Some("半角/全角".to_owned());
    }
    let KeyValue::Unicode(mut codepoint) = value else {
        unreachable!();
    };
    if (0x0300..=0x036f).contains(&codepoint) {
        codepoint = match codepoint {
            0x0300 => 0x0060,
            0x0301 => 0x0027,
            0x0302 => 0x005e,
            0x0303 => 0x007e,
            0x0308 => 0x00a8,
            _ => return None,
        };
    }
    char::from_u32(codepoint).map(|character| character.to_string())
}

fn is_ascii_capable(data: &BTreeMap<String, String>) -> bool {
    data.get("KeyA").is_some_and(|value| {
        let mut characters = value.chars();
        matches!(characters.next(), Some('a'..='z')) && characters.next().is_none()
    })
}
#[cfg(any(target_os = "windows", target_os = "macos", test))]
fn generate_layouts<F, N>(layout_count: usize, layout_name: N, translate: F) -> Option<NativeLayout>
where
    F: FnMut(usize, DomCode) -> Option<KeyValue>,
    N: FnMut(usize) -> Option<String>,
{
    generate_layouts_with_active(layout_count, None, layout_name, translate)
}

fn generate_layouts_with_active<F, N>(
    layout_count: usize,
    active_layout: Option<usize>,
    mut layout_name: N,
    mut translate: F,
) -> Option<NativeLayout>
where
    F: FnMut(usize, DomCode) -> Option<KeyValue>,
    N: FnMut(usize) -> Option<String>,
{
    let mut first_layout = None;
    if let Some(index) = active_layout.filter(|index| *index < layout_count) {
        let candidate = generate_layout(index, &mut layout_name, &mut translate);
        if !candidate.data.is_empty() {
            return Some(candidate);
        }
        first_layout = Some(candidate);
    }

    for index in 0..layout_count {
        if Some(index) == active_layout {
            continue;
        }
        let candidate = generate_layout(index, &mut layout_name, &mut translate);
        if is_ascii_capable(&candidate.data) {
            return Some(candidate);
        }
        if first_layout.is_none() {
            first_layout = Some(candidate);
        }
    }
    first_layout
}

fn generate_layout<F, N>(index: usize, layout_name: &mut N, translate: &mut F) -> NativeLayout
where
    F: FnMut(usize, DomCode) -> Option<KeyValue>,
    N: FnMut(usize) -> Option<String>,
{
    let mut data = BTreeMap::new();
    for &dom_code in WRITING_SYSTEM_KEYS {
        if let Some(value) = translate(index, dom_code).and_then(value_to_string) {
            data.insert(dom_code.code.to_owned(), value);
        }
    }
    NativeLayout {
        name: layout_name(index),
        data,
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use super::{
        DomCode, KeyValue, NativeLayout, generate_layouts_with_active, is_ascii_capable,
        value_to_string,
    };
    use std::collections::BTreeMap;
    use std::process::Command;
    use std::sync::LazyLock;
    use x11::xlib;
    use xkbcommon::xkb::{self, Context, Keymap, Keysym};

    // XkbUseCoreKbd from XKBlib.h.
    const XKB_USE_CORE_KEYBOARD: u32 = 0x0100;

    pub(super) fn detect() -> Option<NativeLayout> {
        let active_layout = active_layout_index();
        detect_from_gdk(active_layout)
            .or_else(|| current_keymap().and_then(|keymap| map_keymap(&keymap, active_layout)))
    }

    pub(super) fn start_event_listener(callback: Box<dyn Fn() + Send + 'static>) -> bool {
        let desktop = std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_ascii_lowercase();
        if !desktop.contains("kde") && std::env::var_os("KDE_SESSION_VERSION").is_none() {
            return false;
        }

        let (ready_sender, ready_receiver) = std::sync::mpsc::sync_channel(1);
        let thread = std::thread::Builder::new()
            .name("webkeyboard-layout-events".to_owned())
            .spawn(move || {
                use gtk::gio::prelude::*;

                let context = gtk::glib::MainContext::new();
                let setup_sender = ready_sender.clone();
                let result = context.with_thread_default(|| {
                    let connection = match gtk::gio::bus_get_sync(
                        gtk::gio::BusType::Session,
                        None::<&gtk::gio::Cancellable>,
                    ) {
                        Ok(connection) => connection,
                        Err(_) => {
                            let _ = setup_sender.send(false);
                            return;
                        }
                    };
                    let parameters = ("org.kde.keyboard",).to_variant();
                    let has_owner = connection
                        .call_sync(
                            Some("org.freedesktop.DBus"),
                            "/org/freedesktop/DBus",
                            "org.freedesktop.DBus",
                            "NameHasOwner",
                            Some(&parameters),
                            None,
                            gtk::gio::DBusCallFlags::NONE,
                            1_000,
                            None::<&gtk::gio::Cancellable>,
                        )
                        .ok()
                        .and_then(|reply| reply.get::<(bool,)>())
                        .is_some_and(|(has_owner,)| has_owner);
                    if !has_owner {
                        let _ = setup_sender.send(false);
                        return;
                    }
                    connection.signal_subscribe(
                        Some("org.kde.keyboard"),
                        Some("org.kde.KeyboardLayouts"),
                        Some("layoutChanged"),
                        Some("/Layouts"),
                        None,
                        gtk::gio::DBusSignalFlags::NONE,
                        move |_, _, _, _, _, _| callback(),
                    );
                    let _ = setup_sender.send(true);
                    loop {
                        context.iteration(true);
                    }
                });
                if result.is_err() {
                    let _ = ready_sender.send(false);
                }
            });
        if thread.is_err() {
            return false;
        }
        ready_receiver
            .recv_timeout(std::time::Duration::from_secs(2))
            .unwrap_or(false)
    }

    fn active_layout_index() -> Option<usize> {
        let desktop = std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_ascii_lowercase();
        let desktop_index =
            if desktop.contains("kde") || std::env::var_os("KDE_SESSION_VERSION").is_some() {
                kde_active_layout_index()
            } else if desktop.contains("gnome") {
                gnome_active_layout_index()
            } else {
                None
            };
        desktop_index.or_else(x11_active_layout_index)
    }

    fn kde_active_layout_index() -> Option<usize> {
        for program in ["qdbus6", "qdbus"] {
            let Ok(output) = Command::new(program)
                .args([
                    "org.kde.keyboard",
                    "/Layouts",
                    "org.kde.KeyboardLayouts.getLayout",
                ])
                .output()
            else {
                continue;
            };
            if output.status.success() {
                if let Some(index) = parse_layout_index(&String::from_utf8_lossy(&output.stdout)) {
                    return Some(index);
                }
            }
        }
        None
    }

    fn gnome_active_layout_index() -> Option<usize> {
        let current = Command::new("gsettings")
            .args(["get", "org.gnome.desktop.input-sources", "current"])
            .output()
            .ok()?;
        if !current.status.success() {
            return None;
        }
        let current = parse_layout_index(&String::from_utf8_lossy(&current.stdout))?;
        let sources = Command::new("gsettings")
            .args(["get", "org.gnome.desktop.input-sources", "sources"])
            .output()
            .ok()?;
        if !sources.status.success() {
            return None;
        }
        let sources = parse_sources(&String::from_utf8_lossy(&sources.stdout));
        gnome_xkb_index(&sources, current)
    }

    fn gnome_xkb_index(sources: &[(String, String)], current: usize) -> Option<usize> {
        let mut xkb_index = 0;
        for (index, (kind, _)) in sources.iter().enumerate() {
            if index == current {
                return (kind == "xkb").then_some(xkb_index);
            }
            if kind == "xkb" {
                xkb_index += 1;
            }
        }
        None
    }

    fn parse_layout_index(value: &str) -> Option<usize> {
        value
            .split_whitespace()
            .last()?
            .trim_matches(|character: char| !character.is_ascii_digit())
            .parse()
            .ok()
    }

    fn x11_active_layout_index() -> Option<usize> {
        let display = unsafe { xlib::XOpenDisplay(std::ptr::null()) };
        if display.is_null() {
            return None;
        }

        let mut state = std::mem::MaybeUninit::<xlib::XkbStateRec>::uninit();
        let status =
            unsafe { xlib::XkbGetState(display, XKB_USE_CORE_KEYBOARD, state.as_mut_ptr()) };
        let active_group = if status == 0 {
            Some(unsafe { state.assume_init() }.group as usize)
        } else {
            None
        };
        unsafe {
            xlib::XCloseDisplay(display);
        }
        active_group
    }

    fn detect_from_gdk(active_layout: Option<usize>) -> Option<NativeLayout> {
        static GTK_INITIALIZED: LazyLock<bool> = LazyLock::new(|| gtk::init().is_ok());
        if !*GTK_INITIALIZED {
            return None;
        }

        let display = gtk::gdk::Display::default()?;
        display.sync();
        let context = gtk::glib::MainContext::default();
        while context.pending() {
            context.iteration(false);
        }
        let keymap = gtk::gdk::Keymap::for_display(&display)?;
        let names = current_keymap().map(|keymap| {
            (0..keymap.num_layouts())
                .map(|index| keymap.layout_get_name(index).to_owned())
                .collect::<Vec<_>>()
        });
        let mut layouts = BTreeMap::<i32, BTreeMap<String, String>>::new();
        let mut layout_order = Vec::new();

        for &dom_code in super::WRITING_SYSTEM_KEYS {
            for (entry, keyval) in keymap.entries_for_keycode(dom_code.xkb_keycode) {
                if entry.level() != 0 || entry.group() < 0 {
                    continue;
                }
                let Some(value) = gdk_value(keyval).and_then(value_to_string) else {
                    continue;
                };
                let group = entry.group();
                let layout = layouts.entry(group).or_insert_with(|| {
                    layout_order.push(group);
                    BTreeMap::new()
                });
                layout.insert(dom_code.code.to_owned(), value);
            }
        }

        if let Some(group) = active_layout.and_then(|index| i32::try_from(index).ok()) {
            if layouts.get(&group).is_some_and(|data| !data.is_empty()) {
                let data = layouts.remove(&group)?;
                return Some(NativeLayout {
                    name: names
                        .as_ref()
                        .and_then(|names| names.get(group as usize))
                        .cloned(),
                    data,
                });
            }
        }

        let mut first_layout = None;
        for group in layout_order {
            let Some(data) = layouts.remove(&group) else {
                continue;
            };
            let candidate = NativeLayout {
                name: names
                    .as_ref()
                    .and_then(|names| names.get(group as usize))
                    .cloned(),
                data,
            };
            if is_ascii_capable(&candidate.data) {
                return Some(candidate);
            }
            if first_layout.is_none() {
                first_layout = Some(candidate);
            }
        }
        first_layout
    }

    fn gdk_value(keyval: u32) -> Option<KeyValue> {
        match keyval {
            0xfe50 => Some(KeyValue::Unicode(0x0300)),
            0xfe51 => Some(KeyValue::Unicode(0x0301)),
            0xfe52 => Some(KeyValue::Unicode(0x0302)),
            0xfe53 => Some(KeyValue::Unicode(0x0303)),
            0xfe57 => Some(KeyValue::Unicode(0x0308)),
            0xff2a => Some(KeyValue::ZenkakuHankaku),
            _ => gtk::gdk::keys::Key::from(keyval)
                .to_unicode()
                .map(|character| KeyValue::Unicode(character as u32)),
        }
    }

    fn current_keymap() -> Option<Keymap> {
        let context = Context::new(xkb::CONTEXT_NO_FLAGS);
        if let Some(text) = current_server_keymap() {
            if let Some(keymap) = Keymap::new_from_string(
                &context,
                text,
                xkb::KEYMAP_FORMAT_TEXT_V1,
                xkb::KEYMAP_COMPILE_NO_FLAGS,
            ) {
                return Some(keymap);
            }
        }
        if let Some((layout, variant)) = gnome_layout_names() {
            if let Some(keymap) = compile_keymap(&context, &layout, &variant, "pc105", None) {
                return Some(keymap);
            }
        }
        let (model, layout, variant, options) = setxkbmap_names()?;
        compile_keymap(&context, &layout, &variant, &model, options)
    }

    fn current_server_keymap() -> Option<String> {
        let display = std::env::var("DISPLAY").ok()?;
        let output = Command::new("xkbcomp")
            .args(["-xkb", &display, "-"])
            .output()
            .ok()?;
        output
            .status
            .success()
            .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
    }

    fn compile_keymap(
        context: &Context,
        layout: &str,
        variant: &str,
        model: &str,
        options: Option<String>,
    ) -> Option<Keymap> {
        let rules = "evdev".to_owned();
        let model = model.to_owned();
        let layout = layout.to_owned();
        let variant = variant.to_owned();
        Keymap::new_from_names(
            context,
            &rules,
            &model,
            &layout,
            &variant,
            options,
            xkb::KEYMAP_COMPILE_NO_FLAGS,
        )
    }

    fn gnome_layout_names() -> Option<(String, String)> {
        let output = Command::new("gsettings")
            .args(["get", "org.gnome.desktop.input-sources", "sources"])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let sources = String::from_utf8_lossy(&output.stdout);
        let mut layouts = Vec::new();
        let mut variants = Vec::new();
        for (kind, id) in parse_sources(&sources) {
            if kind != "xkb" {
                continue;
            }
            let (layout, variant) = parse_layout_id(&id);
            layouts.push(layout);
            variants.push(variant);
        }
        (!layouts.is_empty()).then(|| (layouts.join(","), variants.join(",")))
    }

    fn parse_sources(value: &str) -> Vec<(String, String)> {
        let mut values = Vec::new();
        let mut characters = value.chars();
        while let Some(quote) = characters.next() {
            if quote != '\'' && quote != '"' {
                continue;
            }
            let mut value = String::new();
            while let Some(character) = characters.next() {
                if character == quote {
                    break;
                }
                if character == '\\' {
                    if let Some(escaped) = characters.next() {
                        value.push(escaped);
                    }
                } else {
                    value.push(character);
                }
            }
            values.push(value);
        }
        values
            .chunks_exact(2)
            .map(|tuple| (tuple[0].clone(), tuple[1].clone()))
            .collect()
    }

    fn parse_layout_id(id: &str) -> (String, String) {
        if let Some((layout, variant)) = id.split_once('+') {
            return (layout.to_owned(), variant.to_owned());
        }
        if let Some((layout, variant)) = id.split_once('(') {
            return (layout.to_owned(), variant.trim_end_matches(')').to_owned());
        }
        (id.to_owned(), String::new())
    }

    fn setxkbmap_names() -> Option<(String, String, String, Option<String>)> {
        let output = Command::new("setxkbmap").arg("-query").output().ok()?;
        if !output.status.success() {
            return None;
        }
        let mut model = "pc105".to_owned();
        let mut layout = None;
        let mut variant = String::new();
        let mut options = None;
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            let Some((key, value)) = line.split_once(':') else {
                continue;
            };
            match key.trim() {
                "model" if !value.trim().is_empty() => model = value.trim().to_owned(),
                "layout" => layout = Some(value.trim().to_owned()),
                "variant" => variant = value.trim().to_owned(),
                "options" if !value.trim().is_empty() => options = Some(value.trim().to_owned()),
                _ => {}
            }
        }
        Some((model, layout?, variant, options))
    }

    fn map_keymap(keymap: &Keymap, active_layout: Option<usize>) -> Option<NativeLayout> {
        let layout_count = keymap.num_layouts() as usize;
        generate_layouts_with_active(
            layout_count,
            active_layout,
            |index| Some(keymap.layout_get_name(index as u32).to_owned()),
            |index, dom_code| lookup(keymap, index as u32, dom_code),
        )
    }

    fn lookup(keymap: &Keymap, layout: u32, dom_code: DomCode) -> Option<KeyValue> {
        let keysym = *keymap
            .key_get_syms_by_level(dom_code.xkb_keycode.into(), layout, 0)
            .first()?;
        if keysym == Keysym::Zenkaku_Hankaku {
            return Some(KeyValue::ZenkakuHankaku);
        }
        let dead_combining = match keysym {
            Keysym::dead_grave => Some(0x0300),
            Keysym::dead_acute => Some(0x0301),
            Keysym::dead_circumflex => Some(0x0302),
            Keysym::dead_tilde => Some(0x0303),
            Keysym::dead_diaeresis => Some(0x0308),
            _ => None,
        };
        dead_combining.map(KeyValue::Unicode).or_else(|| {
            let unicode = xkb::keysym_to_utf32(keysym);
            (unicode != 0).then_some(KeyValue::Unicode(unicode))
        })
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn reads_real_unicode_values_from_a_german_xkb_keymap() {
            let context = Context::new(xkb::CONTEXT_NO_FLAGS);
            let keymap = compile_keymap(&context, "de", "", "pc105", None).unwrap();
            let layout = map_keymap(&keymap, None).unwrap();

            assert_eq!(layout.data.get("KeyA").map(String::as_str), Some("a"));
            assert_eq!(layout.data.get("KeyY").map(String::as_str), Some("z"));
            assert_eq!(layout.data.get("KeyZ").map(String::as_str), Some("y"));
            assert_eq!(layout.data.get("Backquote").map(String::as_str), Some("^"));
        }

        #[test]
        fn maps_the_active_layout_in_a_multi_layout_keymap() {
            let context = Context::new(xkb::CONTEXT_NO_FLAGS);
            let keymap = compile_keymap(&context, "us,de", ",", "pc105", None).unwrap();
            let layout = map_keymap(&keymap, Some(1)).unwrap();

            assert_eq!(layout.name.as_deref(), Some("German"));
            assert_eq!(layout.data.get("KeyY").map(String::as_str), Some("z"));
            assert_eq!(layout.data.get("KeyZ").map(String::as_str), Some("y"));
        }

        #[test]
        fn maps_gnome_active_source_to_xkb_group() {
            let sources = vec![
                ("xkb".to_owned(), "us".to_owned()),
                ("ibus".to_owned(), "Japanese".to_owned()),
                ("xkb".to_owned(), "de".to_owned()),
            ];
            assert_eq!(gnome_xkb_index(&sources, 2), Some(1));
            assert_eq!(gnome_xkb_index(&sources, 1), None);
        }
        #[test]
        fn parses_gnome_input_source_variants_without_losing_order() {
            let source = "@a(ss) [('xkb', 'us'), ('ibus', 'Japanese'), ('xkb', 'de(nodeadkeys)')]";
            assert_eq!(
                parse_sources(source),
                vec![
                    ("xkb".into(), "us".into()),
                    ("ibus".into(), "Japanese".into()),
                    ("xkb".into(), "de(nodeadkeys)".into())
                ]
            );
            assert_eq!(
                parse_layout_id("de(nodeadkeys)"),
                ("de".into(), "nodeadkeys".into())
            );
        }
    }
}

#[cfg(target_os = "windows")]
mod windows {
    use super::{DomCode, KeyValue, NativeLayout, generate_layouts};
    use std::ffi::c_void;

    const MAPVK_VSC_TO_VK_EX: u32 = 3;

    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetKeyboardLayoutList(buffer_count: i32, layouts: *mut isize) -> i32;
        fn GetKeyboardLayout(thread_id: u32) -> isize;
        fn GetForegroundWindow() -> *mut c_void;
        fn GetWindowThreadProcessId(window: *mut c_void, process_id: *mut u32) -> u32;
        fn MapVirtualKeyExW(code: u32, map_type: u32, layout: isize) -> u32;
        fn ToUnicodeEx(
            virtual_key: u32,
            scan_code: u32,
            keyboard_state: *const u8,
            buffer: *mut u16,
            buffer_length: i32,
            flags: u32,
            layout: isize,
        ) -> i32;
    }

    pub(super) fn detect() -> Option<NativeLayout> {
        let count = unsafe { GetKeyboardLayoutList(0, std::ptr::null_mut()) };
        if count <= 0 || count > 128 {
            return None;
        }
        let mut layouts = vec![0_isize; count as usize];
        let count = unsafe { GetKeyboardLayoutList(count, layouts.as_mut_ptr()) };
        if count <= 0 {
            return None;
        }
        layouts.truncate(count as usize);

        let window = unsafe { GetForegroundWindow() };
        let thread_id = if window.is_null() {
            0
        } else {
            unsafe { GetWindowThreadProcessId(window, std::ptr::null_mut()) }
        };
        let active_layout = unsafe { GetKeyboardLayout(thread_id) };
        if let Some(index) = layouts.iter().position(|layout| *layout == active_layout) {
            layouts.swap(0, index);
        }

        generate_layouts(
            layouts.len(),
            |_| None,
            |index, dom_code| translate(layouts[index], dom_code),
        )
    }

    fn translate(layout: isize, dom_code: DomCode) -> Option<KeyValue> {
        let scan_code = dom_code.windows_scancode;
        let virtual_key = unsafe { MapVirtualKeyExW(scan_code, MAPVK_VSC_TO_VK_EX, layout) };
        if virtual_key == 0 {
            return None;
        }
        let keyboard_state = [0_u8; 256];
        let mut buffer = [0_u16; 1];
        let key_type = unsafe {
            ToUnicodeEx(
                virtual_key,
                scan_code,
                keyboard_state.as_ptr(),
                buffer.as_mut_ptr(),
                buffer.len() as i32,
                0,
                layout,
            )
        };

        let hkl = layout as usize;
        if hkl == 0x0411_0411 {
            if dom_code.code == "IntlYen" {
                return Some(KeyValue::Unicode(0x00a5));
            }
            if dom_code.code == "Backquote" {
                return Some(KeyValue::ZenkakuHankaku);
            }
        }
        if hkl == 0x0412_0412 && dom_code.code == "IntlBackslash" {
            return Some(KeyValue::Unicode(0x20a9));
        }

        match key_type {
            1 => Some(KeyValue::Unicode(buffer[0] as u32)),
            -1 => {
                let mut clear_buffer = [0_u16; 1];
                unsafe {
                    ToUnicodeEx(
                        0x20,
                        0x39,
                        keyboard_state.as_ptr(),
                        clear_buffer.as_mut_ptr(),
                        clear_buffer.len() as i32,
                        0,
                        layout,
                    );
                }
                Some(KeyValue::Unicode(buffer[0] as u32))
            }
            _ => None,
        }
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::{DomCode, KeyValue, NativeLayout, generate_layouts};
    use std::ffi::{c_char, c_void};
    use std::sync::Mutex;

    type CfTypeRef = *const c_void;
    type CfIndex = isize;

    const UC_KEY_ACTION_DISPLAY: u16 = 3;
    const UC_KEY_TRANSLATE_NO_DEAD_KEYS: u32 = 1 << 3;
    const UTF8_ENCODING: u32 = 0x0800_0100;

    #[link(name = "Carbon", kind = "framework")]
    unsafe extern "C" {
        fn TISCopyCurrentASCIICapableKeyboardLayoutInputSource() -> CfTypeRef;
        fn TISGetInputSourceProperty(source: CfTypeRef, property: CfTypeRef) -> CfTypeRef;
        fn UCKeyTranslate(
            layout: CfTypeRef,
            key_code: u16,
            key_action: u16,
            modifier_key_state: u32,
            keyboard_type: u32,
            options: u32,
            dead_key_state: *mut u32,
            max_string_length: u32,
            actual_string_length: *mut u32,
            unicode_string: *mut u16,
        ) -> i32;
        fn LMGetKbdType() -> u8;
        static kTISPropertyUnicodeKeyLayoutData: CfTypeRef;
        static kTISPropertyLocalizedName: CfTypeRef;
        static kTISNotifySelectedKeyboardInputSourceChanged: CfTypeRef;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    unsafe extern "C" {
        fn CFDataGetBytePtr(data: CfTypeRef) -> *const u8;
        fn CFDataGetLength(data: CfTypeRef) -> CfIndex;
        fn CFStringGetCString(
            value: CfTypeRef,
            buffer: *mut c_char,
            size: CfIndex,
            encoding: u32,
        ) -> u8;
        fn CFRelease(value: CfTypeRef);
        fn CFNotificationCenterGetDistributedCenter() -> CfTypeRef;
        fn CFNotificationCenterAddObserver(
            center: CfTypeRef,
            observer: *const c_void,
            callout: Option<
                unsafe extern "C" fn(CfTypeRef, *mut c_void, CfTypeRef, CfTypeRef, CfTypeRef),
            >,
            name: CfTypeRef,
            object: CfTypeRef,
            suspension_behavior: i32,
        );
        fn CFRunLoopRun();
    }

    pub(super) fn detect() -> Option<NativeLayout> {
        let source = unsafe { TISCopyCurrentASCIICapableKeyboardLayoutInputSource() };
        if source.is_null() {
            return None;
        }
        let key_layout =
            unsafe { TISGetInputSourceProperty(source, kTISPropertyUnicodeKeyLayoutData) };
        let bytes = if key_layout.is_null() || unsafe { CFDataGetLength(key_layout) } <= 0 {
            std::ptr::null()
        } else {
            unsafe { CFDataGetBytePtr(key_layout) }
        };
        let name = string_property(source, unsafe { kTISPropertyLocalizedName });
        let data = if bytes.is_null() {
            None
        } else {
            generate_layouts(
                1,
                |_| name.clone(),
                |_, dom_code| translate(bytes.cast(), dom_code),
            )
        };
        unsafe { CFRelease(source) };
        data
    }

    pub(super) fn start_event_listener(callback: Box<dyn Fn() + Send + 'static>) -> bool {
        use std::sync::mpsc;

        let (ready_sender, ready_receiver) = mpsc::sync_channel(1);
        let thread = std::thread::Builder::new()
            .name("webkeyboard-layout-events".to_owned())
            .spawn(move || {
                let center = unsafe { CFNotificationCenterGetDistributedCenter() };
                if center.is_null() {
                    let _ = ready_sender.send(false);
                    return;
                }
                let callback_state = Box::new(Mutex::new(callback));
                let observer =
                    (&*callback_state as *const Mutex<Box<dyn Fn() + Send>>) as *const c_void;
                unsafe {
                    CFNotificationCenterAddObserver(
                        center,
                        observer,
                        Some(selected_input_source_changed),
                        kTISNotifySelectedKeyboardInputSourceChanged,
                        std::ptr::null(),
                        4,
                    );
                }
                let _ = ready_sender.send(true);
                unsafe { CFRunLoopRun() };
            });
        if thread.is_err() {
            return false;
        }
        ready_receiver
            .recv_timeout(std::time::Duration::from_secs(2))
            .unwrap_or(false)
    }

    unsafe extern "C" fn selected_input_source_changed(
        _center: CfTypeRef,
        observer: *mut c_void,
        _name: CfTypeRef,
        _object: CfTypeRef,
        _user_info: CfTypeRef,
    ) {
        let callback = unsafe { &*(observer as *const Mutex<Box<dyn Fn() + Send>>) };
        if let Ok(callback) = callback.lock() {
            callback();
        }
    }

    fn string_property(source: CfTypeRef, property: CfTypeRef) -> Option<String> {
        let value = unsafe { TISGetInputSourceProperty(source, property) };
        if value.is_null() {
            return None;
        }
        let mut buffer = [0_u8; 256];
        if unsafe {
            CFStringGetCString(
                value,
                buffer.as_mut_ptr().cast(),
                buffer.len() as CfIndex,
                UTF8_ENCODING,
            )
        } == 0
        {
            return None;
        }
        let end = buffer.iter().position(|byte| *byte == 0)?;
        std::str::from_utf8(&buffer[..end]).ok().map(str::to_owned)
    }

    fn translate(layout: CfTypeRef, dom_code: DomCode) -> Option<KeyValue> {
        if dom_code.mac_keycode == u16::MAX {
            return None;
        }
        let mut dead_key_state = 0_u32;
        let mut actual_length = 0_u32;
        let mut buffer = [0_u16; 4];
        let status = unsafe {
            UCKeyTranslate(
                layout,
                dom_code.mac_keycode,
                UC_KEY_ACTION_DISPLAY,
                0,
                LMGetKbdType() as u32,
                UC_KEY_TRANSLATE_NO_DEAD_KEYS,
                &mut dead_key_state,
                buffer.len() as u32,
                &mut actual_length,
                buffer.as_mut_ptr(),
            )
        };
        if status != 0 || actual_length == 0 || buffer[0] == 0 {
            return None;
        }
        Some(KeyValue::Unicode(buffer[0] as u32))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uses_chromium_dead_key_and_hankaku_representations() {
        assert_eq!(
            value_to_string(KeyValue::Unicode(0x0302)).as_deref(),
            Some("^")
        );
        assert_eq!(
            value_to_string(KeyValue::Unicode(0x0308)).as_deref(),
            Some("¨")
        );
        assert_eq!(value_to_string(KeyValue::Unicode(0x0304)), None);
        assert_eq!(
            value_to_string(KeyValue::ZenkakuHankaku).as_deref(),
            Some("半角/全角")
        );
    }

    #[test]
    fn publishes_only_writing_system_codes() {
        let map = generate_layouts(
            1,
            |_| Some("test".to_owned()),
            |_, dom_code| match dom_code.code {
                "KeyA" => Some(KeyValue::Unicode('a' as u32)),
                "KeyY" => Some(KeyValue::Unicode('z' as u32)),
                _ => None,
            },
        )
        .unwrap();
        assert_eq!(map.name.as_deref(), Some("test"));
        assert_eq!(map.data.len(), 2);
        assert_eq!(map.data.get("KeyY").map(String::as_str), Some("z"));
    }
    #[test]
    fn prefers_french_ascii_layout_before_later_us_layout() {
        let layout = generate_layouts(
            2,
            |index| Some(if index == 0 { "French" } else { "English (US)" }.to_owned()),
            |index, dom_code| {
                if dom_code.code != "KeyA" {
                    return None;
                }
                let character = if index == 0 { 'q' } else { 'a' };
                Some(KeyValue::Unicode(character as u32))
            },
        )
        .unwrap();

        assert_eq!(layout.name.as_deref(), Some("French"));
        assert_eq!(layout.data.get("KeyA").map(String::as_str), Some("q"));
    }
}
