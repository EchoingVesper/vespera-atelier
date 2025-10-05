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
│   ├── technical/              # Core system architecture documents
│   │   ├── DYNAMIC_AUTOMATION_ARCHITECTURE.md  # Revolutionary automation system
│   │   ├── CODEX_ARCHITECTURE.md               # Universal content system
│   │   ├── TEMPLATE_SYSTEM_ARCHITECTURE.md     # User-extensible templates
│   │   ├── UI-Architecture-Three-Panel-Design.md # Interface design
│   │   └── MULTI_PROJECT_VAULT_ORGANIZATION.md  # Multi-project management
│   ├── examples/               # Automation rule examples
│   └── user-guides/            # User documentation and scenarios
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
5. **REFERENCE** docs/technical/ for technical specifications

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
- **🔥 Dynamic Automation Architecture**: `docs/technical/DYNAMIC_AUTOMATION_ARCHITECTURE.md` (Revolutionary new system)
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

**Core System Architecture:**
- **[Dynamic Automation Architecture](docs/technical/DYNAMIC_AUTOMATION_ARCHITECTURE.md)**: Revolutionary tag-driven automation system - **READ THIS FIRST** for any automation work
- **[Codex Architecture](docs/technical/CODEX_ARCHITECTURE.md)**: Universal content system where everything is a Codex entry - **Essential** for content type work
- **[Template System Architecture](docs/technical/TEMPLATE_SYSTEM_ARCHITECTURE.md)**: User-extensible templates via JSON5 files - **Required** for template development
- **[Event System Specification](docs/technical/EVENT_SYSTEM_SPECIFICATION.md)**: Real-time event processing architecture - **Key** for reactive features

**UI and Organization:**
- **[UI Architecture Three-Panel Design](docs/technical/UI-Architecture-Three-Panel-Design.md)**: Interface design with immersive environments - **Essential** for UI work
- **[Multi-Project Vault Organization](docs/technical/MULTI_PROJECT_VAULT_ORGANIZATION.md)**: Managing multiple projects in single vaults - **Required** for project management features

**Examples and User Guides:**
- **[Automation Examples](docs/examples/AUTOMATION_RULE_EXAMPLES.md)**: Concrete automation rule examples
- **[Real-World Integration Scenarios](docs/user-guides/REAL_WORLD_INTEGRATION_SCENARIOS.md)**: Comprehensive workflow examples
- **[User Getting Started Guide](docs/user-guides/GETTING_STARTED_AUTOMATION.md)**: Step-by-step automation setup

## 🧭 Component Development Guide

**When working on specific components, ALWAYS reference the relevant architectural documents:**

### Obsidian Plugin Development
**Required Reading:**
1. **[UI Architecture Three-Panel Design](docs/technical/UI-Architecture-Three-Panel-Design.md)** - Interface structure and immersive environments
2. **[Codex Architecture](docs/technical/CODEX_ARCHITECTURE.md)** - Universal content system integration
3. **[Template System Architecture](docs/technical/TEMPLATE_SYSTEM_ARCHITECTURE.md)** - Dynamic template rendering

**Key Implementation Notes:**
- Task Manager belongs in main editor area, not sidebar
- Three-panel design: Left (navigation), Center (content), Right (context/chat)
- Support immersive environment adaptation (music, lighting, themes)
- Template-driven UI components, not hardcoded types

### Automation System Development
**Required Reading:**
1. **[Dynamic Automation Architecture](docs/technical/DYNAMIC_AUTOMATION_ARCHITECTURE.md)** - Complete automation system design
2. **[Event System Specification](docs/technical/EVENT_SYSTEM_SPECIFICATION.md)** - Event processing implementation
3. **[Automation Examples](docs/examples/AUTOMATION_RULE_EXAMPLES.md)** - Concrete rule examples

**Key Implementation Notes:**
- Tag changes trigger automation rules
- LLM-assisted rule creation from natural language
- Cross-codex automation chains (scene → character → task → music)
- Real-time reactive UI updates

### Template System Development
**Required Reading:**
1. **[Template System Architecture](docs/technical/TEMPLATE_SYSTEM_ARCHITECTURE.md)** - Complete template system specification
2. **[Codex Architecture](docs/technical/CODEX_ARCHITECTURE.md)** - Integration with universal content system
3. **[Multi-Project Vault Organization](docs/technical/MULTI_PROJECT_VAULT_ORGANIZATION.md)** - Project-aware template switching

**Key Implementation Notes:**
- Everything is template-driven via JSON5 files
- No hardcoded CodexType enums - dynamic type registration
- Template inheritance and sharing via hash strings
- Environmental adaptation configs in templates

### Content Management Development
**Required Reading:**
1. **[Codex Architecture](docs/technical/CODEX_ARCHITECTURE.md)** - Universal content system design
2. **[Template System Architecture](docs/technical/TEMPLATE_SYSTEM_ARCHITECTURE.md)** - Template-driven content types
3. **[Multi-Project Vault Organization](docs/technical/MULTI_PROJECT_VAULT_ORGANIZATION.md)** - Multi-project content organization

**Key Implementation Notes:**
- Everything is a Codex entry (.codex.md files)
- Virtual hierarchies via metadata, not file system structure
- Cross-project references and template switching
- Three-mode component behavior (programmatic/LLM/hybrid)

### MCP Server Development
**Required Reading:**
1. **[Event System Specification](docs/technical/EVENT_SYSTEM_SPECIFICATION.md)** - Event processing and MCP integration
2. **[Dynamic Automation Architecture](docs/technical/DYNAMIC_AUTOMATION_ARCHITECTURE.md)** - Automation engine integration

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