# Getting Started with Vespera Atelier

## Quick Start

For most users, the fastest way to get up and running:

```bash
# Clone the repository
git clone https://github.com/[username]/vespera-atelier
cd vespera-atelier

# One-command setup (installs everything and builds all packages)
pnpm setup

# Start the development server
pnpm dev
```

This will start the Vespera Scriptorium MCP server on the default port.

## Prerequisites

Make sure you have these installed:

- **Node.js 18+** with **pnpm 8+** (for TypeScript/JavaScript packages)
- **Python 3.8+** with **pip** (for the vespera-scriptorium MCP server)
- **Git** (for version control)

### Installing Prerequisites

#### Ubuntu/Debian
```bash
# Node.js and pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

# Python and pip (usually pre-installed)
sudo apt update && sudo apt install python3 python3-pip git
```

#### macOS
```bash
# Using Homebrew
brew install node pnpm python git
```

#### Windows
```bash
# Using Chocolatey
choco install nodejs pnpm python git

# Or download installers from:
# - Node.js: https://nodejs.org/
# - Python: https://python.org/
# - Git: https://git-scm.com/
```

## What's Included

This monorepo contains three main packages:

1. **vespera-scriptorium** (Python) - The core MCP task orchestrator server
2. **vespera-utilities** (Node.js) - Shared utilities and MCP tools
3. **vespera-scriptorium Obsidian Plugin** (TypeScript) - Document-centric workflows for Obsidian

## Package Architecture

```
vespera-atelier/
├── packages/
│   └── vespera-scriptorium/     # Python MCP server (pip managed)
├── vespera-utilities/           # Node.js utilities (pnpm workspace)
├── plugins/
│   └── Obsidian/
│       └── Vespera-Scriptorium/ # TypeScript Obsidian plugin (pnpm workspace)
└── package.json                 # Root workspace configuration
```

## Available Commands

### Global Commands (run from root)
```bash
pnpm install    # Install Node.js dependencies only
pnpm build      # Build all packages
pnpm test       # Run all tests
pnpm lint       # Lint all packages
pnpm format     # Format all code
pnpm clean      # Clean all build artifacts
pnpm setup      # Full setup: install + build everything
```

### Package-Specific Commands
```bash
# Vespera Scriptorium (Python)
pnpm build:scriptorium    # Build the MCP server
pnpm dev:scriptorium      # Start development server
pnpm test:scriptorium     # Run Python tests

# Vespera Utilities (Node.js)
pnpm build:utilities      # Build utilities
pnpm dev:utilities        # Start utilities development
pnpm test:utilities       # Run Node.js tests

# Obsidian Plugin (TypeScript)
pnpm build:obsidian       # Build Obsidian plugin
pnpm dev:obsidian         # Start plugin development
pnpm test:obsidian        # Run plugin tests
```

### Using Makefile (Alternative)
The repository also includes a Makefile for traditional workflow:
```bash
make install    # Install all dependencies
make build      # Build all packages
make test       # Run all tests
make clean      # Clean everything
```

## Integration with Claude Code

Once installed, you can add the MCP server to Claude Code:

```bash
# If vespera-scriptorium is installed globally
claude mcp add vespera-scriptorium vespera-scriptorium

# If running from development environment
claude mcp add vespera-scriptorium ./packages/vespera-scriptorium
```

## Troubleshooting

### pnpm install fails
- Make sure you have pnpm 8+ installed: `pnpm --version`
- Try clearing cache: `pnpm store prune`
- Delete node_modules and try again: `rm -rf node_modules pnpm-lock.yaml && pnpm install`

### Python dependencies fail
- Make sure Python 3.8+ is installed: `python --version`
- Upgrade pip: `pip install --upgrade pip`
- Install in development mode: `cd packages/vespera-scriptorium && pip install -e ".[dev]"`

### Build errors
- Check that all prerequisites are installed
- Run `pnpm clean` then `pnpm setup`
- Check individual package READMEs for specific requirements

### MCP server won't start
- Verify Python installation: `which python`
- Check if installed correctly: `vespera-scriptorium --help`
- Check logs in `packages/vespera-scriptorium/` for detailed error messages

## Development Workflow

1. **Clone and Setup** (once):
   ```bash
   git clone https://github.com/[username]/vespera-atelier
   cd vespera-atelier
   pnpm setup
   ```

2. **Daily Development**:
   ```bash
   pnpm dev  # Start development servers
   ```

3. **Before Committing**:
   ```bash
   pnpm lint     # Check code quality
   pnpm test     # Run tests
   pnpm format   # Format code
   ```

## Next Steps

- Check the main [README.md](README.md) for architecture details
- Read package-specific documentation in each package directory
- Explore the [PRPs](PRPs/) directory for development patterns
- Set up your Claude Code MCP integration

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/[username]/vespera-atelier/issues)
- **Discussions**: [GitHub Discussions](https://github.com/[username]/vespera-atelier/discussions)
- **Documentation**: [Claude Code MCP Guide](https://modelcontextprotocol.io/)

Welcome to the Vespera Atelier! 🎨✨