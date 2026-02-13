# alt-p2p-ui

Desktop GUI for [alt-p2p](https://github.com/sync-different/alt-p2p), an encrypted peer-to-peer file transfer system. Built with Tauri v2, React, and TypeScript.

The app bundles a custom Java runtime (via jlink) and the alt-p2p fat JAR, so end users don't need Java installed.

## Prerequisites (development only)

- **Node.js** 18+
- **Rust** (latest stable, via [rustup](https://rustup.rs))
- **JDK** 17+ (for building the custom JRE and running in dev mode)
- **Maven** 3.9+ (for building the alt-p2p JAR)
- **alt-p2p** cloned at `../alt-p2p/`

End users need nothing — the `.app` bundle is fully self-contained.

## Development

```bash
npm install
npm run tauri dev
```

This starts the Vite dev server and opens the Tauri window with hot reload. In dev mode, the app uses your system Java installation (the bundled JRE is only included in release builds).

## Build

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

### What's in the `.app` bundle

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

### Custom JRE (jlink)

The `scripts/build-jre.sh` script uses `jdeps` to detect which JDK modules the fat JAR needs, then `jlink` to build a stripped runtime containing only those modules. This produces a 29MB JRE instead of a 305MB full JDK.

BouncyCastle (used for DTLS encryption) is not a modular JAR, so we can't use jlink to create a fully modular app image. Instead, we use jlink solely to build a minimal JRE, and the fat JAR runs on the classpath as before.

Required modules: `java.base`, `java.naming`, `java.sql`, `jdk.crypto.ec`

## Deploying to another Mac

1. Copy the `.app` or `.dmg` to the target machine
2. Bypass Gatekeeper (unsigned app): `xattr -rd com.apple.quarantine /path/to/alt-p2p.app`

No Java installation needed — the custom JRE is bundled inside the app.

## Usage

1. Start the **coordination server** on a reachable host:
   ```bash
   java -jar alt-p2p-0.1.0-SNAPSHOT.jar server --psk <shared-secret>
   ```
2. On the **sender** Mac: open the app, select the Send tab, fill in the session ID, pre-shared key, and server address (`host:9000`), pick a file, and click Send.
3. On the **receiver** Mac: open the app, select the Receive tab, fill in the same session ID, PSK, and server address, pick an output directory, and click Receive.

Both peers will connect through the coordination server, punch through NATs, establish a DTLS-encrypted channel, and transfer the file with live progress.

## Project Structure

```
scripts/
  build-jre.sh              # jdeps + jlink automation for custom JRE

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
  binaries/
    run-java-*              # Platform-specific sidecar (prefers bundled JRE)
  scripts/
    run-java.sh             # Source script for the sidecar
  resources/
    jre/                    # Custom JRE output (gitignored, built by build-jre.sh)
```

## Tech Stack

- **Tauri v2** &mdash; native app shell, resource bundling, sidecar management
- **React 19** &mdash; UI components
- **Tailwind CSS v4** &mdash; styling
- **TypeScript** &mdash; type safety
- **jlink** &mdash; custom minimal JRE (29MB, no JDK needed on target)
- **alt-p2p JAR** &mdash; P2P engine (spawned as a child process with `--json` for IPC)

## Future Work

- **Windows support** &mdash; Requires a `.cmd` sidecar (`run-java-x86_64-pc-windows-msvc.exe`), a Windows-specific jlink JRE, and building on a Windows machine (or GitHub Actions `windows-latest`). The Tauri app, React frontend, and fat JAR are already cross-platform.
- **Linux support** &mdash; Same approach as Windows: platform-specific sidecar and jlink JRE. Tauri produces `.deb`/`.AppImage` on Linux.
- **CI/CD** &mdash; GitHub Actions workflow for cross-platform builds (macOS, Windows, Linux) with automated jlink JRE creation per platform.
- **Code signing** &mdash; macOS notarization and Windows Authenticode signing for distribution without Gatekeeper/SmartScreen warnings.
- **Auto-update** &mdash; Tauri v2's built-in updater for seamless version upgrades.
- **Embedded coordination server** &mdash; Option to run the coord server within the app itself, eliminating the need for a separate server process.
