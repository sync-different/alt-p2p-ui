# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

alt-p2p-ui is the desktop GUI for [alt-p2p](https://github.com/sync-different/alt-p2p), an encrypted peer-to-peer file transfer system. Built with Tauri v2, React 19, and TypeScript. Bundles a custom JRE (via jlink) so end users don't need Java installed.

The app spawns the alt-p2p Java CLI as a child process with `--json` for NDJSON IPC on stdout. All networking happens in the Java process — the UI only parses events and renders state.

## Build & Run

```bash
npm install              # Install frontend dependencies
npm run tauri dev        # Dev mode (hot reload, uses system Java)
npm run build            # Frontend only: tsc && vite build
```

### Windows first-time setup (required before `tauri dev`)

```powershell
npm run build:sidecar    # Compile sidecar .exe (once, unless src-tauri/sidecar/ changes)
```

### Release build (requires alt-p2p JAR + JDK 17+)

```powershell
# Windows:
cd ..\alt-p2p; mvn package -q; cd ..\alt-p2p-ui   # Build fat JAR
npm run build:sidecar    # Compile sidecar .exe
npm run build:jre        # Build custom JRE (jlink) — runs scripts/build-jre.ps1

# macOS:
cd ../alt-p2p && mvn package -q && cd ../alt-p2p-ui
bash scripts/build-jre.sh   # or: npm run build:jre:mac

# Then on either platform:
npm run tauri build
```

**Prerequisites:** Node.js 18+, Rust (stable; MSVC toolchain on Windows), JDK 17+, Maven 3.9+. Windows also needs VS Build Tools with "Desktop development with C++" workload. Set `JAVA_HOME` to your JDK path.

**No test runner or linter is configured.** TypeScript type checking: `npx tsc --noEmit`.

## Project Structure

```
scripts/
  build-jre.sh              # jdeps + jlink: builds minimal JRE (macOS/Linux)
  build-jre.ps1             # jdeps + jlink: builds minimal JRE (Windows)
  copy-sidecar.mjs          # Copies compiled sidecar to binaries/ with platform triple

src/
  App.tsx                   # Root: Send/Receive/Settings tabs, lifts form state
  components/
    SendView.tsx            # Send tab UI
    ReceiveView.tsx         # Receive tab UI
    SettingsView.tsx        # Advanced settings (relay mode, timeouts, etc.)
    SessionConfig.tsx       # Session ID, PSK, server address inputs
    ConnectionStatus.tsx    # Connection progress stepper (direct/UDP relay/TCP relay)
    TransferProgress.tsx    # Progress bar, speed, ETA
    DebugConsole.tsx        # Collapsible log viewer
  hooks/
    useTransfer.ts          # Core hook: spawn JAR, parse NDJSON, manage state
  lib/
    jar.ts                  # resolveResource() + Command.sidecar() builder
  types/
    ipc.ts                  # TypeScript types for all IPC events

src-tauri/
  src/lib.rs                # Minimal: just plugin init (shell + dialog)
  tauri.conf.json           # Bundle config: JAR resource, JRE resource, sidecar
  capabilities/default.json # shell:allow-spawn with sidecar scope
  sidecar/                  # Rust crate for Windows sidecar binary
    Cargo.toml
    src/main.rs             # Finds Java, forwards args, inherits stdio
  binaries/
    run-java-aarch64-apple-darwin          # macOS sidecar (bash script)
    run-java-x86_64-pc-windows-msvc.exe   # Windows sidecar (compiled, gitignored)
  scripts/
    run-java.sh             # Source for the macOS sidecar script
  resources/
    jre/                    # Custom JRE output (gitignored)
```

## Key Architecture Decisions

- **JAR is the engine** — all P2P logic (coordination, NAT traversal, DTLS, transfer) is in the Java process. UI is display-only.
- **NDJSON IPC** — JAR stdout emits `{"event":"status","state":"punching"}` etc. No Tauri commands for transfer logic.
- **Sidecar pattern** — `Command.sidecar("binaries/run-java", [...])` instead of `Command.create("java", [...])` because macOS GUI apps don't inherit shell PATH. On Windows, the sidecar must be a compiled `.exe` (Tauri only resolves `.exe` sidecars on Windows), built from `src-tauri/sidecar/`.
- **Bundled JRE via jlink** — `scripts/build-jre.sh` (macOS) / `scripts/build-jre.ps1` (Windows) creates a ~29MB custom JRE. BouncyCastle is not modular, so we jlink only the JRE (not the app).
- **Minimal Rust layer** — `src-tauri/src/lib.rs` only initializes plugins. All app logic lives in TypeScript.
- **Form state lifted to App.tsx** — SessionConfig, filePath, and outputDir are owned by App.tsx and passed as props to SendView/ReceiveView, so values survive tab switches.

### Data flow

```
React UI → useTransfer hook → jar.ts (Command.sidecar) → run-java sidecar → JRE → alt-p2p.jar
                ↑                                                                      |
                └────────────── stdout NDJSON events ──────────────────────────────────-┘
```

### useTransfer state machine

```
idle → connecting → transferring → complete
           │              │
           └──────────────┴→ error | cancelled
```

`startSend`/`startReceive` are async — they `await spawnSend()`/`spawnReceive()` and then `await command.spawn()`. Both must be inside try/catch or errors are swallowed silently. Cancellation uses a `cancelledRef` to distinguish user-initiated stops from errors.

### IPC events (from Java `--json` mode)

| Event | Key Fields | Triggers |
|-------|-----------|----------|
| `status` | `state` | `registering` → `waiting_peer` → `punching` → `handshaking`/`relaying`/`relay_tcp` → `connected` |
| `file_info` | `name`, `size`, `sha256` | After SHA-256 computation |
| `progress` | `bytes`, `total`, `speed_bps`, `eta_seconds`, `percent` | Every 250ms during transfer |
| `complete` | `bytes`, `packets`, `retransmissions`, `duration_ms`, `path?` | Transfer done |
| `error` | `message` | Fatal error, process exits |

All IPC types are defined in `src/types/ipc.ts`.

## Critical Implementation Notes

### Tauri shell plugin

- `Command.sidecar().spawn()` uses the `plugin:shell|spawn` IPC channel, NOT `plugin:shell|execute`. The scope entry in `capabilities/default.json` MUST be under `shell:allow-spawn`, not `shell:allow-execute`.
- Sidecar binary must have platform suffix: `run-java-aarch64-apple-darwin` (macOS), `run-java-x86_64-pc-windows-msvc.exe` (Windows).
- Resource directory mapping in `tauri.conf.json` uses trailing slash: `"resources/jre/": "jre/"`.

### Sidecar Java resolution

Both sidecars (macOS bash script at `src-tauri/scripts/run-java.sh`, Windows Rust binary at `src-tauri/sidecar/src/main.rs`) follow the same priority: bundled JRE → system Java → error JSON event. See source files for the full resolution chain.

### Tauri Capabilities

`capabilities/default.json` must include `core:window:allow-set-size` — the app dynamically resizes between 800x600 (idle) and 800x700 (active transfer). This permission silently fails if missing.

### Vite config

- `__BUILD_NUMBER__` global is injected at build time (format: `YYMMDD.HHmm`), displayed in the UI header.
- Dev server runs on port 1420; HMR on 1421.
- `src-tauri/` is excluded from file watching.

### TypeScript config

Strict mode is enabled with `noUnusedLocals` and `noUnusedParameters`. Target: ES2020.

## macOS Code Signing

When code signing for distribution, the bundled JRE needs entitlements for JIT compilation:
- `com.apple.security.cs.allow-jit`
- `com.apple.security.cs.allow-unsigned-executable-memory`
- `com.apple.security.cs.disable-library-validation`

Without these, HotSpot JVM crashes with SIGTRAP under hardened runtime. Entitlements file: `sign/jre.entitlements`. Sign script: `sign/sign.sh` (inside-out signing order).

DMG must be notarized separately from .app. Use `stapler validate`, NOT `spctl --assess --type install`.

## Build Environment (macOS)

Tauri build requires both nvm and cargo in the environment:
```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22 && . "$HOME/.cargo/env"
```

jlink output files are read-only. Before rebuilding JRE, run:
```bash
chmod -R u+w src-tauri/resources/jre/ src-tauri/target/release/jre/ src-tauri/target/debug/jre/
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for full design documentation.
