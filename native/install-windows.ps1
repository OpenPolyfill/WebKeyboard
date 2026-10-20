$ErrorActionPreference = "Stop"

$nativeDir = $PSScriptRoot
cargo build --release --manifest-path (Join-Path $nativeDir "Cargo.toml")
if ($LASTEXITCODE -ne 0) {
    throw "cargo build failed with exit code $LASTEXITCODE"
}

$installDir = Join-Path $env:LOCALAPPDATA "WebKeyboard"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
$hostPath = Join-Path $installDir "webkeyboard-native-host.exe"
Copy-Item -Force (Join-Path $nativeDir "target\release\webkeyboard-native-host.exe") $hostPath

$manifestPath = Join-Path $installDir "com.openpolyfill.webkeyboard.json"
$manifest = (& $hostPath --print-manifest | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Could not generate the native messaging manifest"
}
[System.IO.File]::WriteAllText($manifestPath, $manifest, [System.Text.UTF8Encoding]::new($false))

$registryPath = "HKCU\Software\Mozilla\NativeMessagingHosts\com.openpolyfill.webkeyboard"
reg.exe add $registryPath /ve /t REG_SZ /d $manifestPath /f | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Could not register the Firefox native messaging host"
}
Write-Output "Installed WebKeyboard native host. Restart Firefox to use it."
