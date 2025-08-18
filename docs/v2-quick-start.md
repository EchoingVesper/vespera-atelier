# Vespera Scriptorium V2 Quick Start Guide

## Overview

Vespera Scriptorium V2 is a complete rewrite featuring a hierarchical task management system with role-based execution capabilities. Built on FastMCP (official MCP Python SDK), it provides 14 comprehensive tools for intelligent task orchestration.

## What's New in V2

### 🏗️ Architecture Changes
- **Hierarchical Task System**: Replace sessions with parent-child task relationships and dependencies
- **Role-Based Execution**: Roo Code-inspired tool groups with file pattern restrictions
- **FastMCP Integration**: Official MCP Python SDK for reliable server communication
- **Enhanced Database**: SQLite with structured task relationships and metadata

### 🚀 Key Features
- **14 MCP Tools**: Complete task lifecycle management via Claude Code integration
- **Real-time Dashboard**: Task metrics, progress tracking, and dependency visualization
- **Role Validation**: Runtime capability enforcement with file access controls
- **Task Dependencies**: Automatic ordering and dependency resolution

## Installation & Setup

### 1. Prerequisites
- Python 3.10+ 
- Claude Code CLI
- Git

### 2. Install V2 Dependencies
```bash
cd packages/vespera-scriptorium
pip install -r requirements.txt
```

### 3. Verify V2 Installation
```bash
# Test core components
python test_task_system.py
python test_role_system.py
python test_mcp_fastmcp.py
```

### 4. Configure Claude Code MCP Integration
The V2 MCP server is automatically configured in `.claude/config.json`:

```bash
# Restart MCP server to use V2
claude mcp restart vespera-scriptorium
claude mcp list | grep vespera-scriptorium
```

## Using V2 MCP Tools

### Task Management
```bash
# Available via Claude Code:
# - create_task: Create individual tasks
# - create_task_tree: Create hierarchical task structures
# - get_task: Retrieve task details and status
# - update_task: Modify task properties
# - delete_task: Remove tasks and optionally children
# - list_tasks: Query tasks with filtering options
```

### Task Execution
```bash
# Role-based execution:
# - assign_role_to_task: Assign roles with capability validation
# - execute_task: Run tasks through role-specific execution
# - complete_task: Mark tasks as completed with artifacts
```

### Task Relationships
```bash
# Hierarchy and dependencies:
# - get_task_tree: Visualize task hierarchies
# - analyze_task_dependencies: Identify blocking relationships
# - add_task_dependency: Create task dependencies
```

### Dashboard & Analytics
```bash
# Monitoring and insights:
# - get_task_dashboard: Real-time metrics and progress
# - list_roles: Available roles and capabilities
```

## V2 Role System

### Tool Groups
V2 organizes capabilities into tool groups instead of granular permissions:

- **READ**: File reading and information gathering
- **EDIT**: File modification and content creation  
- **COMMAND**: Shell command execution
- **BROWSER**: Web browsing and research
- **MCP**: MCP tool integration
- **COORDINATION**: Cross-system orchestration

### File Pattern Restrictions
Roles can restrict file access using regex patterns:

```yaml
architect:
  tool_groups: [READ, EDIT]
  file_restrictions:
    - ".*\\.md$"      # Markdown files only
    - "docs/.*"       # Documentation directory

tester:
  tool_groups: [READ, COMMAND]
  file_restrictions:
    - ".*test.*"      # Test files only
    - "spec/.*"       # Specification directory
```

### 10 Predefined Roles
1. **architect**: System design and documentation
2. **implementer**: Code development and implementation
3. **tester**: Quality assurance and validation
4. **documenter**: Documentation creation and maintenance
5. **researcher**: Information gathering and analysis
6. **reviewer**: Code review and quality control
7. **coordinator**: Cross-team coordination
8. **optimizer**: Performance and efficiency improvements
9. **troubleshooter**: Issue diagnosis and resolution
10. **analyst**: Data analysis and reporting

## Example: Creating a Project with V2

### 1. Create Project Structure
Use Claude Code with V2 MCP tools:

```
Create a new web application project structure with the following tasks:
- Setup basic project structure 
- Configure development environment
- Implement core features
- Add testing framework
- Create documentation
```

### 2. V2 Will Automatically:
- Create hierarchical task tree with dependencies
- Assign appropriate roles based on task type
- Validate file access permissions
- Track progress through real-time dashboard
- Manage task relationships and ordering

### 3. Monitor Progress
```bash
# Check dashboard via Claude Code MCP tools
# - View task completion percentage
# - Identify blocking dependencies  
# - Track role assignments
# - Monitor execution status
```

## Migration from V1

### What Was Archived
- V1 databases: `archive/v1-database-archives/20250818-044220/`
- Legacy code: `packages/vespera-scriptorium/vespera-scriptorium-backup/`
- Session data: All V1 sessions preserved for reference

### V1 vs V2 Comparison
| Feature | V1 | V2 |
|---------|----|----|
| Task Model | Sessions | Hierarchical Tasks |
| Capabilities | Individual permissions | Tool Groups |
| MCP Integration | Custom implementation | Official FastMCP SDK |
| Database | Simple SQLite | Structured relationships |
| Tools | Limited set | 14 comprehensive tools |
| Role System | Basic assignments | Pattern-restricted execution |

### Migration Strategy
- **No automatic migration** - V2 is a clean slate
- **Start fresh** with new task structures
- **Reference V1 data** in archive if needed
- **Leverage V2 improvements** for new projects

## Troubleshooting

### MCP Server Issues
```bash
# Check V2 server status
claude mcp list | grep vespera-scriptorium

# Restart V2 server
claude mcp restart vespera-scriptorium

# Test server directly
./mcp_venv/bin/python mcp_server_v2.py
```

### Component Testing
```bash
# Test individual components
python test_task_system.py     # Task management
python test_role_system.py     # Role validation  
python test_mcp_fastmcp.py     # MCP integration
```

### Common Issues
1. **MCP Tools Not Available**: Restart Claude Code after V2 installation
2. **Role Validation Errors**: Check file pattern restrictions in role definitions
3. **Task Creation Failures**: Verify V2 database initialization
4. **Import Errors**: Ensure requirements.txt dependencies installed

## Next Steps

1. **Explore Calculator Demo**: See `calculator-demo/` for a complete V2 example
2. **Customize Roles**: Modify `roles/templates/enhanced_roles.yaml`
3. **Create Task Trees**: Use hierarchical planning for complex projects
4. **Monitor Dashboard**: Track progress and dependencies in real-time
5. **Integrate Workflows**: Combine V2 with existing development processes

## Support & Resources

- **Main Documentation**: `/CLAUDE.md` - Updated for V2
- **Code Examples**: `calculator-demo/` - Working V2 implementation
- **Role Templates**: `roles/templates/enhanced_roles.yaml`
- **Legacy Reference**: `vespera-scriptorium-backup/` - V1 archive

---

**V2 represents a complete ground-up rewrite that replaced half a year's worth of V1 work in under 3 hours, demonstrating significant learning acceleration and tool improvement.**