# Vespera Atelier

A template-driven creative project management system, currently in early development.

## What This Is (and Isn't)

Vespera Atelier is an attempt to build a universal project management tool that adapts to different types of creative work through templates. Whether you're writing a novel, building a game, conducting research, or managing code - the goal is to have one system that transforms to fit your needs.

**Current Reality**: This is a solo development project in active construction. The vision is ambitious, the implementation is incremental. Many features are planned but not yet built.

**What Works Now** (Phase 16b):
- Basic VS Code extension (Vespera Forge)
- Project creation and management
- Template-driven content types (Codices)
- Rust backend for storage (Bindery)

**What's Being Built** (Phase 17):
- Codex editor and viewer
- Multi-context project organization
- Better template filtering

**What's Planned** (Future):
- Obsidian plugin
- Template browser and sharing
- AI-assisted workflows
- Collaborative editing

## Why This Exists

I built this to solve my own problems with managing creative projects while dealing with executive dysfunction (ADHD + autism). The design philosophy comes from trying to create tools that work when you're tired, overwhelmed, or struggling - not just when you're at peak performance.

That philosophy is documented in [docs/philosophy/pressure-lid-metaphor.md](docs/philosophy/pressure-lid-metaphor.md), which explains the "cognitive accessibility first" approach.

**The Chameleon Idea**: Instead of having separate tools for fiction writing, game development, research, etc., templates let the same system adapt. A game project might have Story, Research, Code, and Art contexts - all in one place. That's the goal, anyway.

## ⚠️ Development Status

**Use at Your Own Risk**
- Active early development by solo developer
- Breaking changes expected
- Features may be incomplete or buggy
- Not recommended for production use
- Documentation may be ahead of implementation

See [docs/development/phases/](docs/development/phases/) for detailed progress tracking.

## Architecture Overview

**Monorepo Structure:**
```
vespera-atelier/
├── plugins/
│   ├── VSCode/vespera-forge/      # VS Code extension (primary focus)
│   └── Obsidian/Vespera-Scriptorium/  # Obsidian plugin (planned)
├── packages/
│   ├── vespera-scriptorium/       # MCP server for Claude Code
│   └── vespera-utilities/
│       └── vespera-bindery/       # Rust backend for content management
└── docs/                          # Architecture and development docs
```

**Tech Stack:**
- **Frontend**: TypeScript, React, VS Code Extension API
- **Backend**: Rust (Bindery), SQLite
- **Integration**: FastMCP server for AI assistant integration
- **Future**: Vector + Graph databases for RAG

## Getting Started

### For Users

Not ready for general use yet. Check back when Phase 17+ is complete.

### For Developers

Want to contribute or explore the codebase?

1. **Read First:**
   - [CLAUDE.md](CLAUDE.md) - Monorepo guidance and structure
   - [docs/architecture/](docs/architecture/core/) - System design
   - [docs/development/decisions/](docs/development/decisions/) - Key architectural decisions

2. **Setup:**
   See [docs/contributing/SETUP.md](docs/contributing/SETUP.md) for development environment setup.

3. **Contributing:**
   See [docs/contributing/CONTRIBUTING.md](docs/contributing/CONTRIBUTING.md) for contribution guidelines.

**Current Focus**: Implementing the codex editor (Phase 17)

## Core Concepts

**Codices**: Universal file containers with metadata. Wrap any file type (markdown, code, images, audio, etc.) with tags, relationships, and project context. Managed by both the task system and AI RAG system.

**Templates**: Define project types and content structures. Written in JSON5, user-extensible without code changes. Categories include projects, content types, organizational structures, and AI agents.

**Projects & Contexts**: Real-world projects (e.g., "My Game") contain multiple organizational contexts (Story, Research, Code, Art). Same content can appear in different contexts with different organization.

**Cognitive Accessibility**: Design philosophy focused on reducing friction and working with human limitations. Based on personal experience with executive dysfunction. See [docs/philosophy/](docs/philosophy/) for details.

## Documentation

- **[Documentation Hub](docs/README.md)** - Complete documentation navigation
- **[Architecture Docs](docs/architecture/core/)** - Technical specifications and design
- **[ADRs](docs/development/decisions/)** - Architecture Decision Records
- **[Philosophy](docs/philosophy/)** - Design principles and motivation
- **[Phase Reports](docs/development/phases/)** - Development progress tracking
- **[Glossary](docs/reference/GLOSSARY.md)** - Key concepts and terminology

## The Bigger Picture

The long-term vision is a "chameleon" tool that transforms based on project needs, with:
- Template marketplace where users share project types
- Universal file management that indexes and organizes any content
- AI-assisted workflows that break down complex projects
- Collaborative editing with CRDT support

That's years of work. Right now, I'm focused on getting the basic editor working.

## Contributing

Contributions welcome, but be aware this is early-stage development with frequent breaking changes. See [docs/contributing/CONTRIBUTING.md](docs/contributing/CONTRIBUTING.md).

## License

GNU Affero General Public License v3.0 (AGPL-3.0)

---

*Built incrementally by someone who needs it to exist*
