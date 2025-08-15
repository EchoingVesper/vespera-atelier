# CLAUDE.md - Vespera Atelier Monorepo

This file provides guidance to Claude Code when working in the Vespera Atelier monorepo.

## 🏗️ Monorepo Structure

This is a **monorepo** containing multiple interconnected packages:

```
vespera-atelier/
├── packages/
│   ├── vespera-scriptorium/    # MCP task orchestrator backend
│   ├── vespera-atelier/        # Platform coordination services
│   └── vespera-utilities/      # Shared utility functions
├── plugins/
│   └── Obsidian/
│       └── Vespera-Scriptorium/ # Obsidian plugin frontend
├── apps/                        # Future applications
├── PRPs/                        # Product Requirement Prompts
└── .claude/                     # Claude Code configuration
```

## 🎯 Working in the Monorepo

### Package-Specific Development

When working on a specific package:
```bash
# Navigate to package
cd packages/vespera-scriptorium

# Install dependencies
pip install -e .

# Run tests
pytest tests/
```

### Cross-Package Development

When making changes across multiple packages:
```bash
# Use workspace commands from root
pnpm build           # Build all packages
pnpm test           # Test all packages
pnpm scriptorium:dev # Run specific package
```

## 🔧 MCP Server Configuration

### Vespera Scriptorium (Task Orchestrator)

The main MCP server is in `packages/vespera-scriptorium/`:

```bash
# Install and run from monorepo root
cd packages/vespera-scriptorium
pip install -e .
vespera-scriptorium --help

# Or use Claude Code MCP integration
claude mcp add vespera-scriptorium ./packages/vespera-scriptorium
```

### Critical Directives from Original

#### ***CRITICAL***: Task Orchestrator Failure Protocol

**If the MCP Task Orchestrator ever fails to function:**

1. **STOP** - Do not proceed with current task
2. **DIAGNOSE** - Check MCP connection and health
3. **FIX** - Follow procedures in `PRPs/protocols/orchestrator-fix-protocol.md`
4. **VERIFY** - Test with `orchestrator_health_check` tool
5. **RESUME** - Only continue after verification

#### ***CRITICAL***: Git Commit After Every Task

**After completing ANY development task:**

1. **ALWAYS** review changes: `git status && git diff`
2. **COMMIT** with descriptive message
3. Include package scope in commit: `feat(scriptorium): description`
4. Never leave uncommitted changes between tasks

## 📦 Package Management

### Python Packages (vespera-scriptorium)

```bash
# Development installation
cd packages/vespera-scriptorium
pip install -e ".[dev]"

# Run tests
pytest tests/

# Linting and formatting
black mcp_task_orchestrator/
isort mcp_task_orchestrator/
```

### Node.js Packages (future)

```bash
# Install workspace dependencies
pnpm install

# Build all packages
pnpm build

# Run specific package commands
pnpm --filter vespera-atelier dev
```

## 🏛️ Architecture Patterns

### Dual-Mode Architecture

Vespera Scriptorium implements three operational modes:

1. **MCP Server Mode**: Standalone server for Claude Code
2. **CLI Consumer Mode**: Command-line interface for direct usage
3. **Package Import Mode**: Library for other packages (e.g., Obsidian plugin)

### Clean Architecture

All packages follow Clean Architecture principles:
- **Domain Layer**: Core business logic
- **Application Layer**: Use cases and workflows
- **Infrastructure Layer**: External integrations
- **Presentation Layer**: User interfaces

## 📋 Development Commands

### Essential Commands

```bash
# Monorepo-wide operations
pnpm install              # Install all dependencies
pnpm build               # Build all packages
pnpm test                # Run all tests
pnpm lint                # Lint all packages

# Package-specific operations
cd packages/vespera-scriptorium
pytest                   # Run Python tests
black .                  # Format Python code
mypy .                   # Type checking

# Git operations
git add packages/        # Stage package changes
git commit -m "feat(monorepo): description"
```

### Testing Commands

```bash
# Unit tests
pytest tests/unit/ -v

# Integration tests
pytest tests/integration/ -v

# E2E tests
pytest tests/e2e/ -v

# With coverage
pytest --cov=mcp_task_orchestrator --cov-report=html
```

## 🔗 Cross-References

### Package-Specific Documentation

- **Vespera Scriptorium**: `packages/vespera-scriptorium/CLAUDE.md`
- **PRPs Framework**: `PRPs/CLAUDE.md`
- **Meta-PRP Transition**: `PRPs/vespera-scriptorium-transition/README.md`

### Key Concepts

- **Task Orchestrator**: Core orchestration engine for AI agent coordination
- **PRP Framework**: Product Requirement Prompts for systematic development
- **Executive Dysfunction Support**: Design patterns for momentum preservation
- **Git Worktree Strategy**: Isolated development environments

## 🚀 Quick Start

1. **Clone and Setup**:
   ```bash
   cd /home/aya/dev/monorepo/vespera-atelier
   pnpm install
   ```

2. **Install Vespera Scriptorium**:
   ```bash
   cd packages/vespera-scriptorium
   pip install -e ".[dev]"
   ```

3. **Configure Claude Code**:
   ```bash
   claude mcp add vespera-scriptorium ./packages/vespera-scriptorium
   claude mcp list | grep vespera
   ```

4. **Start Development**:
   ```bash
   # Run MCP server
   vespera-scriptorium --server
   
   # Or use CLI
   vespera-scriptorium-cli --help
   ```

## 🎨 Vision

The Vespera Atelier is an ecosystem of intelligent tools for creative professionals, researchers, and knowledge workers. Each package serves a specific role while working together through shared interfaces and the central orchestration engine.

## 📝 Important Notes

- **Monorepo Coordination**: Changes affecting multiple packages should be atomic commits
- **Package Independence**: Each package should be independently installable
- **Shared Dependencies**: Use workspace protocol for internal dependencies
- **Version Management**: Coordinate versions across packages for releases

## 🔒 License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
All packages in this monorepo share this license to ensure open-source collaboration.

---

**Remember**: This is a monorepo. Think in terms of packages, workspaces, and coordinated development.