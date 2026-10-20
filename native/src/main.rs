mod layout;

use serde_json::{Value, json};
use std::env;
use std::io::{self, Read, Write};
use std::process;
use std::sync::mpsc;
use std::thread;

const MAX_MESSAGE_SIZE: usize = 1024 * 1024;
const HOST_NAME: &str = "com.openpolyfill.webkeyboard";
const EXTENSION_ID: &str = "@webkeyboard.openpolyfill";

fn main() {
    if env::args_os()
        .nth(1)
        .is_some_and(|arg| arg == "--print-manifest")
    {
        if let Err(error) = print_manifest() {
            eprintln!("Unable to print native messaging manifest: {error}");
            process::exit(1);
        }
        return;
    }

    if let Err(error) = serve_with_listener(
        io::stdin(),
        io::stdout(),
        layout::detect_system_layout,
        layout::start_system_layout_listener,
    ) {
        eprintln!("WebKeyboard native host stopped: {error}");
        process::exit(1);
    }
}

fn print_manifest() -> io::Result<()> {
    let path = env::current_exe()?.to_string_lossy().into_owned();
    let manifest = json!({
        "name": HOST_NAME,
        "description": "Provides system keyboard layout maps and change events for WebKeyboard",
        "path": path,
        "type": "stdio",
        "allowed_extensions": [EXTENSION_ID],
    });
    println!("{manifest}");
    Ok(())
}

enum HostEvent {
    Request(Value),
    LayoutChanged,
    InputClosed,
    InputError(io::Error),
}

type LayoutChangeCallback = Box<dyn Fn() + Send + 'static>;

#[cfg(test)]
fn serve<R, W, F>(input: R, output: W, detect_layout: F) -> io::Result<()>
where
    R: Read + Send + 'static,
    W: Write,
    F: FnMut() -> Option<layout::NativeLayout>,
{
    serve_with_listener(input, output, detect_layout, |_| false)
}

fn serve_with_listener<R, W, F, S>(
    input: R,
    mut output: W,
    mut detect_layout: F,
    mut start_listener: S,
) -> io::Result<()>
where
    R: Read + Send + 'static,
    W: Write,
    F: FnMut() -> Option<layout::NativeLayout>,
    S: FnMut(LayoutChangeCallback) -> bool,
{
    let (sender, receiver) = mpsc::channel();
    let input_sender = sender.clone();
    thread::Builder::new()
        .name("webkeyboard-native-input".to_owned())
        .spawn(move || read_requests(input, input_sender))?;

    let mut listener_started = false;
    loop {
        match receiver.recv() {
            Ok(HostEvent::Request(request)) => {
                let mut response = match request.get("action").and_then(Value::as_str) {
                    Some("getLayout") => layout_response(detect_layout()),
                    Some("watchLayoutChanges") => {
                        if !listener_started {
                            let event_sender = sender.clone();
                            listener_started = start_listener(Box::new(move || {
                                let _ = event_sender.send(HostEvent::LayoutChanged);
                            }));
                        }
                        let mut response = layout_response(detect_layout());
                        response["eventSupported"] = json!(listener_started);
                        response
                    }
                    _ => json!({ "error": "unsupported_action" }),
                };
                if let Some(id) = request.get("id") {
                    response["id"] = id.clone();
                }
                write_message(&mut output, response)?;
            }
            Ok(HostEvent::LayoutChanged) if listener_started => {
                write_layout_change(&mut output, &mut detect_layout)?;
            }
            Ok(HostEvent::InputClosed) => {
                for event in receiver.try_iter() {
                    if matches!(event, HostEvent::LayoutChanged) && listener_started {
                        write_layout_change(&mut output, &mut detect_layout)?;
                    }
                }
                return Ok(());
            }
            Ok(HostEvent::InputError(error)) => return Err(error),
            Ok(HostEvent::LayoutChanged) => {}
            Err(_) => return Ok(()),
        }
    }
}

fn read_requests<R: Read>(mut input: R, sender: mpsc::Sender<HostEvent>) {
    loop {
        let mut header = [0; 4];
        match input.read_exact(&mut header) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => {
                let _ = sender.send(HostEvent::InputClosed);
                return;
            }
            Err(error) => {
                let _ = sender.send(HostEvent::InputError(error));
                return;
            }
        }

        let message_size = u32::from_ne_bytes(header) as usize;
        if message_size > MAX_MESSAGE_SIZE {
            let _ = sender.send(HostEvent::InputError(io::Error::new(
                io::ErrorKind::InvalidData,
                "native messaging request exceeds 1 MiB",
            )));
            return;
        }

        let mut message = vec![0; message_size];
        if let Err(error) = input.read_exact(&mut message) {
            let _ = sender.send(HostEvent::InputError(error));
            return;
        }
        let request = match serde_json::from_slice(&message)
            .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
        {
            Ok(request) => request,
            Err(error) => {
                let _ = sender.send(HostEvent::InputError(error));
                return;
            }
        };
        if sender.send(HostEvent::Request(request)).is_err() {
            return;
        }
    }
}

fn layout_response(layout: Option<layout::NativeLayout>) -> Value {
    match layout {
        Some(layout) => json!({
            "layoutMap": layout.data,
            "layoutName": layout.name,
        }),
        None => json!({ "layoutMap": {}, "layoutName": null }),
    }
}

fn write_layout_change<W, F>(output: &mut W, detect_layout: &mut F) -> io::Result<()>
where
    W: Write,
    F: FnMut() -> Option<layout::NativeLayout>,
{
    if let Some(layout) = detect_layout() {
        write_message(
            output,
            json!({
                "type": "layoutchange",
                "layoutMap": layout.data,
                "layoutName": layout.name,
            }),
        )?;
    }
    Ok(())
}

fn write_message<W: Write>(output: &mut W, message: Value) -> io::Result<()> {
    let response = serde_json::to_vec(&message)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    if response.len() > MAX_MESSAGE_SIZE {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "native messaging response exceeds 1 MiB",
        ));
    }

    output.write_all(&(response.len() as u32).to_ne_bytes())?;
    output.write_all(&response)?;
    output.flush()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::io::Cursor;

    fn append_message(stream: &mut Vec<u8>, message: &Value) {
        let bytes = serde_json::to_vec(message).unwrap();
        stream.extend_from_slice(&(bytes.len() as u32).to_ne_bytes());
        stream.extend_from_slice(&bytes);
    }

    fn read_message(stream: &mut Cursor<Vec<u8>>) -> Value {
        let mut header = [0; 4];
        stream.read_exact(&mut header).unwrap();
        let mut body = vec![0; u32::from_ne_bytes(header) as usize];
        stream.read_exact(&mut body).unwrap();
        serde_json::from_slice(&body).unwrap()
    }

    fn sample_layout() -> layout::NativeLayout {
        layout::NativeLayout {
            name: Some("German".to_owned()),
            data: std::collections::BTreeMap::from([
                ("KeyA".to_owned(), "a".to_owned()),
                ("KeyY".to_owned(), "z".to_owned()),
            ]),
        }
    }

    #[test]
    fn serves_multiple_system_maps_with_framed_responses() {
        let mut requests = Vec::new();
        append_message(&mut requests, &json!({ "id": 17, "action": "getLayout" }));
        append_message(&mut requests, &json!({ "id": 18, "action": "getLayout" }));

        let mut responses = Vec::new();
        serve(Cursor::new(requests), &mut responses, || {
            Some(sample_layout())
        })
        .unwrap();

        let mut responses = Cursor::new(responses);
        let expected = json!({
            "layoutMap": { "KeyA": "a", "KeyY": "z" },
            "layoutName": "German",
        });
        let mut first = expected.clone();
        first["id"] = json!(17);
        assert_eq!(read_message(&mut responses), first);
        let mut second = expected;
        second["id"] = json!(18);
        assert_eq!(read_message(&mut responses), second);
        assert_eq!(responses.position(), responses.get_ref().len() as u64);
    }

    #[test]
    fn sends_unsolicited_layout_change_frames_from_the_listener() {
        let mut requests = Vec::new();
        append_message(
            &mut requests,
            &json!({ "id": 9, "action": "watchLayoutChanges" }),
        );

        let mut responses = Vec::new();
        serve_with_listener(
            Cursor::new(requests),
            &mut responses,
            || Some(sample_layout()),
            |callback| {
                callback();
                true
            },
        )
        .unwrap();

        let mut responses = Cursor::new(responses);
        assert_eq!(
            read_message(&mut responses),
            json!({
                "id": 9,
                "eventSupported": true,
                "layoutMap": { "KeyA": "a", "KeyY": "z" },
                "layoutName": "German",
            })
        );
        assert_eq!(
            read_message(&mut responses),
            json!({
                "type": "layoutchange",
                "layoutMap": { "KeyA": "a", "KeyY": "z" },
                "layoutName": "German",
            })
        );
    }

    #[test]
    fn rejects_oversized_messages_before_allocating_body() {
        let error = serve(
            Cursor::new(((MAX_MESSAGE_SIZE + 1) as u32).to_ne_bytes()),
            Vec::new(),
            || None,
        )
        .unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn unsupported_actions_keep_the_host_alive_and_unavailable_maps_are_empty() {
        let mut requests = Vec::new();
        append_message(&mut requests, &json!({ "id": 4, "action": "setLayout" }));
        append_message(&mut requests, &json!({ "id": 5, "action": "getLayout" }));

        let mut responses = Vec::new();
        serve(Cursor::new(requests), &mut responses, || None).unwrap();

        let mut responses = Cursor::new(responses);
        assert_eq!(
            read_message(&mut responses),
            json!({ "id": 4, "error": "unsupported_action" })
        );
        assert_eq!(
            read_message(&mut responses),
            json!({ "id": 5, "layoutMap": {}, "layoutName": null })
        );
    }
}
