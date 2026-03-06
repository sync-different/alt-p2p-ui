# Architecture

alt-p2p-ui is a Tauri v2 desktop application that wraps the [alt-p2p](https://github.com/sync-different/alt-p2p) Java CLI as a child process. The frontend is React + TypeScript; the backend is a thin Rust shell that manages process spawning and OS integration. A custom JRE built with jlink is bundled inside the app so end users don't need Java installed.

## Design Principles

1. **The JAR is the engine.** All networking (coordination, hole punch, DTLS, file transfer) happens in the Java process. The UI never touches sockets directly.
2. **NDJSON IPC.** The JAR's `--json` flag outputs newline-delimited JSON events on stdout. The UI parses these to drive state transitions. No custom IPC protocol, no Tauri commands for transfer logic.
3. **Minimal Rust layer.** The Tauri backend (`lib.rs`) only initializes plugins. All app logic lives in TypeScript.
4. **Self-contained distribution.** The `.app` bundle includes a custom JRE (via jlink) and the fat JAR. No external dependencies for end users.

## Component Architecture

```
+---------------------------------------------+
|                  Tauri Window                |
|                                             |
|  +---------------------------------------+  |
|  |              App.tsx                   |  |
|  |  [Send Tab]  [Receive Tab]            |  |
|  +---------------------------------------+  |
|            |                  |              |
|  +---------v------+  +-------v----------+   |
|  |   SendView     |  |   ReceiveView    |   |
|  | SessionConfig  |  | SessionConfig    |   |
|  | File picker    |  | Directory picker |   |
|  +--------+-------+  +--------+---------+   |
|           |                    |             |
|           +--------+-----------+             |
|                    |                         |
|           +--------v--------+                |
|           |  useTransfer()  |  React hook    |
|           +--------+--------+                |
|                    |                         |
|           +--------v--------+                |
|           |     jar.ts      |  Command builder|
|           +--------+--------+                |
+--------------------|--------------------------+
                     |
          Command.sidecar().spawn()
                     |
          +----------v-----------+
          |    run-java sidecar  |  Shell script
          +----------+-----------+
                     |
          +----------v-----------+
          |  Bundled JRE         |  jlink custom runtime
          |  jre/bin/java        |  (29MB, 4 modules)
          +----------+-----------+
                     |
          +----------v-----------+
          |   alt-p2p.jar        |  Java process
          |   (send/receive      |
          |    --json mode)      |
          +----------------------+
                     |
                stdout (NDJSON)
```

## IPC Protocol

The Java process emits events as JSON objects, one per line on stdout:

| Event | Fields | Description |
|-------|--------|-------------|
| `status` | `state` | Connection lifecycle: `registering`, `waiting_peer`, `punching`, `handshaking`, `connected` |
| `file_info` | `name`, `size`, `sha256` | File metadata (sender computes before connecting) |
| `progress` | `bytes`, `total`, `speed_bps`, `eta_seconds`, `percent` | Transfer progress (emitted every 250ms) |
| `complete` | `bytes`, `packets`, `retransmissions`, `duration_ms`, `path?` | Transfer finished successfully |
| `error` | `message` | Fatal error, process will exit |
| `log` | `level`, `message` | Informational log (debug/info/warn) |

The `useTransfer` hook parses each line, dispatches to a state reducer, and exposes typed React state (`transferState`, `connectionState`, `progress`, `fileInfo`, `result`, `error`).

## Process Lifecycle

### Spawning

1. `jar.ts` resolves the bundled JAR path via `resolveResource("alt-p2p.jar")`
2. Builds a `Command.sidecar("binaries/run-java", [...args])` with the JAR path, `--json` flag, and session parameters
3. `useTransfer` calls `.spawn()` to get a `Child` handle
4. Registers event handlers: `stdout.on("data")` for JSON parsing, `stderr.on("data")` for logs, `on("close")` for exit detection, `on("error")` for spawn failures

### State Machine

```
idle ──> connecting ──> transferring ──> complete
              │              │
              └──────────────┴──> error
```

- **idle**: No process running. User can configure session and start.
- **connecting**: Process spawned, cycling through `registering` > `waiting_peer` > `punching` > `handshaking` > `connected`.
- **transferring**: First `progress` event received. Progress bar active.
- **complete**: `complete` event received. Shows summary.
- **error**: `error` event received, or process exited with non-zero code.

### Cancellation

The `cancel()` function calls `child.kill()` on the process handle, which sends SIGTERM to the Java process. The shutdown hook in `SendCommand`/`ReceiveCommand` closes the `PeerConnection` cleanly.

## Bundled JRE (jlink)

### Why jlink for the JRE only

BouncyCastle (used for DTLS 1.2 encryption) is not a modular JAR &mdash; it has no `module-info.java` and no `Automatic-Module-Name` in its manifest. This means we can't use jlink to create a fully modular application image.

However, we *can* use jlink to build a **custom minimal JRE** containing only the JDK modules our fat JAR needs. The fat JAR stays on the classpath, and the sidecar script invokes `jre/bin/java -jar alt-p2p.jar`.

### Module analysis

`jdeps --print-module-deps --ignore-missing-deps` on the fat JAR reports:

| Module | Why |
|--------|-----|
| `java.base` | Core (always required) |
| `java.naming` | BouncyCastle JNDI lookups |
| `java.sql` | picocli reflective detection |
| `jdk.crypto.ec` | TLS cipher suite safety net (added manually) |

jlink resolves transitive dependencies automatically (`java.logging`, `java.xml`, `java.transaction.xa`, `java.security.sasl`).

### Size comparison

| What | macOS | Windows |
|------|-------|---------|
| Full JDK 17+ | 305MB | 305MB |
| jpackage JRE | ~150-200MB | ~150-200MB |
| **jlink custom JRE** | **29MB** | **~33MB** |
| Fat JAR | 10MB | 10MB |
| **Total bundle** | **44MB (.app)** | **~48MB** |
| **Installer** | **28MB (.dmg)** | **~45MB (NSIS .exe)** |

### Build scripts

**macOS/Linux:** `scripts/build-jre.sh` (`npm run build:jre:mac`)

```bash
MODULES=$(jdeps --print-module-deps --ignore-missing-deps "$JAR_PATH")
MODULES="${MODULES},jdk.crypto.ec"
jlink --add-modules "$MODULES" --output src-tauri/resources/jre \
  --strip-debug --no-man-pages --no-header-files --compress=2
```

**Windows:** `scripts/build-jre.ps1` (`npm run build:jre`)

```powershell
# Resolves jdeps/jlink via JAVA_HOME or PATH (JAVA_HOME recommended)
$Modules = & $Jdeps --print-module-deps --ignore-missing-deps $JarPath
$Modules = "$Modules,jdk.crypto.ec"
& $Jlink --add-modules $Modules --output $OutputDir `
  --strip-debug --no-man-pages --no-header-files --compress=2
```

The output at `src-tauri/resources/jre/` is gitignored (platform-specific build artifact). A `.gitkeep` file ensures the directory exists on fresh clones (Tauri validates resource paths at build time).

## Sidecar: Java Resolution

The sidecar binary finds and launches Java, forwarding all arguments and inheriting stdio so NDJSON events flow through to Tauri.

### macOS (bash script)

The `run-java` sidecar (`src-tauri/scripts/run-java.sh`) is a bash script:

1. **Production** (inside `.app` bundle): Uses the bundled JRE at `Contents/Resources/jre/bin/java`. The script resolves this via its own location (`$SCRIPT_DIR/../Resources/jre/bin/java`), since sidecars live in `Contents/MacOS/` and resources in `Contents/Resources/`.
2. **Development** (`cargo tauri dev`): The bundled JRE doesn't exist, so the script falls back to system Java by probing `/usr/libexec/java_home`, Homebrew paths, and `/usr/bin/java`.

### Windows (compiled Rust binary)

On Windows, Tauri's shell plugin only resolves `.exe` sidecars, so a bash script won't work. The sidecar is a compiled Rust binary (`src-tauri/sidecar/src/main.rs`):

1. **Production** (NSIS install): Uses the bundled JRE at `<exe_dir>\jre\bin\java.exe`. On Windows, Tauri places sidecars and resources in the same install directory.
2. **Development** (`cargo tauri dev`): Falls back to `%JAVA_HOME%\bin\java.exe`, then `java` on PATH.
3. Uses `CREATE_NO_WINDOW` flag to prevent console window flash when spawning Java.

Build with `npm run build:sidecar` (compiles the crate and copies the `.exe` with the correct platform triple suffix).

### Tauri Sidecar Wiring

- `tauri.conf.json` > `bundle.externalBin`: `["binaries/run-java"]`
- macOS binary at `src-tauri/binaries/run-java-aarch64-apple-darwin` (bash script)
- Windows binary at `src-tauri/binaries/run-java-x86_64-pc-windows-msvc.exe` (compiled, gitignored)
- Platform suffix is required by Tauri &mdash; it auto-selects the correct binary at runtime
- `capabilities/default.json`: `shell:allow-spawn` permission with sidecar scope (not `shell:allow-execute` &mdash; `Command.sidecar().spawn()` uses the `spawn` IPC channel)

## Resource Bundling

Configured in `tauri.conf.json` > `bundle.resources`:

```json
{
  "../../alt-p2p/target/alt-p2p-0.2.0-SNAPSHOT.jar": "alt-p2p.jar",
  "resources/jre/": "jre/"
}
```

At build time, Tauri copies the JAR and the entire JRE directory tree into the bundle. On macOS this is `Contents/Resources/`; on Windows it's the install directory alongside the exe. At runtime, `resolveResource("alt-p2p.jar")` returns the absolute path inside the bundle (cross-platform).

## Security Model

- **DTLS 1.2 encryption** &mdash; all file data is encrypted in transit via BouncyCastle PSK
- **HMAC-SHA256 authentication** &mdash; the coordination server verifies both peers know the PSK before sharing endpoints
- **No direct network access from UI** &mdash; the Tauri frontend never opens sockets. All networking is isolated in the Java process.
- **Tauri CSP** &mdash; currently disabled (`null`) during development. Should be locked down for production.
- **Shell scope** &mdash; only `binaries/run-java` sidecar can be spawned; arbitrary command execution is blocked by the Tauri capability system.

## Build Pipeline

### macOS

```bash
# 1. Build the fat JAR (in alt-p2p/)
cd ../alt-p2p && mvn package

# 2. Build the custom JRE (in alt-p2p-ui/)
bash scripts/build-jre.sh

# 3. Build the Tauri app (bundles JRE + JAR + sidecar + frontend)
npm run tauri build
```

### Windows

```powershell
# 1. Build the fat JAR (in alt-p2p/)
cd ..\alt-p2p; mvn package; cd ..\alt-p2p-ui

# 2. Compile the sidecar .exe and copy with platform triple suffix
npm run build:sidecar

# 3. Build the custom JRE
npm run build:jre

# 4. Build the Tauri app (bundles JRE + JAR + sidecar + frontend)
npm run tauri build
```
