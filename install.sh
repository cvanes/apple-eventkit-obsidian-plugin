#!/bin/bash
set -euo pipefail

DEST="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Second Brain/.obsidian/plugins/apple-eventkit-obsidian-plugin"

echo "Building eventkitcli..."
bash eventkitcli/build.sh

echo "Building plugin..."
npm run build

echo "Installing to vault..."
mkdir -p "$DEST"
cp main.js manifest.json styles.css "$DEST/"
cp eventkitcli/.build/eventkitcli "$DEST/"

echo "Done! Plugin installed to: $DEST"
