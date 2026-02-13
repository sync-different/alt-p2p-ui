#!/bin/bash
# Wrapper script to run Java for the alt-p2p Tauri app.
# In production: uses the bundled JRE at Contents/Resources/jre/
# In dev mode: falls back to system Java.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$(dirname "$SCRIPT_DIR")/Resources"

# 1. Bundled JRE (production .app bundle)
BUNDLED_JAVA="$RESOURCES_DIR/jre/bin/java"
if [ -x "$BUNDLED_JAVA" ]; then
  exec "$BUNDLED_JAVA" "$@"
fi

# 2. Fallback: system Java (dev mode)
if [ -x /usr/libexec/java_home ] && JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null); then
  exec "$JAVA_HOME/bin/java" "$@"
fi

if [ -x /opt/homebrew/bin/java ]; then
  exec /opt/homebrew/bin/java "$@"
fi

if [ -x /usr/local/bin/java ]; then
  exec /usr/local/bin/java "$@"
fi

if [ -x /usr/bin/java ]; then
  exec /usr/bin/java "$@"
fi

echo '{"event":"error","message":"Java runtime not found"}' >&1
exit 1
