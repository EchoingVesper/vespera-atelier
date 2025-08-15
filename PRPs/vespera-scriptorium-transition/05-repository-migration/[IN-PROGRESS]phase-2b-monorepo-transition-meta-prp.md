# Phase 2B: Monorepo Transition & Development Infrastructure - Meta-PRP

**Template Compliance**: Enhanced multi-agent coordination meta-PRP with monorepo workflow integration  
**Philosophy**: Executive Dysfunction-Aware Development with Monorepo Configuration Management  
**Git Strategy**: Workspace-aware configuration with package-level development patterns

## 📍 Current Context & Transition Status

### ✅ Phase 2A Completion Summary
- **Repository Migration Complete**: Full mcp-task-orchestrator codebase copied to `packages/vespera-scriptorium/`
- **Package Configuration Updated**: Name changed to `vespera-scriptorium`, version reset to `1.0.0-alpha.1`
- **AGPL-3.0 Licensing Established**: Unified open-source protection across monorepo
- **GitHub Integration Active**: All changes pushed to `https://github.com/EchoingVesper/vespera-atelier`
- **Monorepo Structure Ready**: Professional foundation established

### 🎯 Phase 2B Goals: Switch Primary Development
**Primary Objective**: Validate monorepo structure and establish development workflow patterns

## 🚨 Critical Monorepo Configuration Challenge

### The .claude Configuration Problem

**Issue Identified**: `.claude/` directories only work from their specific location in the filesystem hierarchy.

**Current Challenge**:
```bash
# Original working configuration
/home/aya/dev/mcp-servers/mcp-task-orchestrator/.claude/
├── config.json
├── settings.local.json
└── commands/

# New monorepo structure  
/home/aya/dev/monorepo/vespera-atelier/
├── packages/vespera-scriptorium/.claude/  # NOT accessible from monorepo root
└── .claude/                               # NEEDS creation for monorepo work
```

**Problem**: When working in `/home/aya/dev/monorepo/vespera-atelier/`, Claude Code won't find the package-level `.claude` configuration.

### 🔧 Solution Strategy: Dual .claude Configuration Pattern

**Approach**: Implement workspace-aware .claude configuration with inheritance patterns.

## 📋 Meta-PRP Task Breakdown

### Priority 1: Monorepo .claude Configuration Setup
**Specialist**: DevOps Agent with Claude Code expertise

#### Subtask 1.1: Create Monorepo Root .claude Configuration
```yaml
task_description: "Establish monorepo-level Claude Code configuration"
deliverables:
  - "/home/aya/dev/monorepo/vespera-atelier/.claude/config.json"
  - "/home/aya/dev/monorepo/vespera-atelier/.claude/settings.local.json"
  - "Workspace-aware MCP configuration"
working_directory: "/home/aya/dev/monorepo/vespera-atelier"
```

**Configuration Strategy**:
```json
// .claude/config.json (monorepo root)
{
  "mcp": {
    "servers": {
      "vespera-scriptorium": {
        "command": "python",
        "args": ["-m", "mcp_task_orchestrator.server"],
        "cwd": "packages/vespera-scriptorium"
      }
    }
  },
  "workspaces": {
    "packages": ["packages/*"],
    "primary": "packages/vespera-scriptorium"
  }
}
```

#### Subtask 1.2: Establish Monorepo Command Structure
```bash
# Command organization for monorepo
.claude/commands/
├── monorepo/                    # Monorepo-specific commands
│   ├── workspace-switch.md
│   ├── package-test.md
│   └── dual-mode-validation.md
├── vespera-scriptorium/         # Package-specific commands (copied from original)
├── development/                 # Inherited development commands
└── git-operations/             # Enhanced for monorepo workflows
```

#### Subtask 1.3: Claude Code Settings Migration
**Configuration Inheritance Pattern**:
- **Monorepo Root**: General development settings, workspace coordination
- **Package Level**: Package-specific tools, MCP server configuration
- **Inheritance Rules**: Root settings provide defaults, package settings override

### Priority 2: MCP Server Integration Validation
**Specialist**: Infrastructure Agent with MCP Protocol expertise

#### Subtask 2.1: Test MCP Server from Monorepo Location
```bash
# Validation commands
cd /home/aya/dev/monorepo/vespera-atelier/packages/vespera-scriptorium
pip install -e .
vespera-scriptorium --help

# MCP connection test
claude mcp add vespera-scriptorium-monorepo ./packages/vespera-scriptorium
claude mcp list | grep vespera
```

#### Subtask 2.2: Dual-Mode Architecture Validation
**Three Operational Modes to Test**:
1. **Standalone MCP Server**: `vespera-scriptorium --server`
2. **CLI Consumer**: `vespera-scriptorium-cli plan-task`
3. **Package Import**: Import as library for Obsidian plugin

#### Subtask 2.3: Database Path Resolution
**Challenge**: Ensure workspace-aware database organization
```yaml
database_strategy:
  workspace_detection: "Look for .git, package.json, pyproject.toml in parent dirs"
  database_location: "Create .task_orchestrator/ in detected workspace root"
  migration_strategy: "Auto-migrate existing databases if found"
```

### Priority 3: Package Management & Build System
**Specialist**: Build System Agent with PNPM/Turbo expertise

#### Subtask 3.1: Root package.json Creation
```json
{
  "name": "vespera-atelier",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*",
    "plugins/*/vespera-scriptorium"
  ],
  "packageManager": "pnpm@8.0.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "scriptorium:dev": "pnpm --filter vespera-scriptorium dev",
    "scriptorium:test": "pnpm --filter vespera-scriptorium test"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "typescript": "^5.0.0"
  }
}
```

#### Subtask 3.2: Workspace Linking Validation
```bash
# Test workspace dependencies
pnpm install
pnpm build
pnpm scriptorium:test
```

#### Subtask 3.3: UV Package Manager Integration Research
**Research Goal**: Evaluate UV tool for Python package management in monorepo context
```yaml
uv_integration_research:
  performance_comparison: "UV vs pip installation times"
  monorepo_compatibility: "Multi-package workspace support"
  cli_tool_installation: "uv tool install patterns"
  dependency_resolution: "Cross-package dependency handling"
```

### Priority 4: Development Workflow Patterns
**Specialist**: Developer Experience Agent

#### Subtask 4.1: Workspace Development Scripts
```yaml
development_scripts:
  workspace_switcher:
    purpose: "Quick navigation between packages"
    implementation: "Claude Code command for workspace switching"
    
  package_tester:
    purpose: "Test individual packages in monorepo context"
    implementation: "Isolated testing with workspace dependencies"
    
  cross_package_validation:
    purpose: "Validate package interactions"
    implementation: "Integration testing across workspace"
```

#### Subtask 4.2: Git Workflow Adaptation
**Monorepo Git Patterns**:
```bash
# Package-specific development
git checkout -b feat/scriptorium-dual-mode
# Work in packages/vespera-scriptorium/
git add packages/vespera-scriptorium/
git commit -m "feat(scriptorium): implement dual-mode architecture"

# Monorepo-wide changes
git checkout -b feat/workspace-integration
# Work across multiple packages
git add packages/ apps/
git commit -m "feat(monorepo): integrate workspace coordination"
```

#### Subtask 4.3: IDE Configuration
**VS Code Workspace Setup**:
```json
// .vscode/settings.json
{
  "python.defaultInterpreterPath": "./packages/vespera-scriptorium/venv/bin/python",
  "python.terminal.activateEnvironment": false,
  "typescript.preferences.includePackageJsonAutoImports": "on"
}
```

### Priority 5: Documentation & Migration Guide
**Specialist**: Technical Writer Agent

#### Subtask 5.1: Monorepo Development Guide
```markdown
# Vespera Atelier Monorepo Development Guide

## Working in the Monorepo

### Quick Start
1. `cd /home/aya/dev/monorepo/vespera-atelier`
2. `pnpm install`
3. `pnpm scriptorium:dev`

### Claude Code Configuration
- Root `.claude/` for monorepo commands
- Package `.claude/` for package-specific tools
- Use workspace-aware MCP configuration

### Package Development
- `packages/vespera-scriptorium/` - Main MCP server
- `packages/vespera-atelier/` - Platform core
- `packages/vespera-utilities/` - Shared utilities
```

#### Subtask 5.2: Migration Instructions
**For Users Transitioning from Original Repo**:
```yaml
migration_steps:
  claude_code_setup:
    action: "Update working directory to monorepo root"
    configuration: "Copy .claude settings with workspace awareness"
    
  mcp_reconfiguration:
    action: "Update MCP server paths"
    validation: "Test orchestrator connection"
    
  development_patterns:
    action: "Adapt to monorepo workflows"
    documentation: "Package-specific vs monorepo-wide changes"
```

## 🔄 Orchestrator Integration Strategy

### Session Management
```yaml
orchestrator_session:
  session_name: "vespera-monorepo-transition"
  working_directory: "/home/aya/dev/monorepo/vespera-atelier"
  coordination_hub: "packages/vespera-scriptorium"
  
meta_task:
  title: "Phase 2B: Monorepo Transition & Development Infrastructure"
  description: "Establish monorepo development patterns and validate dual-mode architecture"
  complexity: "complex"
  task_type: "implementation"
  specialist_type: "coordinator"
```

### Sub-Agent Coordination
```yaml
sub_agents:
  devops_agent:
    specialist_type: "devops"
    focus: "Claude Code configuration and MCP integration"
    deliverable: "Working monorepo .claude configuration"
    
  infrastructure_agent:
    specialist_type: "architect"
    focus: "MCP server validation and dual-mode testing"
    deliverable: "Validated server functionality in monorepo"
    
  build_system_agent:
    specialist_type: "coder"
    focus: "Package management and workspace coordination"
    deliverable: "Working PNPM workspace with Turbo integration"
    
  dx_agent:
    specialist_type: "documenter"
    focus: "Developer experience and workflow documentation"
    deliverable: "Complete monorepo development guide"
```

## 🎯 Success Criteria

### Technical Validation
- [ ] **MCP Server Functions**: Orchestrator tools work from monorepo location
- [ ] **Claude Code Integration**: `.claude` configuration accessible from monorepo root
- [ ] **Dual-Mode Architecture**: All three operational modes tested successfully
- [ ] **Workspace Coordination**: PNPM workspaces link packages correctly
- [ ] **Database Resolution**: Workspace-aware `.task_orchestrator/` creation

### Development Experience
- [ ] **Smooth Workflows**: Package development feels natural in monorepo
- [ ] **Clear Documentation**: Migration and development guides complete
- [ ] **Tool Integration**: VS Code, git, and CLI tools work seamlessly
- [ ] **Performance**: Build times and test execution acceptable

### Strategic Objectives
- [ ] **Development Migration**: Ready to switch primary development to monorepo
- [ ] **UV Integration Path**: Clear roadmap for UV package manager adoption
- [ ] **1.0.0 Release Prep**: Foundation established for version 1.0.0 release
- [ ] **Community Ready**: Documentation supports external contributors

## 🔗 Phase 2C Preparation

**Next Phase**: Complete Migration & 1.0.0 Release Preparation
- Repository renaming strategy execution
- Multi-platform installation testing
- Final transition from original repository
- Public release coordination

## 📝 Executive Dysfunction Support Features

### Workspace Navigation
- **Pre-configured Commands**: Claude Code commands for common monorepo operations
- **Clear Directory Structure**: Numbered priorities and obvious navigation
- **Automated Setup**: Scripts handle configuration complexity

### Progress Preservation
- **Multiple Save Points**: Git commits at package and monorepo level
- **Session Recovery**: Orchestrator maintains state across interruptions
- **Clear Documentation**: Always know where you are and what's next

### Decision Reduction
- **Template Structures**: Pre-built configurations eliminate choice paralysis
- **Default Patterns**: Established workflows for common operations
- **Automation Scripts**: Reduce manual coordination overhead

---

**🎯 Meta-PRP Status**: Ready for multi-agent execution
**🔧 Working Directory**: `/home/aya/dev/monorepo/vespera-atelier`
**📋 Orchestrator Ready**: Initialize session and begin Phase 2B coordination

This meta-PRP addresses both the immediate technical challenges of monorepo .claude configuration and the broader strategic goal of transitioning development to the Vespera Atelier ecosystem.