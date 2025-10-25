# Development Environment Setup

This guide walks you through setting up Vespera Atelier for local development.

## Prerequisites

### Required Tools

**Node.js & Package Management:**
- Node.js 18+ (for VS Code extension)
- `pnpm` package manager (for monorepo workspace)

**Rust Toolchain:**
- Rust 1.70+ (for Bindery backend)
- `cargo` build tool

**Python:**
- Python 3.9+ (for MCP server)
- `pip` package manager

**Development Tools:**
- VS Code (for extension development)
- Git

### Optional But Recommended

- `ripgrep` (rg) - Fast file searching
- `jq` - JSON processing
- Rust clippy and rustfmt

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/vespera-atelier.git
cd vespera-atelier
```

**Note**: This is a **monorepo** with multiple packages. Check your current directory frequently when running commands.

### 2. Install pnpm (if needed)

```bash
npm install -g pnpm
```

### 3. Verify Current Directory

The monorepo has automatic directory switching configured. Always check where you are:

```bash
pwd  # Should show the monorepo root
```

## Package-Specific Setup

### VS Code Extension (Vespera Forge)

**Primary development focus**

```bash
# Navigate to extension directory
cd plugins/VSCode/vespera-forge

# Install dependencies
npm install

# Build
npm run compile

# Run tests
npm run test

# Watch mode for development
npm run watch
```

**Running the Extension:**
1. Open `plugins/VSCode/vespera-forge` in VS Code
2. Press `F5` to launch Extension Development Host
3. Test your changes in the new VS Code window

### Rust Backend (Bindery)

**Content management core**

```bash
# Navigate to Bindery directory
cd packages/vespera-utilities/vespera-bindery

# Build
cargo build

# Run tests
cargo test

# Run with logging
RUST_LOG=debug cargo run

# Format code
cargo fmt

# Lint
cargo clippy
```

### MCP Server (Vespera Scriptorium)

**FastMCP translation layer for Claude Code**

```bash
# Navigate to MCP server directory
cd packages/vespera-scriptorium

# Install dependencies
pip install -r requirements.txt

# Run server (for testing)
python3 mcp_server.py

# Run tests
pytest
python3 run_mcp_tests.py
```

**Claude Code Integration:**

```bash
# Add to user config (one-time)
claude mcp add -s user vespera-scriptorium python3 /path/to/vespera-atelier/packages/vespera-scriptorium/mcp_server.py

# In Claude Code session, reconnect:
/mcp reconnect vespera-scriptorium
```

## Monorepo Workflows

### Cross-Package Development

When making changes affecting multiple packages:

```bash
# From monorepo root
pnpm install       # Install all dependencies
pnpm build         # Build all packages
pnpm test          # Test all packages
```

### Git Worktrees (Optional)

This repo uses git worktrees for isolated development. See [CLAUDE.md](../../CLAUDE.md) for details.

## Development Database

### Bindery Database

The Rust backend uses SQLite. Database location:

```
.vespera/database.sqlite          # Workspace-specific
~/.vespera/projects-registry.json # Global registry (future)
```

**Reset Database:**
```bash
rm .vespera/database.sqlite
# Will be recreated on next run
```

## Common Issues

### "Module not found" in VS Code Extension

```bash
cd plugins/VSCode/vespera-forge
rm -rf node_modules package-lock.json
npm install
npm run compile
```

### Rust Bindery Won't Build

```bash
# Update Rust toolchain
rustup update

# Clean build
cd packages/vespera-utilities/vespera-bindery
cargo clean
cargo build
```

### MCP Server Connection Issues

```bash
# Check if server runs standalone
cd packages/vespera-scriptorium
python3 mcp_server.py

# Verify dependencies
pip install -r requirements.txt

# In Claude Code, reconnect
/mcp reconnect vespera-scriptorium
```

## Directory Structure Quick Reference

```
vespera-atelier/
├── plugins/
│   ├── VSCode/vespera-forge/      # ← VS Code extension development here
│   └── Obsidian/Vespera-Scriptorium/
├── packages/
│   ├── vespera-scriptorium/       # ← MCP server development here
│   └── vespera-utilities/
│       └── vespera-bindery/       # ← Rust backend development here
├── docs/                          # Documentation
├── .claude/                       # Claude Code configuration
├── CLAUDE.md                      # Development guidance
└── README.md                      # Project overview
```

## Useful Commands

### Check Package Versions

```bash
# Node.js
node --version

# pnpm
pnpm --version

# Rust
rustc --version
cargo --version

# Python
python3 --version
pip --version
```

### File Watching

**VS Code Extension:**
```bash
cd plugins/VSCode/vespera-forge
npm run watch  # Auto-recompile on changes
```

**Rust Backend:**
```bash
cd packages/vespera-utilities/vespera-bindery
cargo watch -x build -x test  # Requires cargo-watch
```

## Next Steps

1. **Read [CONTRIBUTING.md](CONTRIBUTING.md)** for workflow and conventions
2. **Check [Phase 17 Plan](../development/phases/PHASE_17_PLAN.md)** for current focus
3. **Explore [Architecture Docs](../architecture/core/)** for system design
4. **Run the tests** to verify setup

## Getting Help

- Check [CLAUDE.md](../../CLAUDE.md) for detailed monorepo guidance
- Review [ADRs](../development/decisions/) for architectural context
- Open an issue for setup problems not covered here

---

**Tip**: This is a complex monorepo. Don't be discouraged if setup takes time. The architecture docs will help you understand how pieces fit together.
