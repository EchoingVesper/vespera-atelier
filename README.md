# Vespera Atelier - Creative Suite Monorepo

**Status**: ✅ **V2 Production Ready - FastMCP Architecture** ✅

**Current Version**: V2.0 - Complete ground-up rewrite with 14 comprehensive MCP tools

## 🎯 Vision

Vespera Atelier is building a comprehensive "repository of information with automatic organization" and "Discord for LLMs" that enables seamless management of creative projects through intelligent task orchestration, document linking, and multi-LLM coordination.

**V2 Key Features:**
- **14 Comprehensive MCP Tools**: Complete task lifecycle management via Claude Code
- **Hierarchical Task System**: Parent-child relationships with dependency management
- **Role-Based Execution**: Roo Code-inspired tool groups with file pattern restrictions
- **FastMCP Integration**: Official MCP Python SDK for reliable server communication
- **Real-time Dashboard**: Task metrics, progress tracking, and dependency visualization
- **Local-First Architecture**: SQLite with structured task relationships (KuzuDB + Chroma planned)

## 🏗️ Architecture

### V2 Production Architecture

```
vespera-atelier/
├── packages/
│   ├── vespera-scriptorium/    # 🧠 V2 FastMCP Server (Production Ready)
│   │   ├── roles/             # Tool groups & file pattern restrictions
│   │   ├── tasks/             # Hierarchical task management with SQLite
│   │   ├── mcp_server_v2.py   # FastMCP server with 14 tools
│   │   ├── mcp_venv/          # Isolated virtual environment
│   │   └── requirements.txt   # V2 dependencies
│   ├── vespera-atelier/        # 🔧 Platform coordination (future)
│   └── vespera-utilities/      # 🛠️ Shared utilities (future)
├── plugins/
│   └── Obsidian/Vespera-Scriptorium/ # 📝 Obsidian plugin
├── docs/                       # 📚 V2 Documentation
│   ├── v2-quick-start.md      # Getting started guide
│   ├── v2-mcp-tools-reference.md # Complete tool documentation
│   └── v2-role-system-guide.md   # Role system guide
├── archive/                    # 📦 V1 System Archive
│   └── v1-database-archives/   # Preserved V1 data
└── reference/                  # 📖 External references (Roo Code, Archon)
```

### Current Database Stack

- **SQLite**: Production-ready task and relationship management
- **FastMCP**: Official MCP Python SDK integration
- **Future**: KuzuDB (graph) + Chroma (vector) integration planned

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** 
- **Claude Code CLI** (for MCP integration)
- **Git**

### V2 Installation (Production Ready)

**Option 1: Using uv (Recommended)**
```bash
# Clone repository
git clone https://github.com/EchoingVesper/vespera-atelier
cd vespera-atelier/packages/vespera-scriptorium

# Install with uv (fast, reliable)
uv venv mcp_venv
source mcp_venv/bin/activate  # On Windows: mcp_venv\Scripts\activate
uv pip install -r requirements.txt
```

**Option 2: Using pip**
```bash
# Clone repository  
git clone https://github.com/EchoingVesper/vespera-atelier
cd vespera-atelier/packages/vespera-scriptorium

# Install with pip
pip install -r requirements.txt
```

### Verify Installation
```bash
# Test V2 core components
python test_task_system.py
python test_role_system.py  
python test_mcp_fastmcp.py

# Test MCP server (optional)
./mcp_venv/bin/python mcp_server_v2.py
```

### Claude Code Integration
The V2 MCP server is automatically configured in `.claude/config.json`:

```bash
# Restart MCP server to use V2
claude mcp restart vespera-scriptorium
claude mcp list | grep vespera-scriptorium
```

You now have access to **14 comprehensive MCP tools** via Claude Code!

## 🎯 V2 Features & Usage

### 14 Comprehensive MCP Tools
Available through Claude Code integration:

**Task Management:**
- `create_task` - Create individual tasks with metadata
- `create_task_tree` - Build hierarchical project structures  
- `get_task` - Retrieve detailed task information
- `update_task` - Modify task properties and status
- `delete_task` - Remove tasks and optionally children
- `list_tasks` - Query tasks with filtering options

**Task Execution:**
- `execute_task` - Run tasks through role-based workflow
- `complete_task` - Mark tasks completed with artifacts
- `assign_role_to_task` - Assign roles with capability validation

**Dependencies & Analytics:**
- `get_task_tree` - Visualize hierarchical structures
- `analyze_task_dependencies` - Identify blocking relationships  
- `add_task_dependency` - Create task dependencies
- `get_task_dashboard` - Real-time metrics and progress
- `list_roles` - Available roles and capabilities

### Role System (Roo Code-Inspired)
**Tool Groups:** READ, EDIT, COMMAND, BROWSER, MCP, COORDINATION  
**10 Predefined Roles:** architect, implementer, tester, documenter, researcher, reviewer, coordinator, optimizer, troubleshooter, analyst  
**File Pattern Restrictions:** Regex-based file access control per role

### Example Workflow
```bash
# Via Claude Code MCP tools:
1. create_task_tree     # Define project structure
2. assign_role_to_task  # Assign appropriate roles  
3. add_task_dependency  # Define task ordering
4. execute_task         # Begin role-based execution
5. get_task_dashboard   # Monitor progress and dependencies
6. complete_task        # Finalize with deliverables
```

## 🛠️ Development

### V2 Development Setup

**Prerequisites:**
- Python 3.10+ 
- Node.js 18+ with pnpm (for monorepo management)
- Claude Code CLI (for MCP testing)
- Git

**Development Installation:**
```bash
# Clone repository
git clone https://github.com/EchoingVesper/vespera-atelier
cd vespera-atelier

# Install V2 dependencies (uv recommended)
cd packages/vespera-scriptorium
uv venv mcp_venv
source mcp_venv/bin/activate
uv pip install -r requirements.txt

# Install monorepo dependencies (future packages)
cd ../..
pnpm install
```

### V2 Development Commands
```bash
# Test V2 core systems
cd packages/vespera-scriptorium
python test_task_system.py     # Task management
python test_role_system.py     # Role system
python test_mcp_fastmcp.py     # MCP server

# Run V2 MCP server for testing
./mcp_venv/bin/python mcp_server_v2.py

# Format V2 code
black roles/ tasks/ *.py
isort roles/ tasks/ *.py

# Test with Claude Code MCP integration
claude mcp restart vespera-scriptorium
claude mcp list | grep vespera-scriptorium
```

### Monorepo Commands (Future Packages)
```bash
# Build all packages
pnpm build

# Test all packages  
pnpm test

# Lint all packages
pnpm lint
```

## 📁 Project Structure

```
vespera-atelier/
├── packages/
│   └── vespera-scriptorium/      # 🧠 V2 FastMCP Server (Production)
│       ├── roles/                # Role definitions & tool groups
│       ├── tasks/                # Hierarchical task management
│       ├── mcp_server_v2.py     # FastMCP server with 14 tools
│       ├── mcp_venv/             # Isolated Python environment
│       ├── requirements.txt     # V2 dependencies
│       ├── test_*.py            # V2 component tests
│       └── calculator-demo/      # Complete V2 example project
├── plugins/
│   └── Obsidian/Vespera-Scriptorium/ # 📝 Obsidian plugin
├── docs/                         # 📚 V2 Documentation
│   ├── v2-quick-start.md        # Getting started guide
│   ├── v2-mcp-tools-reference.md # Complete tool reference
│   └── v2-role-system-guide.md  # Role system documentation
├── archive/                      # 📦 V1 System Archive
│   └── v1-database-archives/    # Complete V1 preservation
├── reference/                    # 📖 External project references
│   ├── Archon/                  # Task management patterns
│   ├── roo-code/                # Tool group inspiration
│   └── mcp-python-sdk/          # Official MCP SDK
├── .claude/                      # 🔧 Claude Code configuration
│   ├── config.json             # V2 MCP server setup
│   └── hooks/                   # Development hooks
└── .github/workflows/           # 🔄 CI/CD (updated for V2)
```

## 📖 Documentation & Resources

### V2 Documentation
- **[V2 Quick Start Guide](docs/v2-quick-start.md)**: Installation, setup, and getting started
- **[MCP Tools Reference](docs/v2-mcp-tools-reference.md)**: Complete documentation of all 14 tools
- **[Role System Guide](docs/v2-role-system-guide.md)**: Role-based execution and security
- **[CLAUDE.md](CLAUDE.md)**: Developer guidance for working with V2

### Example Project
- **[Calculator Demo](packages/vespera-scriptorium/calculator-demo/)**: Complete V2 workflow example
  - Hierarchical task creation and management
  - Role-based execution with file restrictions
  - Dependency management and completion tracking
  - Real-time dashboard monitoring

### Migration Information
- **V1 Archive**: Complete V1 system preserved in `archive/v1-database-archives/`
- **Migration Guide**: See [V2 Quick Start](docs/v2-quick-start.md#migration-from-v1)
- **Compatibility**: V2 is a ground-up rewrite - no automatic migration available

## 🤝 Contributing

### Current Status
V2 is **production ready** with 14 comprehensive MCP tools and a robust role-based execution system.

### How to Contribute

**For Users:**
1. **Test V2 System**: Try the calculator demo and create your own projects
2. **Report Issues**: Use GitHub Issues for bugs or feature requests  
3. **Share Workflows**: Document your V2 usage patterns and workflows
4. **Documentation**: Help improve guides and examples

**For Developers:**
1. **Core System**: Enhance task management, role system, or MCP integration
2. **Tool Extensions**: Add new MCP tools or improve existing ones
3. **Role Definitions**: Create specialized roles for specific workflows
4. **Future Features**: KuzuDB/Chroma integration, additional plugins

**Development Workflow:**
```bash
# 1. Fork and clone repository
git clone https://github.com/your-username/vespera-atelier
cd vespera-atelier/packages/vespera-scriptorium

# 2. Set up development environment
uv venv dev_env
source dev_env/bin/activate
uv pip install -r requirements.txt

# 3. Test changes
python test_task_system.py
python test_role_system.py
python test_mcp_fastmcp.py

# 4. Submit pull request with clear description
```

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

**Why AGPL-3.0?** We believe in keeping creative tools and AI advancements open-source. The AGPL ensures that all improvements, even those used in web services, remain available to the community. This prevents corporate appropriation while encouraging collaborative innovation.

## 🌟 Future Roadmap

### V2.1 Planned Features
- **KuzuDB Integration**: Graph-based project relationship mapping
- **Chroma Integration**: Vector embeddings for semantic document discovery  
- **Enhanced Obsidian Plugin**: Deep V2 integration with hierarchical tasks
- **VS Code Extension**: Bring V2 task management to VS Code
- **Creative Suite Integration**: ComfyUI, Blender, DAW workflow coordination

### Long-term Vision
Building towards a **"Repository of information with automatic organization"** + **"Discord for LLMs"** that enables:
- Multi-modal creative project management (code, writing, design, audio/video)
- Intelligent context loading and workflow automation
- Cross-tool coordination for complex creative workflows
- Executive dysfunction-aware design patterns

## 📋 Key Resources

### V2 Production System
- **Main Documentation**: [CLAUDE.md](CLAUDE.md) - Developer guidance
- **V2 Guides**: [docs/](docs/) - User documentation and references
- **Example Project**: [calculator-demo/](packages/vespera-scriptorium/calculator-demo/)
- **GitHub Issues**: [Issues](https://github.com/EchoingVesper/vespera-atelier/issues)

### External References  
- **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io/)
- **FastMCP SDK**: [Official MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- **Roo Code**: [Tool group inspiration](https://github.com/roocode-org/roocode)
- **Archon**: [Task management patterns](https://github.com/coleam00/Archon)

### V1 Archive
- **V1 System**: Complete preservation in `archive/v1-database-archives/`
- **Legacy Code**: `packages/vespera-scriptorium/vespera-scriptorium-backup/`
- **PRP System**: [PRPs/README.md](PRPs/README.md) - Proven meta-framework (preserved)

## 🙏 Acknowledgments

- **Built with**: [Claude Code](https://claude.ai/code) - AI-assisted development
- **Inspired by**: Roo Code tool groups, Archon task patterns, Clean Architecture
- **Powered by**: FastMCP, SQLite, and the broader MCP ecosystem
- **Achievement**: Replaced "half a year's worth of V1 work in under 3 hours" - demonstrating significant learning acceleration and tool improvement

---

## 🚀 **Vespera Atelier V2 - Production Ready**
**Intelligent Task Orchestration for Creative Workflows**  
**Status**: ✅ V2.0 Production Release - 14 MCP Tools - Role-Based Execution  
**Get Started**: Follow the [V2 Quick Start Guide](docs/v2-quick-start.md)
