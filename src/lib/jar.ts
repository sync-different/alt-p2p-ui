import { Command } from "@tauri-apps/plugin-shell";
import { resolveResource } from "@tauri-apps/api/path";
import type { SessionConfig } from "../types/ipc";

/** Resolve the bundled JAR path at runtime. */
async function getJarPath(): Promise<string> {
  return resolveResource("alt-p2p.jar");
}

/** Spawn the JAR with the `send` subcommand */
export async function spawnSend(config: SessionConfig, filePath: string) {
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
  ]);
}

/** Spawn the JAR with the `receive` subcommand */
export async function spawnReceive(config: SessionConfig, outputDir: string) {
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
  ]);
}
