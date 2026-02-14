#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building eventkitcli (arm64)..."
swift build -c release --arch arm64

echo "Building eventkitcli (x86_64)..."
swift build -c release --arch x86_64

ARM_BIN=".build/arm64-apple-macosx/release/eventkitcli"
X86_BIN=".build/x86_64-apple-macosx/release/eventkitcli"
UNIVERSAL_BIN=".build/eventkitcli"

echo "Creating universal binary..."
lipo -create -output "$UNIVERSAL_BIN" "$ARM_BIN" "$X86_BIN"

echo "Signing with entitlements..."
codesign --force --sign - --entitlements eventkitcli.entitlements "$UNIVERSAL_BIN"

cp "$UNIVERSAL_BIN" ../eventkitcli-bin

echo "Installed to ../eventkitcli-bin (plugin directory)"
echo "Done."
