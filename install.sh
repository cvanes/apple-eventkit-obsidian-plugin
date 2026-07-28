#!/bin/bash
set -euo pipefail

# Vault location. Override for a different vault:  VAULT="$HOME/other-vault" ./install.sh
VAULT="${VAULT:-$HOME/second-brain}"
DEST="$VAULT/.obsidian/plugins/apple-eventkit-obsidian-plugin"

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

echo
echo "Done. Plugin installed to: $DEST"
