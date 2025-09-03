---
title: Installation Guide
category: user-guide
difficulty: beginner
time_estimate: "10 minutes"
prerequisites: ["VS Code 1.95+"]
last_updated: 2025-01-09
---

# Vespera Forge Installation Guide

## System Requirements

### Minimum Requirements
- **VS Code**: Version 1.95.0 or later
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Node.js**: Not required for basic usage (optional for development)

### Recommended Setup
- **VS Code**: Latest stable version
- **RAM**: 4GB+ available memory  
- **Storage**: 100MB+ free disk space
- **Internet**: For initial setup and updates

### Optional Components
- **Rust Bindery Backend**: For full collaborative features (auto-detected)
- **Git**: For version control integration
- **Node.js 18+**: Only needed for extension development

## Installation Methods

### Method 1: VS Code Marketplace (Coming Soon)

Once published, the extension will be available through the VS Code Marketplace:

1. **Open VS Code**
2. **Open Extensions View**: 
   - Click the Extensions icon in the Activity Bar
   - Or press `Ctrl+Shift+X` (Windows/Linux) / `Cmd+Shift+X` (macOS)
3. **Search**: Type "Vespera Forge" in the search box
4. **Install**: Click the "Install" button
5. **Reload**: VS Code will automatically reload to activate the extension

### Method 2: VSIX Package Installation (Current)

For beta versions and development builds:

1. **Download VSIX Package**:
   - Get `vespera-forge-0.0.1.vsix` from the project releases
   - Or build from source (see [Developer Guide](../development/getting-started.md))

2. **Install via Command Palette**:
   ```
   Ctrl+Shift+P → Extensions: Install from VSIX...
   ```
   - Select the downloaded `.vsix` file
   - Wait for installation to complete

3. **Install via Command Line**:
   ```bash
   code --install-extension vespera-forge-0.0.1.vsix
   ```

### Method 3: Development Installation

For contributors and advanced users:

1. **Clone Repository**:
   ```bash
   git clone https://github.com/vespera-atelier/vespera-atelier.git
   cd vespera-atelier/plugins/VSCode/vespera-forge
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Build Extension**:
   ```bash
   npm run compile
   ```

4. **Launch Development Host**:
   ```bash
   # Open in VS Code and press F5
   code .
   ```

## Initial Setup

### Extension Activation

After installation, Vespera Forge activates automatically when:

- Opening a workspace with Markdown or JSON files
- Running any `Vespera Forge` command
- Opening the Vespera Forge Activity Bar panel

### First-Time Configuration

1. **Initialize Extension**:
   - Open Command Palette (`Ctrl+Shift+P`)
   - Run `Vespera Forge: Initialize Vespera Forge`
   - The extension will auto-detect available backends

2. **Configuration Dialog**:
   ```
   [INFO] Vespera Forge: Initializing...
   [INFO] Looking for Bindery backend...
   [INFO] Backend not found, using mock mode
   [SUCCESS] Vespera Forge ready! Using mock mode for development.
   ```

3. **Verify Installation**:
   - Check for "Vespera Forge" in the Activity Bar
   - Open the Vespera Forge panel
   - Verify Task Tree and Dashboard are accessible

## Configuration Options

### Extension Settings

Access via `File → Preferences → Settings → Extensions → Vespera Forge`:

#### Auto-Start Configuration
```json
{
  "vesperaForge.enableAutoStart": true
}
```
- **Default**: `true`
- **Description**: Automatically initialize Vespera Forge when opening workspaces

#### Bindery Backend Path
```json
{
  "vesperaForge.rustBinderyPath": "/path/to/bindery-server"
}
```
- **Default**: Auto-detected
- **Description**: Custom path to Rust Bindery executable
- **Usage**: Only needed if auto-detection fails

### Workspace Configuration

Create `.vscode/settings.json` in your workspace:

```json
{
  "vesperaForge.enableAutoStart": true,
  "vesperaForge.rustBinderyPath": "./bindery/target/release/bindery-server"
}
```

## Backend Integration

### Mock Mode (Default)

Vespera Forge includes a comprehensive mock mode that provides full functionality without external dependencies:

**Features Available**:
- ✅ Task creation and management
- ✅ Hierarchical task trees  
- ✅ Task dashboard with analytics
- ✅ All UI components functional
- ✅ Realistic async behavior
- ✅ Comprehensive test data

**Limitations**:
- ❌ No real-time collaboration
- ❌ No persistent data storage
- ❌ No cross-session task sharing

### Bindery Backend (Full Features)

For complete functionality, install the Rust Bindery backend:

#### Automatic Detection

The extension searches for Bindery in these locations:
1. User-configured path (`vesperaForge.rustBinderyPath`)
2. Workspace relative paths (`./bindery/target/release/bindery-server`)
3. System PATH (`bindery-server` command)

#### Manual Bindery Setup

If you have the Vespera Atelier monorepo:

```bash
# Navigate to Bindery directory
cd packages/vespera-utilities/vespera-bindery

# Build Bindery server
cargo build --release

# The extension will auto-detect at:
# ./target/release/bindery-server
```

For standalone Bindery installation:

```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clone and build Bindery
git clone https://github.com/vespera-atelier/vespera-bindery.git
cd vespera-bindery
cargo build --release

# Configure VS Code to use this path
```

#### Connection Verification

After setup, verify the backend connection:

1. **Status Bar**: Check for "✅ Bindery Connected" indicator
2. **Command Palette**: Run `Vespera Forge: Initialize Vespera Forge`
3. **Extension Log**: Check VS Code Developer Tools console

## User Interface Overview

### Activity Bar Integration

Vespera Forge adds a dedicated panel to VS Code's Activity Bar:

```
┌─────────────┐
│ 📁 Explorer │
│ 🔍 Search   │
│ ⚡ SCM      │
│ 🐞 Debug    │
│ 🧩 Extensions │
│ 🌟 Vespera  │ ← New Vespera Forge panel
└─────────────┘
```

### Panel Components

**Task Tree View**:
- Hierarchical display of all tasks
- Status indicators with color coding
- Context menus for task actions
- Real-time updates

**Task Dashboard**:
- Rich analytics and metrics
- Interactive task creation forms
- Progress visualization
- Recent activity feed

**Status Bar Integration**:
- Connection status indicator
- Active task counter
- Quick action buttons

## Verification & Troubleshooting

### Installation Verification

**Check Extension Status**:
1. Open `Help → Developer Tools → Console`
2. Look for Vespera Forge initialization messages:
   ```
   [Extension Host] Vespera Forge activated in 45ms
   [BinderyService] Using mock mode for development
   ```

**UI Verification**:
1. **Activity Bar**: Vespera Forge icon should be visible
2. **Command Palette**: `Vespera Forge` commands should be available
3. **Status Bar**: Connection indicator should be present

### Common Issues

#### Extension Not Loading
```
Error: Extension 'vespera-atelier.vespera-forge' failed to activate
```

**Solutions**:
1. **Restart VS Code**: Close and reopen VS Code
2. **Check VS Code Version**: Ensure VS Code 1.95+ is installed
3. **Reinstall Extension**: Uninstall and reinstall the extension
4. **Check Error Logs**: Open Developer Tools for detailed error messages

#### Backend Connection Issues
```
[WARNING] Bindery backend not found, using mock mode
```

**Solutions**:
1. **Verify Path**: Check `vesperaForge.rustBinderyPath` setting
2. **Build Backend**: Ensure Bindery is compiled (`cargo build --release`)
3. **Check Permissions**: Verify executable permissions on Bindery binary
4. **Use Mock Mode**: Continue with mock mode for basic functionality

#### Performance Issues
```
Extension causing VS Code to be slow
```

**Solutions**:
1. **Memory Check**: Monitor VS Code memory usage
2. **Disable Auto-Start**: Set `vesperaForge.enableAutoStart` to `false`
3. **Restart Extension**: Disable and re-enable the extension
4. **Check Logs**: Look for excessive logging or error loops

### Getting Help

**Documentation**:
- [User Guide](basic-usage.md) - Getting started with features
- [Troubleshooting Guide](../development/building.md#troubleshooting) - Common issues and solutions

**Support Channels**:
- [GitHub Issues](https://github.com/vespera-atelier/vespera-atelier/issues) - Bug reports and feature requests
- [Discussions](https://github.com/vespera-atelier/vespera-atelier/discussions) - Questions and community help

**Diagnostic Information**:
When reporting issues, include:
```bash
# VS Code version
code --version

# Extension version  
code --list-extensions | grep vespera-forge

# System information
uname -a  # Linux/macOS
systeminfo | findstr /B /C:"OS Name" /C:"OS Version"  # Windows
```

## Uninstallation

### Remove Extension

**Via UI**:
1. Open Extensions view (`Ctrl+Shift+X`)
2. Find "Vespera Forge" in installed extensions
3. Click the gear icon → "Uninstall"
4. Reload VS Code when prompted

**Via Command Line**:
```bash
code --uninstall-extension vespera-atelier.vespera-forge
```

### Clean Uninstallation

**Remove Configuration**:
```bash
# Remove workspace settings (if desired)
rm .vscode/settings.json

# Clear VS Code user settings (manual)
# Remove vesperaForge.* entries from User Settings
```

**Remove Extension Data**:
VS Code automatically removes extension data, but you can manually clear:
- Extension storage (handled automatically)
- Log files (cleared on next restart)

## Next Steps

After successful installation:

1. **[Basic Usage Guide](basic-usage.md)** - Learn core features and workflows
2. **[Features Overview](features.md)** - Explore all available capabilities  
3. **[Integration Tips](../development/getting-started.md)** - Advanced usage and customization

---

**Welcome to Vespera Forge!** You now have a powerful AI-enhanced task orchestration system integrated directly into VS Code. Whether you're using mock mode for immediate productivity or the full Bindery backend for collaboration, you're ready to revolutionize your task management workflow.