// Copies the compiled sidecar binary to src-tauri/binaries/ with the correct
// platform triple suffix. Works on macOS, Windows, and Linux.

import { copyFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Detect Rust host triple
const rustcOutput = execSync("rustc -vV", { encoding: "utf-8" });
const match = rustcOutput.match(/host: (.+)/);
if (!match) {
  console.error("Could not determine Rust target triple from `rustc -vV`");
  process.exit(1);
}
const targetTriple = match[1].trim();

const ext = process.platform === "win32" ? ".exe" : "";
const src = join(
  projectRoot,
  "src-tauri",
  "sidecar",
  "target",
  "release",
  `run-java${ext}`,
);
const dest = join(
  projectRoot,
  "src-tauri",
  "binaries",
  `run-java-${targetTriple}${ext}`,
);

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`Sidecar copied: ${dest}`);
