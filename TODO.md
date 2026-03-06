# Summary

This file contains backlog of open items for alt-p2p-ui

## Bugs

### Completed

B1. ~~The cancel button does not work in the UI~~
- **Fixed in**: `src/hooks/useTransfer.ts`
- **Root cause**: After `kill()`, the `close` event handler fired with `code: null` (process killed by signal) and overwrote the state from `idle` back to `error`. Also, if the process hadn't spawned yet, `processRef` was null so `kill()` was a no-op.
- **Fix**: Added `cancelledRef` flag. `cancel()` sets the flag before killing; `close` handlers check it and bail out if the cancel was intentional. Both `startSend` and `startReceive` reset the flag on new transfers.

B2. ~~The Session ID field is getting auto-capitalized when user inputs the text~~
- **Fixed in**: `src/components/SessionConfig.tsx`
- **Root cause**: Missing `autoCapitalize` attribute on the input. macOS auto-capitalizes the first character of text inputs by default.
- **Fix**: Added `autoCapitalize="off"`, `autoCorrect="off"`, and `spellCheck={false}` to Session ID and PSK inputs.

B3. ~~The version of the app is not shown~~
- **Fixed in**: `src/App.tsx`
- **Fix**: Import `getVersion()` from `@tauri-apps/api/app`, display `v{version}` in the header (right-aligned). Version is read from `tauri.conf.json`.

B4. ~~When transfer begins, the window is not re-sized to show the progress bar.~~
- **Fixed in**: `src/components/SendView.tsx`, `src/components/ReceiveView.tsx`
- **Fix**: Added `useEffect` that watches `transferState`. Expands window to 800x700 when transfer is active, complete, or error. Shrinks back to 800x600 when idle. Uses `getCurrentWindow().setSize(new LogicalSize(...))` from Tauri window API.

B5. ~~Intermittent "Timed out waiting for FILE_OFFER" / "Timed out waiting for FILE_ACCEPT" when using the app~~
- **Fixed in**: `alt-p2p` repo — `src/main/java/com/alterante/p2p/transport/ReliableChannel.java`
- **Root cause**: Race condition. `PacketRouter` starts immediately in `PeerConnection.connect()`, but control packet handlers (FILE_OFFER, FILE_ACCEPT, etc.) were only registered on the router when `FileReceiver`/`FileSender` called `channel.onControlPacket()` — which happens after connection. If the remote peer sent FILE_OFFER in the gap, the packet was dispatched with no handler and silently dropped. Both sides then timed out. More likely when running as a Tauri sidecar (piped stdout changes thread scheduling) than in a terminal.
- **Fix**: `ReliableChannel` now registers control packet type handlers eagerly in its constructor. `dispatchControl()` buffers packets in a `ConcurrentLinkedQueue` if no consumer handler is set yet. When `onControlPacket(handler)` is called, buffered packets are replayed.

B6. ~~When transfer in progress, clicking the Send and Receive tabs interrupts the transfer. These should be disabled during transfer. Only the Cancel button should be clickable.~~
- **Fixed in**: `src/App.tsx`, `src/components/SendView.tsx`, `src/components/ReceiveView.tsx`
- **Root cause**: Tab buttons in `App.tsx` had no awareness of transfer state in child views.
- **Fix**: Added `onActiveChange` callback prop to both views. Views notify `App` when `isActive` changes. Tab buttons are disabled (grayed out, not clickable) when a transfer is in progress on the other tab.

B7. ~~When user clicks Cancel, the transfer stops but no message appears to the user. We should notify user and also update the console.~~
- **Fixed in**: `src/types/ipc.ts`, `src/hooks/useTransfer.ts`, `src/components/SendView.tsx`, `src/components/ReceiveView.tsx`
- **Root cause**: `cancel()` reset state to `initialState` (idle), so the UI jumped straight back to the form with no feedback.
- **Fix**: Added `"cancelled"` to `TransferState`. Cancel now transitions to `"cancelled"` state (preserving logs) and appends a log entry. Both views show a yellow "Transfer cancelled" banner with a "New Transfer" button.

## New functionality

F1. ~~There should be a checkbox to enable/disable debug mode, which shows console output directly in the app. This is useful for debugging in production. Make the console look like a terminal window in terms of fonts, etc. The console can be a sub-window in the same window of the app. It can sit below the progress bar during transfer.~~
- **Status**: Complete
- **Fixed in**: `src/components/DebugConsole.tsx` (new), `src/components/SendView.tsx`, `src/components/ReceiveView.tsx`, `src/hooks/useTransfer.ts`
- **Details**: Terminal-style console with monospace font, color-coded lines (green=stdout, yellow=stderr, red=errors). Timestamps on each line (`HH:mm:ss.SSS`). Checkbox toggle, auto-scrolls to bottom. Clear and Copy buttons in header bar. Window resizes when toggled.

F2. There should be a checkbox to enable/disable Advanced mode. Which shows additional parameters users can change. For example:
- how many retries for hole punching.
- timeout values
- starting packet sizes for UDP
- **Status**: Pending
- **Notes**: Requires changes in both repos. The Java CLI currently has no advanced tuning options — all values are hardcoded constants. Suggested parameters to expose:

| Parameter | Current Value | Java File | Description |
|-----------|--------------|-----------|-------------|
| Hole punch timeout | 10,000ms | HolePuncher.java | How long to try hole punching |
| Hole punch interval | 100ms | HolePuncher.java | Interval between PUNCH packets |
| DTLS handshake retries | 3 | PeerConnection.java | Max DTLS handshake attempts |
| DTLS handshake timeout | 30,000ms | DtlsHandler.java | Per-attempt handshake deadline |
| Initial CWND | 32 | CongestionControl.java | Congestion window start (packets) |
| Keepalive interval | 15,000ms | PacketRouter.java | Keep NAT mapping alive |

**Implementation**: Phase 1 — add optional `@Option` annotations in Java CLI (`SendCommand`, `ReceiveCommand`), thread through to components. Phase 2 — add "Advanced" toggle in UI, pass values as extra CLI args via `jar.ts`.
