#!/bin/bash

# Deploy to Obsidian Test Vault
# Builds the plugin and copies files to Windows Obsidian vault

set -e

OBSIDIAN_VAULT="/mnt/e/dev/test-obsidian-vault"
PLUGIN_DIR="$OBSIDIAN_VAULT/.obsidian/plugins/vespera-scriptorium"

echo "🔨 Building Vespera Scriptorium plugin (esbuild only)..."
node esbuild.config.mjs production

echo "📁 Creating plugin directory if needed..."
mkdir -p "$PLUGIN_DIR"

echo "📦 Copying plugin files to Obsidian vault..."
cp manifest.json "$PLUGIN_DIR/"
cp main.js "$PLUGIN_DIR/"

# Copy styles.css if it exists
if [ -f "styles.css" ]; then
    echo "🎨 Copying styles..."
    cp styles.css "$PLUGIN_DIR/"
fi

echo "✅ Plugin deployed to Obsidian test vault!"
echo "   Location: $PLUGIN_DIR"
echo "   Files copied: manifest.json, main.js"

# Check if Obsidian vault can be accessed
if [ -d "$OBSIDIAN_VAULT" ]; then
    echo "🔍 Vault accessible - you can now test the plugin in Obsidian"
else
    echo "⚠️  Warning: Vault directory not accessible from WSL"
fi