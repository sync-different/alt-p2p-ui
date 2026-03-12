import { Command } from "@tauri-apps/plugin-shell";
import { resolveResource } from "@tauri-apps/api/path";
import type { SessionConfig, AdvancedSettings } from "../types/ipc";

/** Resolve the bundled JAR path at runtime. */
async function getJarPath(): Promise<string> {
  return resolveResource("alt-p2p.jar");
}

/** Build CLI args for non-empty advanced settings */
function advancedArgs(settings?: AdvancedSettings): string[] {
  if (!settings) return [];
  const args: string[] = [];
  const map: Record<string, string> = {
    "--punch-timeout": settings.punchTimeoutMs,
    "--punch-interval": settings.punchIntervalMs,
    "--dtls-retries": settings.dtlsRetries,
    "--dtls-timeout": settings.dtlsTimeoutMs,
    "--initial-cwnd": settings.initialCwnd,
    "--keepalive-interval": settings.keepaliveIntervalMs,
  };
  for (const [flag, value] of Object.entries(map)) {
    if (value && value.trim()) {
      args.push(flag, value.trim());
    }
  }
  if (settings.allowRelay) {
    args.push("--allow-relay");
    args.push("--relay-mode", settings.relayMode || "tcp");
  }
  return args;
}

/** Spawn the JAR with the `send` subcommand */
export async function spawnSend(config: SessionConfig, filePath: string, settings?: AdvancedSettings) {
  const jarPath = await getJarPath();
  return Command.sidecar("binaries/run-java", [
    "-jar",
    jarPath,
    "send",
    "--json",
    "-s",
    config.sessionId,
    "--psk",
    config.psk,
    "--server",
    config.serverAddress,
    "-f",
    filePath,
    ...advancedArgs(settings),
  ]);
}

/** Spawn the JAR with the `receive` subcommand */
export async function spawnReceive(config: SessionConfig, outputDir: string, settings?: AdvancedSettings) {
  const jarPath = await getJarPath();
  return Command.sidecar("binaries/run-java", [
    "-jar",
    jarPath,
    "receive",
    "--json",
    "-s",
    config.sessionId,
    "--psk",
    config.psk,
    "--server",
    config.serverAddress,
    "-o",
    outputDir,
    ...advancedArgs(settings),
  ]);
}
