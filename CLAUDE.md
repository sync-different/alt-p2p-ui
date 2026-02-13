# CLAUDE.md

## Project Overview

alt-p2p-ui is the desktop GUI for [alt-p2p](https://github.com/sync-different/alt-p2p), an encrypted peer-to-peer file transfer system. Built with Tauri v2, React 19, and TypeScript. Bundles a custom JRE (via jlink) so end users don't need Java installed.

The app spawns the alt-p2p Java CLI as a child process with `--json` for NDJSON IPC on stdout. All networking happens in the Java process — the UI only parses events and renders state.

## Build & Run

```bash
npm install              # Install frontend dependencies
npm run tauri dev        # Dev mode (hot reload, uses system Java)

# Release build (requires alt-p2p JAR + JDK 17+):
cd ../alt-p2p && mvn package -q          # Build fat JAR
cd ../alt-p2p-ui && bash scripts/build-jre.sh  # Build custom JRE (jlink)
npm run tauri build                       # Build .app + .dmg
```

Requires Node.js 18+, Rust (stable), JDK 17+, Maven 3.9+.

## Project Structure

```
scripts/
  build-jre.sh              # jdeps + jlink: builds minimal JRE (29MB)

src/
  App.tsx                   # Root: Send/Receive tab switcher
  components/
    SendView.tsx            # Send tab UI
    ReceiveView.tsx         # Receive tab UI
    SessionConfig.tsx       # Session ID, PSK, server address inputs
    ConnectionStatus.tsx    # Connection progress stepper (5 stages)
    TransferProgress.tsx    # Progress bar, speed, ETA
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
  binaries/
    run-java-aarch64-apple-darwin  # Sidecar: prefers bundled JRE, falls back to system
  scripts/
    run-java.sh             # Source for the sidecar script
  resources/
    jre/                    # Custom JRE output (gitignored)
```

## Key Architecture Decisions

- **JAR is the engine** — all P2P logic (coordination, NAT traversal, DTLS, transfer) is in the Java process. UI is display-only.
- **NDJSON IPC** — JAR stdout emits `{"event":"status","state":"punching"}` etc. No Tauri commands for transfer logic.
- **Sidecar, not direct exec** — `Command.sidecar("binaries/run-java", [...])` instead of `Command.create("java", [...])` because macOS GUI apps don't inherit shell PATH.
- **Bundled JRE via jlink** — `scripts/build-jre.sh` creates a 29MB custom JRE with only 4 modules. BouncyCastle is not modular, so we jlink the JRE only (not the app).

## Critical Implementation Notes

### Tauri Shell Plugin

- `Command.sidecar().spawn()` uses the `plugin:shell|spawn` IPC channel, NOT `plugin:shell|execute`. The scope entry in `capabilities/default.json` MUST be under `shell:allow-spawn`, not `shell:allow-execute`.
- Sidecar binary must have platform suffix: `run-java-aarch64-apple-darwin`.
- Resource directory mapping uses trailing slash: `"resources/jre/": "jre/"`.

### Sidecar Java Resolution

The `run-java` sidecar resolves Java in this order:
1. **Bundled JRE** at `$SCRIPT_DIR/../Resources/jre/bin/java` (production `.app`)
2. `/usr/libexec/java_home` (macOS JVM locator)
3. `/opt/homebrew/bin/java` (Homebrew Apple Silicon)
4. `/usr/local/bin/java` (Homebrew Intel)
5. `/usr/bin/java` (system)
6. Emits `{"event":"error","message":"Java runtime not found"}` if all fail

### IPC Events (from Java `--json` mode)

| Event | Key Fields | Triggers |
|-------|-----------|----------|
| `status` | `state` | `registering` → `waiting_peer` → `punching` → `handshaking` → `connected` |
| `file_info` | `name`, `size`, `sha256` | After SHA-256 computation |
| `progress` | `bytes`, `total`, `speed_bps`, `eta_seconds`, `percent` | Every 250ms during transfer |
| `complete` | `bytes`, `packets`, `retransmissions`, `duration_ms`, `path?` | Transfer done |
| `error` | `message` | Fatal error, process exits |

### useTransfer State Machine

```
idle → connecting → transferring → complete
           │              │
           └──────────────┴→ error
```

`startSend`/`startReceive` are async — they `await spawnSend()`/`spawnReceive()` and then `await command.spawn()`. Both must be inside try/catch or errors are swallowed silently.

## Bundle Sizes

| Component | Size |
|-----------|------|
| Custom JRE (jlink) | 29MB |
| Fat JAR | 10MB |
| Tauri binary | 5MB |
| Total `.app` | 44MB |
| `.dmg` (compressed) | 28MB |

## Dependencies

### Frontend (package.json)
- `@tauri-apps/api` — path resolution (`resolveResource`)
- `@tauri-apps/plugin-shell` — `Command.sidecar().spawn()`
- `@tauri-apps/plugin-dialog` — native file/directory picker
- `react`, `react-dom` — UI
- `tailwindcss` — styling

### Backend (Cargo.toml)
- `tauri` — app framework
- `tauri-plugin-shell` — process spawning
- `tauri-plugin-dialog` — native dialogs

See [ARCHITECTURE.md](ARCHITECTURE.md) for full design documentation.
