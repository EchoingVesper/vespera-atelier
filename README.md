# Vespera Atelier

> 🚧 **V2 GROUND-UP REWRITE IN PROGRESS** (2025-08-18) 🚧  
> **Major Architectural Transition**: V2 represents a complete rewrite based on lessons learned. V1 is archived but functional. **Current V1 orchestrator session active** - see transition strategy below.

**An intelligent platform for document-centric orchestration, task management, and creative workflows.**

## ⚠️ Transition Status

**Current State**: V1 fully functional, V2 rewrite active via meta-PRP coordination  
**V1 Archive**: Branch `archive/v1-legacy` (tag: `v1-archive-20250818`)  
**Active Session**: `session_16affafc_1755499003` coordinating V2 development  
**Orchestrator**: V1 orchestrator managing V2 transition to preserve continuity

### Preservation Strategy

The V1 orchestrator system remains active to coordinate the V2 rewrite process. This ensures:
- Current orchestrator session continues managing transition tasks
- No loss of active task coordination during rewrite
- Systematic migration of proven patterns to V2 architecture
- Continuous project management capabilities

## Overview

Vespera Atelier is transitioning from V1 (hybrid architecture) to V2 (Clean Architecture with modular microservices). V2 implements a "repository of information with automatic organization" and "Discord for LLMs" based on comprehensive planning and lessons learned.

## Architecture Transition

### V1 Architecture (Current - archive/v1-legacy)
- **Packages**: `vespera-scriptorium` (hybrid architecture)
- **Status**: Archived but functional, managing V2 transition
- **Orchestrator**: Active session coordinating rewrite

### V2 Architecture (Target - In Development)
- **Clean Architecture**: Domain/Application/Infrastructure layers
- **Modular Backend**: `scriptorium/` with microservices
- **Triple Database**: SQLite + KuzuDB (graph) + Chroma (vector)
- **Dual Plugins**: Obsidian + VS Code integration
- **Role System**: Capability restrictions (Roo Code-inspired)
- **Local-First**: Embedded databases, local LLMs preferred

## Quick Start

### V1 (Current Functional Version)
**Archived but stable**: Use `archive/v1-legacy` branch for functional system

```bash
git checkout archive/v1-legacy
# Follow setup in that branch
```

### V2 Development (In Progress)
**Active development**: Meta-PRP coordination in progress  
**Status**: Foundation phase - not ready for use  
**Coordination**: [PRPs/in-progress/vespera-v2-ground-up-rewrite/](PRPs/in-progress/vespera-v2-ground-up-rewrite/)

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

## V2 Vision & Features (Target)

### Core Vision
**"Repository of information with automatic organization"** + **"Discord for LLMs"**

### Enhanced Task Orchestration
- **Hierarchical Tasks**: Replace sessions with recursive task breakdown
- **Role-Based Execution**: Capability restrictions prevent agent overreach
- **Multi-LLM Coordination**: Local-first with API fallbacks
- **Comprehensive Tracking**: All interactions, changes, decisions recorded

### Intelligence Layer
- **Vector Search**: Semantic document discovery (Chroma)
- **Graph Relationships**: Project structure mapping (KuzuDB)
- **Automatic Hooks**: Context loading based on file types/patterns
- **Workflow Automation**: Template-driven task spawning

### Creative Suite Integration
- **Multi-Modal Projects**: Code, writing, design, audio/video
- **Asset Management**: Comprehensive creative asset tracking
- **Cross-Tool Workflows**: Obsidian ↔ VS Code ↔ Creative tools
- **Human-Readable Organization**: Dual structure (human + LLM optimized)

### Executive Dysfunction Support (Enhanced)
- **Pre-Structured Environments**: No decision paralysis
- **Automated Preservation**: Work survives sleep/restart cycles
- **Progressive Disclosure**: Context delivered at the right time
- **Multiple Granularities**: Progress tracking at user's preferred level

## Contributing to V2 Development

V2 development uses systematic meta-PRP coordination:

### Development Process
1. **Meta-PRP Framework**: Systematic development via [PRPs/in-progress/vespera-v2-ground-up-rewrite/](PRPs/in-progress/vespera-v2-ground-up-rewrite/)
2. **Orchestrator Coordination**: V1 orchestrator managing V2 tasks
3. **Git Worktree Strategy**: Isolated environments for parallel development
4. **Specialist Agents**: Architecture, coding, testing specialists

### Current Phase
**Phase 1: Foundation (Weeks 1-2)**
- Clean Architecture implementation
- Database abstraction layer
- Plugin communication protocol
- Core API structure

### Get Involved
1. Review active meta-PRP coordination
2. Contribute to specific priority areas
3. Test V1 functionality during transition
4. Provide feedback on V2 architectural decisions

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

**Why AGPL-3.0?** We believe in keeping creative tools and AI advancements open-source. The AGPL ensures that all improvements, even those used in web services, remain available to the community. This prevents corporate appropriation while encouraging collaborative innovation.

## Key Documentation

### Transition Planning
- **Vision Planning**: [VESPERA_VISION_PLANNING_WORKSHEET.md](VESPERA_VISION_PLANNING_WORKSHEET.md)
- **Architecture Decisions**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Active Meta-PRP**: [PRPs/in-progress/vespera-v2-ground-up-rewrite/](PRPs/in-progress/vespera-v2-ground-up-rewrite/)

### V1 References
- **V1 Codebase**: [archive/v1-legacy branch](https://github.com/EchoingVesper/vespera-atelier/tree/archive/v1-legacy)
- **Archive Tag**: `v1-archive-20250818`
- **PRP System**: [PRPs/README.md](PRPs/README.md) (proven and preserved)

### External Links
- **Issues**: [GitHub Issues](https://github.com/EchoingVesper/vespera-atelier/issues)
- **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io/)
- **Inspiration**: [Roo Code](https://github.com/roocode-org/roocode)

## Acknowledgments

- Built with [Claude Code](https://claude.ai/code) assistance
- Inspired by Clean Architecture and Domain-Driven Design principles
- Part of the broader Vespera ecosystem of creative productivity tools

---


**Vespera Atelier V2** - Building the future of creative project orchestration  
**Status**: V1 archived, V2 rewrite coordinated by active orchestrator session  
**Timeline**: Foundation complete by end of 2025 Q1
