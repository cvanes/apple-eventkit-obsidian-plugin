#!/bin/bash
set -euo pipefail

# Vault location. Override for a different vault:  VAULT="$HOME/other-vault" ./install.sh
VAULT="${VAULT:-$HOME/second-brain}"
DEST="$VAULT/.obsidian/plugins/apple-eventkit-obsidian-plugin"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"

if [ ! -d "$VAULT" ]; then
  echo "Vault not found: $VAULT" >&2
  echo "Set VAULT to your vault path, e.g. VAULT=\"\$HOME/my-vault\" ./install.sh" >&2
  exit 1
fi

echo "Building eventkitcli..."
bash eventkitcli/build.sh

echo "Building plugin..."
npm run build

echo "Installing plugin to vault: $DEST"
mkdir -p "$DEST"
cp main.js manifest.json styles.css "$DEST/"
cp eventkitcli/.build/eventkitcli "$DEST/"

echo "Installing eventkitcli to: $BIN_DIR"
mkdir -p "$BIN_DIR"
cp eventkitcli/.build/eventkitcli "$BIN_DIR/eventkitcli"

echo
echo "Done."
echo "  Plugin: $DEST"
echo "  CLI:    $BIN_DIR/eventkitcli"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo
     echo "Note: $BIN_DIR is not on your PATH. Add this to your shell profile:"
     echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
     ;;
esac
