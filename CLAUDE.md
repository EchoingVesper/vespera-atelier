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
├── docs/                        # Comprehensive architecture documentation
│   ├── README.md               # Documentation hub and navigation
│   ├── architecture/           # Core system architecture documents
│   │   ├── core/              # Foundation architecture (9 docs)
│   │   │   ├── PROJECT_CENTRIC_ARCHITECTURE.md      # Projects as fundamental
│   │   │   ├── HIERARCHICAL_TEMPLATE_SYSTEM.md      # Dynamic template system
│   │   │   ├── CODEX_NESTING.md                     # Scrivener-style folders
│   │   │   ├── CODEX_ARCHITECTURE.md                # Universal content system
│   │   │   ├── TEMPLATE_SYSTEM_ARCHITECTURE.md      # Template implementation
│   │   │   ├── DYNAMIC_AUTOMATION_ARCHITECTURE.md   # Automation (planned)
│   │   │   └── ...
│   │   ├── subsystems/        # Specialized components (7 docs)
│   │   ├── integration/       # API specifications
│   │   └── testing/           # Test infrastructure
│   ├── development/           # Development tracking and decisions
│   │   ├── decisions/         # Architecture Decision Records (ADRs)
│   │   ├── phases/            # Phase completion reports
│   │   ├── reports/           # Technical investigations
│   │   └── environment/       # Development setup
│   ├── examples/              # Automation rule examples
│   ├── guides/                # User and developer guides
│   ├── reference/             # Glossary and references
│   └── legacy/                # Aspirational/unimplemented docs
└── .claude/                     # Claude Code configuration
```

## 🎯 Working in the Monorepo

### ⚠️ Important: Automatic Directory Switching

**Claude Code automatically switches to `packages/vespera-scriptorium` as the working directory** due to workspace configuration:

- **Primary workspace**: Set to `packages/vespera-scriptorium` in `.claude/config.json`
- **Behavior**: Commands often execute from this directory automatically
- **Root operations**: Use explicit paths when working from monorepo root

```bash
# If you need monorepo root context, be explicit:
cd /home/aya/dev/monorepo/vespera-atelier && [your command]

# Or use absolute paths:
ls /home/aya/dev/monorepo/vespera-atelier/PRPs/

# Check current directory when in doubt:
pwd
```

### Package-Specific Development

When working on a specific package:
```bash
# Navigate to package (or Claude Code may auto-switch here)
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

### Vespera Scriptorium (Bindery Integration)

The MCP server is in `packages/vespera-scriptorium/` using FastMCP as a translation layer to the Rust Bindery backend:

```bash
# Install dependencies
cd packages/vespera-scriptorium
pip install -r requirements.txt

# Run MCP server directly (for testing)
python3 mcp_server.py

# Claude Code MCP integration (configured in user scope)
# Add to user config:
claude mcp add -s user vespera-scriptorium python3 /path/to/vespera-atelier/packages/vespera-scriptorium/mcp_server.py

# Reconnect in active session:
# Use the /mcp reconnect vespera-scriptorium command in Claude Code
```

**MCP Features:**
- **14 comprehensive MCP tools** for complete Bindery integration
- **Task management**: create_task, get_task, update_task, list_tasks, delete_task, complete_task, execute_task
- **Project management**: create_project
- **Role system**: assign_role_to_task, list_roles
- **Search & indexing**: search_entities, index_document
- **Monitoring**: get_dashboard_stats, health_check
- **FastMCP implementation** using official MCP Python SDK
- **Translation layer** to Rust Bindery backend via HTTP

### Critical Directives from Original

#### ***CRITICAL***: MCP Server Failure Protocol

**If the Vespera Scriptorium MCP server ever fails to function:**

1. **STOP** - Do not proceed with current task
2. **DIAGNOSE** - Check MCP connection and health:
   ```bash
   # Check if server is configured
   cat ~/.claude.json | grep -A 5 vespera-scriptorium

   # Test server directly
   cd packages/vespera-scriptorium
   python3 mcp_server.py
   ```
3. **FIX** - Ask user to reconnect MCP server:
   - User must run `/mcp reconnect vespera-scriptorium` in Claude Code
   - Claude Code cannot restart servers programmatically
4. **VERIFY** - Test with `mcp__vespera-scriptorium__health_check` tool
5. **RESUME** - Only continue after verification

**MCP Tools Available:**
- Task management: create_task, get_task, update_task, delete_task, list_tasks
- Task execution: complete_task, execute_task, assign_role_to_task
- Project management: create_project
- Search & indexing: search_entities, index_document
- Monitoring: get_dashboard_stats, health_check, list_roles

#### ***CRITICAL***: Architecture Documentation First

**Before starting ANY development work:**

1. **ALWAYS** check the Component Development Guide (section above)
2. **READ** the required architectural documents for your component
3. **UNDERSTAND** the template-driven, Codex-based system design
4. **NEVER** hardcode content types - everything is template-driven
5. **REFERENCE** docs/architecture/ for technical specifications

#### ***CRITICAL***: Git Commit After Every Task

**After completing ANY development task:**

1. **ALWAYS** review changes: `git status && git diff`
2. **COMMIT** with descriptive message
3. Include package scope in commit: `feat(scriptorium): description`
4. Never leave uncommitted changes between tasks

#### ***CRITICAL***: Phase Handover Process

**When completing a phase or handing over context:**

1. **Use `/phase-complete`** command to create comprehensive phase documentation
2. **Fill out PHASE_[N]_COMPLETE.md** using the template with ALL sections
3. **Special focus on "Context for AI Assistant" section** - this is critical for next sessions
4. **Create related ADRs** for significant decisions made during the phase
5. **For context window transitions**, use `/handover` command for quick summaries

**Custom Slash Commands Available**:
- `/phase-start` - Start a new development phase with planning
- `/phase-complete` - Complete current phase with documentation
- `/handover` - Create context handover for next session
- `/context` - Quick context snapshot of current state
- `/adr` - Create new Architecture Decision Record

**See**: [docs/development/phases/PHASE_TEMPLATE.md](docs/development/phases/PHASE_TEMPLATE.md) for the phase documentation template

## 📦 Package Management

### Python Packages (vespera-scriptorium)

```bash
# Development installation
cd packages/vespera-scriptorium
pip install -r requirements.txt

# Run MCP server
python3 mcp_server.py

# Run tests
pytest
python3 run_mcp_tests.py

# Linting and formatting
black *.py
isort *.py
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

### Vespera Scriptorium Architecture

Vespera Scriptorium implements a FastMCP-based translation layer to the Rust Bindery backend:

1. **MCP Server Mode**: FastMCP server with 14 comprehensive tools
2. **Translation Layer**: Python MCP server translates calls to Rust Bindery HTTP API
3. **Backend Integration**: Communicates with Rust Bindery backend for all operations
4. **Security & Resilience**: Structured error handling, validation, and retry logic

### Core Components

**MCP Server:**
- `mcp_server.py`: FastMCP server with 14 tools (single source of truth)
- `models.py`: Pydantic models for task, project, search, and document entities
- `bindery_client.py`: HTTP client for Rust Bindery backend communication
- `backend_manager.py`: Backend lifecycle and health management
- `security.py`: Input validation and error sanitization
- `resilience.py`: Retry logic and fault tolerance

**Testing:**
- `conftest.py`: Pytest fixtures and test configuration
- `test_*.py`: Unit and integration tests for MCP tools
- `run_mcp_tests.py`: Test runner for MCP server functionality

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
pip install -r requirements.txt    # Install dependencies
python3 mcp_server.py              # Run MCP server
pytest                             # Run unit tests
python3 run_mcp_tests.py          # Run MCP integration tests
black *.py                        # Format code
isort *.py                        # Sort imports

# Git operations
git add packages/        # Stage package changes
git commit -m "feat(scriptorium): description"
```

### Testing Commands

```bash
# Core tests
cd packages/vespera-scriptorium
pytest                             # Run all tests with pytest
python3 run_mcp_tests.py          # Run MCP-specific tests

# Specific test suites
pytest test_bindery_tools_mock.py  # Test Bindery integration
pytest test_mcp_server_complete.py # Test MCP server completeness
pytest test_integrated_backend.py  # Test backend integration

# MCP tool testing
python3 mcp_server.py             # Start server
# Use MCP tools via Claude Code to test functionality
```

## 🔗 Cross-References

### Package-Specific Documentation

- **Vespera Scriptorium**: `packages/vespera-scriptorium/CLAUDE.md`
- **PRPs Framework**: `PRPs/CLAUDE.md`
- **Meta-PRP Transition**: `PRPs/vespera-scriptorium-transition/README.md`
- **⭐ Project-Centric Architecture**: `docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md` (Phase 15 foundation)
- **⭐ Hierarchical Template System**: `docs/architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md` (Phase 15 foundation)
- **⭐ Codex Nesting**: `docs/architecture/core/CODEX_NESTING.md` (Phase 15 foundation)
- **Architecture Documentation Hub**: `docs/README.md`

### Key Concepts

- **🔥 Dynamic Automation System**: Revolutionary tag-driven automation with LLM-assisted rule creation
- **Event-Driven Architecture**: Real-time reactive content workflows and cross-codex automation chains
- **Bindery Backend**: Rust-based backend for content management and task orchestration
- **MCP Translation Layer**: FastMCP server bridging Claude Code to Bindery backend
- **PRP Framework**: Product Requirement Prompts for systematic development
- **Codex Protocol**: Virtual content organization with multiple viewing perspectives
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
   pip install -r requirements.txt
   ```

3. **Test System**:
   ```bash
   # Run tests
   pytest
   python3 run_mcp_tests.py
   ```

4. **Configure MCP Server** (user scope):
   ```bash
   # Add to user config (one-time setup)
   claude mcp add -s user vespera-scriptorium python3 /path/to/vespera-atelier/packages/vespera-scriptorium/mcp_server.py

   # Test server directly
   python3 mcp_server.py
   ```

5. **Use MCP Tools**:
   ```bash
   # Available via Claude Code MCP integration:
   # - Task management: create_task, get_task, update_task, delete_task, list_tasks
   # - Task execution: complete_task, execute_task, assign_role_to_task
   # - Project management: create_project
   # - Search & indexing: search_entities, index_document
   # - Monitoring: get_dashboard_stats, health_check, list_roles
   ```

## 🎨 Vision: Revolutionary Automation Architecture

The Vespera Atelier is an ecosystem of intelligent tools for creative professionals, researchers, and knowledge workers. The revolutionary **Dynamic Automation and Tag-Driven Systems** transform static content into reactive, intelligent ecosystems.

### Core Innovation: Magical Content Workflows

- **Tag-Driven Automation**: Content responds to tag changes with intelligent automation (e.g., scene mood `#peaceful` → `#tense` automatically changes music)
- **LLM-Assisted Setup**: Natural language automation creation ("When Alice gets scared, change the music")
- **Cross-Codex Chains**: Cascading automation across different content types (scene completion → character updates → task creation)
- **Real-Time Reactive Content**: Live UI updates and background automation execution

### Architecture Documentation

**📚 Comprehensive Documentation**: See `/docs/` directory for complete technical specifications:

**Phase 15 Foundation Documents** (⭐ Start Here):
- **[Project-Centric Architecture](docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md)**: Projects as fundamental entities - **READ THIS FIRST** for project context
- **[Hierarchical Template System](docs/architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md)**: Dynamic JSON5-based templates - **Essential** for template work
- **[Codex Nesting](docs/architecture/core/CODEX_NESTING.md)**: Scrivener-style folder-documents - **Key** for content organization

**Core System Architecture:**
- **[Codex Architecture](docs/architecture/core/CODEX_ARCHITECTURE.md)**: Universal content system where everything is a Codex entry
- **[Template System Architecture](docs/architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)**: Template loading, validation, and rendering
- **[UI Architecture Three-Panel Design](docs/architecture/core/UI-Architecture-Three-Panel-Design.md)**: Interface design with immersive environments
- **[Multi-Project Vault Organization](docs/architecture/core/MULTI_PROJECT_VAULT_ORGANIZATION.md)**: Managing multiple projects in single vaults

**Planned Features** (🔮 Not Yet Implemented):
- **[Dynamic Automation Architecture](docs/architecture/core/DYNAMIC_AUTOMATION_ARCHITECTURE.md)**: Tag-driven automation (planned)
- **[Event System Specification](docs/architecture/core/EVENT_SYSTEM_SPECIFICATION.md)**: Real-time event processing (planned)

**Examples and Guides:**
- **[Automation Examples](docs/examples/AUTOMATION_RULE_EXAMPLES.md)**: Automation rule examples (planned features)
- **[Real-World Integration Scenarios](docs/legacy/future-features/REAL_WORLD_INTEGRATION_SCENARIOS.md)**: Aspirational use cases (⚠️ with warnings)
- **[Getting Started with Automation](docs/legacy/future-features/GETTING_STARTED_AUTOMATION.md)**: Automation setup guide (⚠️ future features)

## 🧭 Component Development Guide

**When working on specific components, ALWAYS reference the relevant architectural documents:**

### VS Code Extension Development
**Required Reading:**
1. **[Project-Centric Architecture](docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md)** ⭐ - Projects as fundamental entities
2. **[Hierarchical Template System](docs/architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md)** ⭐ - Dynamic template filtering
3. **[Codex Nesting](docs/architecture/core/CODEX_NESTING.md)** ⭐ - Navigator tree structure
4. **[UI Architecture Three-Panel Design](docs/architecture/core/UI-Architecture-Three-Panel-Design.md)** - Interface structure
5. **[Template System Architecture](docs/architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)** - Template rendering

**Key Implementation Notes:**
- Projects are mandatory - everything exists within a project
- Templates filter by current project type
- Navigator shows tree view with expand/collapse for nested Codices
- Three-panel design: Left (Navigator), Center (Editor), Right (Chat/Context)
- Template-driven UI components, not hardcoded types

### Automation System Development (🔮 Planned)
**Required Reading:**
1. **[Dynamic Automation Architecture](docs/architecture/core/DYNAMIC_AUTOMATION_ARCHITECTURE.md)** - Complete automation system design (planned)
2. **[Event System Specification](docs/architecture/core/EVENT_SYSTEM_SPECIFICATION.md)** - Event processing implementation (planned)
3. **[Automation Examples](docs/examples/AUTOMATION_RULE_EXAMPLES.md)** - Concrete rule examples (planned)

**Key Implementation Notes:**
- ⚠️ **NOT YET IMPLEMENTED** - This is planned future work
- Tag changes will trigger automation rules
- LLM-assisted rule creation from natural language
- Cross-codex automation chains (scene → character → task → music)
- Real-time reactive UI updates

### Template System Development
**Required Reading:**
1. **[Hierarchical Template System](docs/architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md)** ⭐ - Dynamic template architecture
2. **[Template System Architecture](docs/architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)** - Complete template specification
3. **[Project-Centric Architecture](docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md)** - Project-aware template filtering

**Key Implementation Notes:**
- Everything is template-driven via JSON5 files
- No hardcoded CodexType enums - dynamic type registration
- Templates organized in hierarchical categories
- Template inheritance via baseTemplate and mixins
- Templates filter by current project type

### Content Management Development
**Required Reading:**
1. **[Codex Architecture](docs/architecture/core/CODEX_ARCHITECTURE.md)** - Universal content system design
2. **[Codex Nesting](docs/architecture/core/CODEX_NESTING.md)** ⭐ - Hierarchical organization
3. **[Project-Centric Architecture](docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md)** ⭐ - Project boundaries
4. **[Template System Architecture](docs/architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)** - Template-driven content

**Key Implementation Notes:**
- Everything is a Codex entry (.codex.md files)
- All Codices must belong to a project
- Codices can nest (parent-child relationships via metadata)
- Virtual hierarchies via metadata, not file system structure
- Scrivener-style folders with content

### MCP Server Development
**Required Reading:**
1. **[MCP Bindery Architecture](docs/architecture/subsystems/MCP_BINDERY_ARCHITECTURE.md)** - MCP server and Bindery integration
2. **[Task Execution Architecture](docs/architecture/subsystems/TASK_EXECUTION_ARCHITECTURE.md)** - Task management system
3. **[Event System Specification](docs/architecture/core/EVENT_SYSTEM_SPECIFICATION.md)** - Event processing (planned)

**Current Architecture:**
- 14 comprehensive MCP tools for complete Bindery integration
- FastMCP implementation with official Python SDK
- Translation layer to Rust Bindery backend via HTTP
- Structured error handling, validation, and retry logic
- Security features including input sanitization and schema validation

## 📝 Important Notes

- **FastMCP Integration**: Uses official MCP Python SDK with 14 comprehensive tools
- **Rust Bindery Backend**: Python MCP server acts as translation layer to Rust backend
- **Monorepo Coordination**: Changes affecting multiple packages should be atomic commits
- **Package Independence**: Each package should be independently installable
- **Shared Dependencies**: Use workspace protocol for internal dependencies
- **Version Management**: Coordinate versions across packages for releases
- **Legacy Archives**: Old implementation versions archived in `archive/` and `legacy/` directories

## 🔒 License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
All packages in this monorepo share this license to ensure open-source collaboration.

---

**Remember**: This is a monorepo. Think in terms of packages, workspaces, and coordinated development.
- The Claude Code CLI doesn't have the ability to restart a server connected to a currently running Claude Code instance. That's a manual command only accessible to the user, and in our case it's /mcp reconnect vespera-scriptorium
- Always: Check for files' existence before attempting to create new files. Always: Read existing files before attempting to update them.
- CRITICAL REMINDER: The MCP server does not hot reload. If changes are made that require testing, ask the user to close and reopen the Claude Code REPL or to attempt the internal /mcp reconnect command.