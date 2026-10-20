#!/bin/sh
set -eu

native_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
cargo build --release --manifest-path "$native_dir/Cargo.toml"

case "$(uname -s)" in
  Linux*)
    install_dir="$HOME/.local/lib/webkeyboard"
    manifest_dir="$HOME/.mozilla/native-messaging-hosts"
    ;;
  Darwin*)
    install_dir="$HOME/Library/Application Support/WebKeyboard"
    manifest_dir="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
    ;;
  *)
    printf '%s\n' "Unsupported OS: $(uname -s)" >&2
    exit 1
    ;;
esac

mkdir -p "$install_dir" "$manifest_dir"
host_path="$install_dir/webkeyboard-native-host"
manifest_path="$manifest_dir/com.openpolyfill.webkeyboard.json"
install -m 755 "$native_dir/target/release/webkeyboard-native-host" "$host_path"
"$host_path" --print-manifest > "$manifest_path.tmp"
mv "$manifest_path.tmp" "$manifest_path"
printf 'Installed WebKeyboard native host. Restart Firefox to use it.\n'
