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

### Vespera Scriptorium V2 (Task Orchestrator)

The V2 MCP server is in `packages/vespera-scriptorium/` using FastMCP:

```bash
# Install V2 dependencies
cd packages/vespera-scriptorium
pip install -r requirements.txt

# Run V2 MCP server directly (for testing)
./mcp_venv/bin/python mcp_server_v2.py

# Claude Code MCP integration (automatically configured in .claude/config.json)
claude mcp restart vespera-scriptorium
claude mcp list | grep vespera-scriptorium
```

**V2 Features:**
- **14 comprehensive MCP tools** for complete task lifecycle management
- **Hierarchical task system** with parent-child relationships and dependencies
- **Role-based execution** with capability restrictions and file pattern matching
- **FastMCP implementation** using official MCP Python SDK
- **Real-time dashboard** with task metrics and progress tracking

### Critical Directives from Original

#### ***CRITICAL***: Task Orchestrator V2 Failure Protocol

**If the MCP Task Orchestrator V2 ever fails to function:**

1. **STOP** - Do not proceed with current task
2. **DIAGNOSE** - Check MCP connection and health:
   ```bash
   claude mcp list | grep vespera-scriptorium
   ./mcp_venv/bin/python mcp_server_v2.py  # Test server directly
   ```
3. **FIX** - Restart MCP server:
   ```bash
   claude mcp restart vespera-scriptorium
   ```
4. **VERIFY** - Test with `mcp__vespera-scriptorium__get_task_dashboard` tool
5. **RESUME** - Only continue after verification

**V2 MCP Tools Available:**
- Task management: create_task, get_task, update_task, delete_task
- Task hierarchy: create_task_tree, get_task_tree, analyze_task_dependencies  
- Task execution: execute_task, complete_task, assign_role_to_task
- Dashboard: get_task_dashboard, list_tasks, list_roles

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

### Python Packages (vespera-scriptorium V2)

```bash
# V2 Development installation
cd packages/vespera-scriptorium
pip install -r requirements.txt

# Run V2 MCP server
./mcp_venv/bin/python mcp_server_v2.py

# Test V2 task system
python test_task_system.py
python test_role_system.py
python test_mcp_fastmcp.py

# Linting and formatting
black roles/ tasks/ *.py
isort roles/ tasks/ *.py
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

### V2 Architecture

Vespera Scriptorium V2 implements a modular, FastMCP-based architecture:

1. **MCP Server Mode**: FastMCP server with 14 comprehensive tools
2. **Task System**: Hierarchical tasks with parent-child relationships
3. **Role System**: Capability-restricted execution based on Roo Code patterns
4. **Database Layer**: SQLite with task persistence and relationship management

### V2 Core Components

**Task Management:**
- `tasks/models.py`: Task, TaskStatus, TaskPriority, TaskRelation data models
- `tasks/service.py`: SQLite persistence with relationships and constraints
- `tasks/manager.py`: High-level task orchestration and lifecycle management
- `tasks/executor.py`: Role integration and execution workflow

**Role System:**
- `roles/definitions.py`: ToolGroup enum and capability definitions
- `roles/templates/enhanced_roles.yaml`: 10 predefined roles with file restrictions
- `roles/execution.py`: Runtime validation and capability enforcement
- `roles/manager.py`: Role assignment and validation

**MCP Integration:**
- `mcp_server_v2.py`: FastMCP server with 14 tools
- `mcp_venv/`: Isolated virtual environment with official MCP SDK
- Pydantic validation for all tool inputs and outputs

## 📋 Development Commands

### Essential Commands

```bash
# Monorepo-wide operations
pnpm install              # Install all dependencies
pnpm build               # Build all packages
pnpm test                # Run all tests
pnpm lint                # Lint all packages

# V2 Package-specific operations
cd packages/vespera-scriptorium
pip install -r requirements.txt    # Install V2 dependencies
./mcp_venv/bin/python mcp_server_v2.py  # Run V2 MCP server
python test_task_system.py         # Test task system
python test_role_system.py         # Test role system
black roles/ tasks/ *.py           # Format V2 code
isort roles/ tasks/ *.py           # Sort imports

# Git operations
git add packages/        # Stage package changes
git commit -m "feat(scriptorium): description"
```

### V2 Testing Commands

```bash
# V2 Core system tests
cd packages/vespera-scriptorium
python test_task_system.py         # Task management tests
python test_role_system.py         # Role system tests  
python test_mcp_fastmcp.py         # MCP server tests

# V2 MCP tool testing (create demo projects)
./mcp_venv/bin/python mcp_server_v2.py  # Start server for testing
# Use MCP tools via Claude Code to test functionality

# V1 Legacy tests (if needed from backup)
# python vespera-scriptorium-backup/tests/...
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
- **Task Orchestrator**: Core orchestration engine for AI agent coordination (V2 with triple database)
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

2. **Install Vespera Scriptorium V2**:
   ```bash
   cd packages/vespera-scriptorium
   pip install -r requirements.txt
   ```

3. **Test V2 System**:
   ```bash
   # Test core components
   python test_task_system.py
   python test_role_system.py
   python test_mcp_fastmcp.py
   ```

4. **Start V2 MCP Server**:
   ```bash
   # MCP server is automatically configured in .claude/config.json
   claude mcp restart vespera-scriptorium
   claude mcp list | grep vespera-scriptorium
   
   # Manual server testing
   ./mcp_venv/bin/python mcp_server_v2.py
   ```

5. **Use V2 MCP Tools**:
   ```bash
   # Available via Claude Code MCP integration:
   # - create_task, get_task, update_task, delete_task
   # - create_task_tree, get_task_tree, analyze_task_dependencies
   # - execute_task, complete_task, assign_role_to_task
   # - get_task_dashboard, list_tasks, list_roles
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

**Current V2 Architecture:**
- 14 comprehensive MCP tools for complete task lifecycle
- FastMCP implementation with official Python SDK
- Hierarchical task system with dependencies
- Role-based execution with capability restrictions

## 📝 Important Notes

- **V2 Migration Complete**: V1 orchestrator has been archived to `archive/v1-database-archives/`
- **V1 Database Archive**: Original `.vespera_scriptorium` and `.task_orchestrator` directories archived
- **FastMCP Integration**: V2 uses official MCP Python SDK with 14 comprehensive tools
- **Monorepo Coordination**: Changes affecting multiple packages should be atomic commits
- **Package Independence**: Each package should be independently installable
- **Shared Dependencies**: Use workspace protocol for internal dependencies
- **Version Management**: Coordinate versions across packages for releases

### V1 to V2 Migration Notes

**What Changed:**
- Session-based tasks → Hierarchical task trees with dependencies
- Individual capabilities → Tool groups with file pattern restrictions
- Custom MCP implementation → Official FastMCP SDK
- Single database → Structured task management with relationships

**V1 Archive Locations:**
- Main databases: `archive/v1-database-archives/20250818-044220/`
- Legacy code: `packages/vespera-scriptorium/vespera-scriptorium-backup/`
- V1 tests and documentation preserved for reference

## 🔒 License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
All packages in this monorepo share this license to ensure open-source collaboration.

---

**Remember**: This is a monorepo. Think in terms of packages, workspaces, and coordinated development.