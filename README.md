# Vespera Atelier

> ✅ **STABILITY UPDATE** (2025-08-16) ✅  
> **All Known Critical Issues Fixed!** The recent comprehensive bug fix initiative has resolved all identified critical issues. The monorepo infrastructure is now stable and working correctly. However, as this is a complex system, **please consider it experimental** until further stress-testing has been performed. See [Completed Fixes](PRPs/completed/) for details on what was resolved.

**An intelligent platform for document-centric orchestration, task management, and creative workflows.**

## Overview

Vespera Atelier is a comprehensive monorepo containing the Vespera ecosystem of tools designed to support creative professionals, researchers, and knowledge workers. The platform combines task orchestration, document processing, and intelligent automation in a unified, flexible architecture.

## Architecture

### Packages
- **`vespera-scriptorium`** - Core MCP task orchestrator backend
- **`vespera-atelier`** - Platform coordination and shared services  
- **`vespera-utilities`** - Common utilities and shared components

### Applications
- **`scriptorium-cli`** - Command-line interface for task orchestration
- **`scriptorium-gui`** - Future graphical user interface

### Plugins
- **`obsidian/vespera-scriptorium`** - Obsidian plugin for document-centric workflows

## Quick Start

**New users**: See [GETTING_STARTED.md](GETTING_STARTED.md) for a complete setup guide.

## Installation Options

### MCP Server Only (Minimal)
```bash
npm install vespera-scriptorium
# OR
uv tool install vespera-scriptorium
```

### CLI Tools
```bash
npm install @vespera/scriptorium-cli
```

### Full Development Suite
```bash
git clone https://github.com/[username]/vespera-atelier
cd vespera-atelier
pnpm install
```

### Obsidian Plugin
Download from Obsidian Community Plugins or GitHub releases.

## Development

### Prerequisites
- Node.js 18+ with pnpm
- TypeScript 5+
- Git

### Setup

**Quick Start (Most Users):**
```bash
# Clone repository
git clone https://github.com/[username]/vespera-atelier
cd vespera-atelier

# Install all dependencies and build packages
pnpm setup

# Start development server
pnpm dev
```

**Step-by-Step Setup:**
```bash
# Clone repository
git clone https://github.com/[username]/vespera-atelier
cd vespera-atelier

# Install Node.js dependencies for workspace packages
pnpm install

# Install Python dependencies for vespera-scriptorium
cd packages/vespera-scriptorium
pip install -e ".[dev]"
cd ../..

# Build all packages
pnpm build

# Run development servers
pnpm dev
```

**Prerequisites:**
- Node.js 18+ with pnpm 8+
- Python 3.8+ with pip
- Git

### Development Scripts
```bash
# Build everything
pnpm build

# Run tests
pnpm test

# Lint and format
pnpm lint
pnpm format

# Type checking
pnpm typecheck
```

## Project Structure

```
vespera-atelier/
├── packages/
│   ├── vespera-scriptorium/      # Backend MCP server
│   ├── vespera-atelier/          # Platform core
│   └── vespera-utilities/        # Shared utilities
├── apps/
│   ├── scriptorium-cli/          # CLI interface
│   └── scriptorium-gui/          # GUI interface (future)
├── plugins/
│   └── obsidian/
│       └── vespera-scriptorium/  # Obsidian plugin
├── tools/
│   ├── build-scripts/            # Build automation
│   ├── dev-tools/                # Development utilities
│   └── config/                   # Shared configurations
└── docs/                         # Documentation
```

## Features

### Task Orchestration
- Multi-agent coordination with specialist roles
- Clean Architecture with Domain-Driven Design
- Persistent task management and progress tracking
- Git worktree isolation for complex workflows

### Document Processing
- Advanced document chunking and processing
- Intelligent content extraction and analysis
- Integration with Obsidian for knowledge management
- Multi-format document support

### MCP Integration
- Full Model Context Protocol server implementation
- Compatible with Claude Desktop, Cursor, VS Code, and other MCP clients
- Dual-mode architecture: server and consumer modes
- Package import for custom integrations

### Executive Dysfunction Support
- Pre-planned task sequences to reduce decision paralysis
- Multiple progress tracking granularities
- Automated workflow preservation
- Context-aware development patterns

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

**Why AGPL-3.0?** We believe in keeping creative tools and AI advancements open-source. The AGPL ensures that all improvements, even those used in web services, remain available to the community. This prevents corporate appropriation while encouraging collaborative innovation.

## Links

- **Documentation**: [Coming Soon]
- **Issues**: [GitHub Issues](https://github.com/[username]/vespera-atelier/issues)
- **Discussions**: [GitHub Discussions](https://github.com/[username]/vespera-atelier/discussions)
- **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io/)

## Acknowledgments

- Built with [Claude Code](https://claude.ai/code) assistance
- Inspired by Clean Architecture and Domain-Driven Design principles
- Part of the broader Vespera ecosystem of creative productivity tools

---

**Vespera Atelier** - Where ideas become reality through intelligent orchestration.