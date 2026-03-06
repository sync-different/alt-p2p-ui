# alt-p2p-ui

Desktop GUI for [alt-p2p](https://github.com/sync-different/alt-p2p), an encrypted peer-to-peer file transfer system. Built with Tauri v2, React, and TypeScript.

The app bundles a custom Java runtime (via jlink) and the alt-p2p fat JAR, so end users don't need Java installed.

<img width="873" height="921" alt="alt-p2p-ui-screenshot3" src="https://github.com/user-attachments/assets/5ff1cd1f-ef90-4c0e-be95-e4c03ff2a88c" />

## Prerequisites (development only)

- **Node.js** 18+
- **Rust** (latest stable, via [rustup](https://rustup.rs))
- **JDK** 17+ (for building the custom JRE and running in dev mode)
- **Maven** 3.9+ (for building the alt-p2p JAR)
- **alt-p2p** cloned at `../alt-p2p/`
- **Windows only:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **"Desktop development with C++"** workload (provides `link.exe` for compiling the Rust sidecar). Set `JAVA_HOME` environment variable to your JDK installation.

End users need nothing — the installer is fully self-contained.

## Development

```bash
npm install
npm run tauri dev
```

This starts the Vite dev server and opens the Tauri window with hot reload. In dev mode, the app uses your system Java installation (the bundled JRE is only included in release builds).

**Windows note:** You must build the sidecar `.exe` once before dev mode works:
```powershell
npm run build:sidecar
npm run tauri dev
```

## Build

### macOS

```bash
# 1. Build the alt-p2p fat JAR
cd ../alt-p2p && mvn package -q

# 2. Build a minimal custom JRE (jlink)
cd ../alt-p2p-ui && bash scripts/build-jre.sh

# 3. Build the Tauri app
npm run tauri build
```

Produces:
- `src-tauri/target/release/bundle/macos/alt-p2p.app` (44MB)
- `src-tauri/target/release/bundle/dmg/alt-p2p_0.1.0_aarch64.dmg` (28MB)

### Windows

```powershell
# 1. Build the alt-p2p fat JAR
cd ..\alt-p2p; mvn package -q; cd ..\alt-p2p-ui

# 2. Compile the sidecar .exe
npm run build:sidecar

# 3. Build a minimal custom JRE (jlink)
npm run build:jre

# 4. Build the Tauri app
npm run tauri build
```

Produces:
- `src-tauri/target/release/bundle/nsis/alt-p2p_0.1.0_x64-setup.exe` (NSIS installer, ~45MB)
- `src-tauri/target/release/bundle/msi/alt-p2p_0.1.0_x64_en-US.msi` (MSI installer)

### What's in the macOS `.app` bundle

```
alt-p2p.app/Contents/
  MacOS/
    alt-p2p-ui          # Tauri binary
    run-java            # Sidecar script (runs bundled JRE)
  Resources/
    alt-p2p.jar         # Fat JAR (10MB)
    jre/                # Custom JRE via jlink (29MB)
      bin/java
      lib/
      ...
```

### What's in the Windows installer

```
<install_dir>/
  alt-p2p.exe                              # Tauri binary
  run-java-x86_64-pc-windows-msvc.exe     # Sidecar (runs bundled JRE)
  alt-p2p.jar                              # Fat JAR (10MB)
  jre/                                     # Custom JRE via jlink (~30MB)
    bin/java.exe
    lib/
    ...
```

### Custom JRE (jlink)

The JRE build scripts (`scripts/build-jre.sh` for macOS, `scripts/build-jre.ps1` for Windows) use `jdeps` to detect which JDK modules the fat JAR needs, then `jlink` to build a stripped runtime containing only those modules. This produces a ~29MB JRE instead of a 305MB full JDK.

BouncyCastle (used for DTLS encryption) is not a modular JAR, so we can't use jlink to create a fully modular app image. Instead, we use jlink solely to build a minimal JRE, and the fat JAR runs on the classpath as before.

Required modules: `java.base`, `java.naming`, `java.sql`, `jdk.crypto.ec`

## Deploying

### macOS

1. Copy the `.app` or `.dmg` to the target machine
2. Bypass Gatekeeper (unsigned app): `xattr -rd com.apple.quarantine /path/to/alt-p2p.app`

### Windows

1. Run the NSIS installer (`.exe`) or MSI installer
2. The app installs to `%LOCALAPPDATA%\alt-p2p\`

No Java installation needed on either platform — the custom JRE is bundled.

## Usage

1. Start the **coordination server** on a reachable host:
   ```bash
   java -jar alt-p2p-0.2.0-SNAPSHOT.jar server --psk <shared-secret>
   ```
2. On the **sender** Mac: open the app, select the Send tab, fill in the session ID, pre-shared key, and server address (`host:9000`), pick a file, and click Send.
3. On the **receiver** Mac: open the app, select the Receive tab, fill in the same session ID, PSK, and server address, pick an output directory, and click Receive.

Both peers will connect through the coordination server, punch through NATs, establish a DTLS-encrypted channel, and transfer the file with live progress.

## Project Structure

```
scripts/
  build-jre.sh              # jdeps + jlink automation for custom JRE (macOS/Linux)
  build-jre.ps1             # jdeps + jlink automation for custom JRE (Windows)
  copy-sidecar.mjs          # Copies compiled sidecar to binaries/ with platform triple

src/
  App.tsx                   # Root component with Send/Receive tabs
  main.tsx                  # React entry point
  components/
    SendView.tsx            # Send tab: file picker + session config + transfer
    ReceiveView.tsx         # Receive tab: directory picker + session config + transfer
    SessionConfig.tsx       # Session ID, PSK, server address inputs
    ConnectionStatus.tsx    # Connection progress stepper
    TransferProgress.tsx    # Progress bar, speed, ETA display
  hooks/
    useTransfer.ts          # Core transfer hook: spawns JAR, parses JSON events
  lib/
    jar.ts                  # JAR path resolution + sidecar command builder
  types/
    ipc.ts                  # TypeScript types for NDJSON IPC protocol

src-tauri/
  src/lib.rs                # Tauri app entry point
  tauri.conf.json           # App config, resource bundling, sidecar config
  capabilities/default.json # Shell spawn permissions
  sidecar/                  # Rust crate for compiled sidecar (Windows)
    Cargo.toml
    src/main.rs             # Finds Java, forwards args, inherits stdio
  binaries/
    run-java-aarch64-apple-darwin          # macOS sidecar (bash script)
    run-java-x86_64-pc-windows-msvc.exe   # Windows sidecar (compiled, gitignored)
  scripts/
    run-java.sh             # Source script for the macOS sidecar
  resources/
    jre/                    # Custom JRE output (gitignored, platform-specific)
```

## Tech Stack

- **Tauri v2** &mdash; native app shell, resource bundling, sidecar management
- **React 19** &mdash; UI components
- **Tailwind CSS v4** &mdash; styling
- **TypeScript** &mdash; type safety
- **jlink** &mdash; custom minimal JRE (29MB, no JDK needed on target)
- **alt-p2p JAR** &mdash; P2P engine (spawned as a child process with `--json` for IPC)

## Future Work

- **Linux support** &mdash; Same approach as Windows: platform-specific sidecar and jlink JRE. Tauri produces `.deb`/`.AppImage` on Linux.
- **CI/CD** &mdash; GitHub Actions workflow for cross-platform builds (macOS, Windows, Linux) with automated jlink JRE creation per platform.
- **Code signing** &mdash; macOS notarization and Windows Authenticode signing for distribution without Gatekeeper/SmartScreen warnings.
- **Auto-update** &mdash; Tauri v2's built-in updater for seamless version upgrades.
- **Embedded coordination server** &mdash; Option to run the coord server within the app itself, eliminating the need for a separate server process.
