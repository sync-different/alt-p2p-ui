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

## Key Architecture

- **JAR is the engine** — all P2P logic (coordination, NAT traversal, DTLS, transfer) is in the Java process. The UI is display-only.
- **NDJSON IPC** — JAR stdout emits `{"event":"status","state":"punching"}` etc. No Tauri commands for transfer logic.
- **Sidecar pattern** — `Command.sidecar("binaries/run-java", [...])` instead of `Command.create("java", [...])` because macOS GUI apps don't inherit shell PATH. On Windows, the sidecar must be a compiled `.exe` (Tauri only resolves `.exe` sidecars on Windows), built from `src-tauri/sidecar/`.
- **Bundled JRE via jlink** — `scripts/build-jre.sh` (macOS) / `scripts/build-jre.ps1` (Windows) creates a ~29MB custom JRE. BouncyCastle is not modular, so we jlink only the JRE (not the app).
- **Minimal Rust layer** — `src-tauri/src/lib.rs` only initializes plugins. All app logic lives in TypeScript.

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
           └──────────────┴→ error
```

`startSend`/`startReceive` are async — they `await spawnSend()`/`spawnReceive()` then `await command.spawn()`. Both must be inside try/catch or errors are swallowed silently.

### IPC events (from Java `--json` mode)

| Event | Key Fields | Triggers |
|-------|-----------|----------|
| `status` | `state` | `registering` → `waiting_peer` → `punching` → `handshaking` → `connected` |
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

### Vite config

- `__BUILD_NUMBER__` global is injected at build time (format: `YYMMDD.HHmm`).
- Dev server runs on port 1420; HMR on 1421.
- `src-tauri/` is excluded from file watching.

### TypeScript config

Strict mode is enabled with `noUnusedLocals` and `noUnusedParameters`. Target: ES2020.

See [ARCHITECTURE.md](ARCHITECTURE.md) for full design documentation including component diagrams, security model, and jlink module analysis.
