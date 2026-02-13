#!/bin/bash
# Build a minimal JRE for bundling with the Tauri app.
# Uses jdeps to detect required modules, then jlink to create a stripped runtime.
# Output: src-tauri/resources/jre/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
JAR_PATH="${PROJECT_DIR}/../alt-p2p/target/alt-p2p-0.1.0-SNAPSHOT.jar"
OUTPUT_DIR="${PROJECT_DIR}/src-tauri/resources/jre"

# Validate fat JAR exists
if [ ! -f "$JAR_PATH" ]; then
  echo "ERROR: Fat JAR not found at $JAR_PATH"
  echo "Run 'mvn package' in ../alt-p2p/ first."
  exit 1
fi

# Detect required JDK modules
echo "Analyzing module dependencies..."
MODULES=$(jdeps --print-module-deps --ignore-missing-deps "$JAR_PATH" 2>/dev/null)
echo "Detected modules: $MODULES"

# Add jdk.crypto.ec for TLS cipher suite support (BouncyCastle may delegate some ops)
MODULES="${MODULES},jdk.crypto.ec"
echo "Final modules:    $MODULES"

# Remove old JRE if present
rm -rf "$OUTPUT_DIR"

# Build minimal JRE
echo "Building custom JRE..."
jlink \
  --add-modules "$MODULES" \
  --output "$OUTPUT_DIR" \
  --strip-debug \
  --no-man-pages \
  --no-header-files \
  --compress=2

echo ""
echo "Custom JRE built at: $OUTPUT_DIR"
echo "Size: $(du -sh "$OUTPUT_DIR" | cut -f1)"
echo "Java: $("$OUTPUT_DIR/bin/java" -version 2>&1 | head -1)"
