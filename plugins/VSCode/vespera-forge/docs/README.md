# Vespera Forge VS Code Extension Documentation

*AI-enhanced content management and task orchestration for VS Code with collaborative CRDT editing*

## Overview

Vespera Forge is a VS Code extension that provides seamless integration with the Vespera Atelier ecosystem, offering:

- **Task Orchestration**: Hierarchical task management with visual progress tracking
- **Bindery Integration**: Real-time collaborative CRDT editing via Rust backend
- **Native VS Code UI**: TreeView, Dashboard, StatusBar components following VS Code design patterns
- **Mock Development Mode**: Full functionality without Bindery backend for development

## Quick Start

### Installation

1. **Install the Extension**:
   ```bash
   # From VSIX package (recommended for beta)
   code --install-extension vespera-forge-0.0.1.vsix
   
   # Or from marketplace (when published)
   code --install-extension vespera-atelier.vespera-forge
   ```

2. **Initialize Vespera Forge**:
   - Open Command Palette (`Ctrl+Shift+P`)
   - Run `Vespera Forge: Initialize Vespera Forge`
   - The extension will auto-detect or prompt for Bindery configuration

3. **Start Managing Tasks**:
   - View the **Vespera Forge** panel in the Activity Bar
   - Access **Task Tree** and **Task Dashboard** views
   - Monitor status in the Status Bar

### Core Features

#### Task Management
- **Hierarchical Tasks**: Create parent-child task relationships
- **Visual Status**: Color-coded status icons (Todo, Doing, Done, etc.)
- **Context Menus**: Right-click tasks for quick actions
- **Real-time Updates**: Automatic synchronization with Bindery backend

#### Collaborative Editing
- **CRDT Integration**: Real-time collaborative editing via Bindery
- **Content Synchronization**: Seamless multi-user content management
- **Version Control**: Built-in versioning and conflict resolution

#### Native VS Code Integration
- **Activity Bar Panel**: Dedicated Vespera Forge workspace
- **Tree View**: Native hierarchical task display
- **Webview Dashboard**: Rich task analytics and management
- **Status Bar**: Connection and task status indicators

## Documentation Structure

### 📋 For Users
- **[Installation Guide](user-guide/installation.md)** - Setup and configuration
- **[Basic Usage](user-guide/basic-usage.md)** - Getting started workflows  
- **[Features Overview](user-guide/features.md)** - Complete feature reference

### 🛠️ For Developers
- **[Getting Started](development/getting-started.md)** - Development environment setup
- **[Building & Testing](development/building.md)** - Build process and testing strategies
- **[Architecture Overview](architecture/overview.md)** - System design and components

### 🏗️ Architecture & Design
- **[System Architecture](architecture/overview.md)** - High-level system design
- **[Integration Strategy](architecture/integration-layer.md)** - Bindery ↔ VS Code communication
- **[UI Components](architecture/ui-components.md)** - Native VS Code UI implementation

### 📚 API Reference
- **[Bindery Service API](api/bindery-service.md)** - Service layer reference
- **[UI Components](api/ui-components.md)** - Component APIs and interfaces

## Architecture Highlights

### Subprocess Communication Strategy
- **Choice Rationale**: Subprocess vs NAPI-RS for optimal development experience
- **Protocol**: JSON-RPC over stdin/stdout for robust IPC
- **Error Handling**: Graceful degradation with mock mode fallback

### TypeScript Implementation
- **Strict Typing**: Full type safety with comprehensive interfaces
- **Webpack Bundling**: Production-ready bundling with source maps
- **Testing Strategy**: Unit and integration tests with mock backends

### VS Code Native Components
- **TreeDataProvider**: Hierarchical task display with lazy loading
- **WebView Provider**: Rich dashboard with HTML/CSS/JS
- **StatusBar Integration**: Real-time connection and status indicators

## License & Legal

**License**: GNU Affero General Public License v3.0 (AGPL-3.0)

**Disclaimer**: This software is provided "as is" without warranty of any kind. Features described may change without notice in future versions. Always test in your specific environment before production use.

**Community**: Contributions welcome! See [development documentation](development/) for contribution guidelines.

---

*Part of the [Vespera Atelier](https://github.com/vespera-atelier/vespera-atelier) open-source ecosystem*