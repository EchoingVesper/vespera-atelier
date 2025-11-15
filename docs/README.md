# Vespera Atelier Documentation

Welcome to the Vespera Atelier documentation - a comprehensive guide to building intelligent creative workspaces with project-centric organization, dynamic templates, and hierarchical content management.

---

## ⚠️ Documentation Status (Phase 15 - October 2025)

This documentation reflects the **current Phase 15 architecture** following a major documentation audit and restructure. Many aspirational features described in legacy docs are **not yet implemented**.

**What Exists Now**:
- ✅ Project-centric architecture with mandatory projects
- ✅ Dynamic template system (JSON5-based)
- ✅ Codex nesting (Scrivener-style folders)
- ✅ VS Code extension with Navigator and Chat UI
- ✅ FastMCP server with Bindery backend integration

**Planned Features** (see `legacy/future-features/`):
- ❌ Tag-driven automation system
- ❌ LLM-assisted rule creation
- ❌ Cross-codex automation chains
- ❌ Real-time reactive workflows

---

## 📚 Documentation Structure

### 📖 Quick Start

- **[Getting Started](./quickstart/GETTING_STARTED.md)** - Installation and first steps
- **[Quick Reference](./quickstart/)** - Common commands and workflows

### 🏛️ Architecture

Comprehensive technical specifications organized by category:

#### Core Architecture (`architecture/core/`)

Foundation documents for the system:

- **[Project-Centric Architecture](./architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md)** ⭐
  - Projects as fundamental entities
  - Multi-project workspace management
  - Project context switching

- **[Hierarchical Template System](./architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md)** ⭐
  - Dynamic JSON5-based templates
  - Template categories and inheritance
  - User-extensible content types

- **[Codex Nesting](./architecture/core/CODEX_NESTING.md)** ⭐
  - Scrivener-style folder-documents
  - Unlimited hierarchical organization
  - Folders with content

- **[Codex Architecture](./architecture/core/CODEX_ARCHITECTURE.md)**
  - Universal content model
  - Template-driven behavior
  - Metadata and frontmatter

- **[Template System Architecture](./architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)**
  - Template loading and validation
  - Field definitions and view modes
  - Workflow states and actions

- **[Multi-Project Vault Organization](./architecture/core/MULTI_PROJECT_VAULT_ORGANIZATION.md)**
  - Managing multiple projects in one vault
  - Project-aware content filtering
  - Cross-project references

- **[UI Architecture Three-Panel Design](./architecture/core/UI-Architecture-Three-Panel-Design.md)**
  - Three-panel layout (Navigator, Editor, Context)
  - Immersive environment adaptation
  - UI component structure

- **[Dynamic Automation Architecture](./architecture/core/DYNAMIC_AUTOMATION_ARCHITECTURE.md)** 🔮
  - Tag-driven automation (planned)
  - LLM-assisted rule creation (planned)
  - Cross-codex chains (planned)

- **[Event System Specification](./architecture/core/EVENT_SYSTEM_SPECIFICATION.md)** 🔮
  - Real-time event processing (planned)
  - Event routing and handling (planned)

#### Subsystems (`architecture/subsystems/`)

Specialized components and integrations:

- **[MCP Bindery Architecture](./architecture/subsystems/MCP_BINDERY_ARCHITECTURE.md)** - FastMCP server and Rust backend
- **[Task Execution Architecture](./architecture/subsystems/TASK_EXECUTION_ARCHITECTURE.md)** - Task management system
- **[LLM Provider Architecture](./architecture/subsystems/llm-provider-architecture.md)** - Chat provider integration
- **[Background Services Architecture](./architecture/subsystems/background-services-architecture.md)** - Service lifecycle
- **[Hook Agent System](./architecture/subsystems/HOOK_AGENT_SYSTEM_IMPLEMENTATION.md)** - Agent coordination
- **[Rust Module Architecture](./architecture/subsystems/RUST_MODULE_ARCHITECTURE.md)** - Bindery backend details
- **[Triple Database Implementation](./architecture/subsystems/triple-database-implementation.md)** - Storage layer

#### Integration (`architecture/integration/`)

- **[API Overview](./architecture/integration/api-overview.md)** - Public API surface

#### Testing (`architecture/testing/`)

- **[Testing Enhancements](./architecture/testing/testing-enhancements.md)** - Test infrastructure
- **[Testing Validation Report](./architecture/testing/testing-validation-report.md)** - Test coverage

### 🎯 Examples

Practical examples and patterns:

- **[Automation Rule Examples](./examples/AUTOMATION_RULE_EXAMPLES.md)** 🔮 - Tag-driven automation patterns (planned)
- **[Template Hook Agent Examples](./examples/TEMPLATE_HOOK_AGENT_EXAMPLES.md)** - Agent integration examples

### 📝 Guides

#### User Guides (`guides/users/`)

Coming soon - practical guides for end users

#### Developer Guides (`guides/developers/`)

Coming soon - implementation guides for developers

### 🤝 Contributing

Resources for contributors:

- **[Contributing Guide](./contributing/CONTRIBUTING.md)** - How to get involved
- **[Development Setup](./contributing/SETUP.md)** - Environment configuration
- **[AI Style Guide](./contributing/AI_STYLE_GUIDE.md)** - Documentation standards for AI agents

### 🔧 Development

#### Architecture Decision Records (`development/decisions/`)

Significant architectural decisions with context and rationale:

- **[ADR-001: Projects as Fundamental](./development/decisions/ADR-001-projects-fundamental.md)** ✅
- **[ADR-004: Dynamic Template System](./development/decisions/ADR-004-dynamic-templates.md)** ✅
- **[ADR-007: Codex-Based Folders](./development/decisions/ADR-007-codex-folders.md)** ✅
- [See full ADR index](./development/decisions/README.md)

#### Phase Tracking (`development/phases/`)

Development progress organized by implementation phase:

- Phase 1-3: Initial Bindery backend and MCP integration
- Phase 12-13: Chat system integration
- **Phase 14**: LLM architecture and UI integration (current)
- **Phase 15**: Documentation audit and project-centric refactor (in progress)

#### Development Reports (`development/reports/`)

Technical investigations, integration summaries, and post-mortems

#### Environment Setup (`development/environment/`)

Worktree configurations, build setups, development workflows

### 📚 Reference

#### Glossary (`reference/GLOSSARY.md`)

Comprehensive terminology reference - coming soon

### 🔮 Legacy Documentation

#### Future Features (`legacy/future-features/`)

Aspirational documentation for planned features:

- **[Getting Started with Automation](./legacy/future-features/GETTING_STARTED_AUTOMATION.md)** ⚠️ - Describes unimplemented automation
- **[Real-World Integration Scenarios](./legacy/future-features/REAL_WORLD_INTEGRATION_SCENARIOS.md)** ⚠️ - Aspirational use cases
- **[V2 Quick Start](./v2-quick-start.md)** ⚠️ - Describes partially implemented V2 features
- **[V2 MCP Tools Reference](./v2-mcp-tools-reference.md)** ⚠️ - Aspirational tool specifications
- **[V2 Role System Guide](./v2-role-system-guide.md)** ⚠️ - Unimplemented role system

---

## 🚀 Quick Navigation

### New to Vespera Atelier?

1. **[Getting Started Guide](./quickstart/GETTING_STARTED.md)** - Install and set up
2. **[Project-Centric Architecture](./architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md)** - Understand the core concept
3. **[Hierarchical Template System](./architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md)** - Learn about content types

### Implementing Features?

1. **[Architecture Decision Records](./development/decisions/README.md)** - Understand design decisions
2. **[Core Architecture](./architecture/core/)** - Read relevant architectural docs
3. **[Phase Tracking](./development/phases/)** - Check current development status

### Contributing?

1. **[Contributing Guide](./contributing/CONTRIBUTING.md)** - How to contribute
2. **[Development Setup](./contributing/SETUP.md)** - Environment configuration
3. **[AI Style Guide](./contributing/AI_STYLE_GUIDE.md)** - Documentation standards for AI agents
4. **[Current Phase Status](./development/phases/)** - See what's in progress
5. **[ADR Template](./development/decisions/ADR-TEMPLATE.md)** - Document new decisions

---

## 🎯 Core Concepts

### Projects are Fundamental

Everything in Vespera Atelier exists within a **Project** context. Projects organize content, filter templates, and provide clear boundaries for creative work.

### Dynamic Templates

Templates are JSON5 files that define content types. No hardcoded types means users can create custom templates for any workflow.

### Codex Nesting

Like Scrivener, Codices can contain both content AND children. Chapters can have summaries and contain Scenes. Folders are just Codices with children.

### Template-Driven UI

The UI adapts to templates - field layouts, view modes, and actions all defined in template files.

---

## 📊 Implementation Status

### Phase 15 (Current): Documentation & Architecture

**Goals**:
- ✅ Clean up documentation structure
- ✅ Create foundation architecture documents
- ✅ Add implementation warnings to aspirational docs
- ✅ Establish ADR system
- 🚧 Update documentation hub (in progress)

**Next**: Phase 16 will implement the project-centric refactor

### Recent Phases

- **Phase 14**: LLM provider integration, Chat UI, Navigator improvements
- **Phase 13**: Chat system fixes and template initialization
- **Phase 12**: Chat provider architecture

---

## 🔗 Related Documentation

### Monorepo Context

- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - High-level system overview
- **[CLAUDE.md](../CLAUDE.md)** - Claude Code development instructions
- **[README.md](../README.md)** - Project introduction

### Package-Specific

- **[Vespera Forge VS Code Extension](../plugins/VSCode/vespera-forge/)** - Extension implementation
- **[Vespera Scriptorium MCP Server](../packages/vespera-scriptorium/)** - Backend server
- **[PRPs Framework](../PRPs/)** - Product Requirement Prompts

---

## 🌟 Vision

Vespera Atelier aims to create intelligent creative workspaces where:

- **Projects organize everything** - Clear context, reduced clutter
- **Templates define workflows** - User-extensible, project-aware
- **Content nests naturally** - Scrivener-style hierarchies
- **Automation reacts to changes** - Future: Tag-driven workflows

We're building tools that don't just store content, but understand its structure and adapt to creative workflows.

---

## 📝 Documentation Conventions

### Status Indicators

- ⭐ **Start here** - Essential reading
- ✅ **Implemented** - Feature exists and works
- 🚧 **In progress** - Currently being implemented
- 🔮 **Planned** - Designed but not yet implemented
- ⚠️ **Warning** - Describes unimplemented features

### Document Organization

- **Core** - Foundation concepts everyone should know
- **Subsystems** - Specialized components for specific features
- **Integration** - APIs and interfaces between systems
- **Testing** - Quality assurance and validation

---

*Last Updated: Phase 15 - October 2025*
