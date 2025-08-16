# Vespera-Scriptorium Critical Fixes Meta-PRP

**Template Compliance**: Created using [PRPs/templates/meta_prp_structure.md](../meta_prp_structure.md)  
**Philosophy**: Executive Dysfunction-Aware Multi-Agent Coordination  
**Git Strategy**: Worktree isolation for conflict-free parallel development

**Status**: [IN-PROGRESS]  
**Meta-PRP ID**: `VESPERA_CRITICAL_FIXES_META_PRP_2025`  
**Created**: 2025-08-16  
**Estimated Duration**: 8 hours

## 📁 Directory Structure

```directory
vespera-scriptorium-critical-fixes/
├── 00-main-coordination/       # Main orchestrator coordination hub
│   ├── index.md               # PRIMARY ENTRY POINT - Start here!
│   └── tracking/              # Progress tracking and checklists
│       └── checklist.md       # Master tracking checklist
│
├── 01-critical-system-bugs/   # PRIORITY 1 - System-Breaking Bugs (4 issues)
│   ├── index.md              # Priority coordination
│   └── subtasks/             # Individual bug fixes
│       ├── watchfiles-dependency/     # Missing dependency fix
│       ├── handler-migration-mapping/ # Data mapping issues
│       ├── task-session-lookup/       # Lookup failures
│       └── template-instantiation/    # Template resolution bug
│
├── 02-workflow-critical-bugs/ # PRIORITY 2 - Workflow-Breaking Bugs (2 issues)
│   ├── index.md              # Priority coordination
│   └── subtasks/             # Individual workflow fixes
│       ├── query-tasks-arrays/        # Array parameter failure
│       └── missing-tool-registration/ # Missing orchestrator_create_generic_task
│
├── 03-architecture-implementation/ # PRIORITY 3 - Background Automation (3 areas)
│   ├── index.md              # Priority coordination
│   └── subtasks/             # Architecture improvements
│       ├── background-automation/     # Auto-install, cleanup, monitoring
│       ├── validation-hooks/          # Automatic validation system
│       └── production-readiness/      # Replace TODO placeholders
│
└── 04-integration-testing/    # PRIORITY 4 - Testing & Validation
    ├── index.md              # Priority coordination
    └── subtasks/             # Testing tasks
        ├── comprehensive-testing/     # Full system validation
        └── github-issues-tracking/   # Issue creation and tracking
```

## 🚀 Quick Start

**To use this template:**

1. **Copy Template**: `cp -r PRPs/templates/meta-prp-template PRPs/in-progress/{your-project-name}`
2. **Fill Placeholders**: Replace all `{PLACEHOLDER}` values throughout files
3. **Customize Priorities**: Rename and configure the 4 priority areas
4. **Initialize Orchestrator**: Use `orchestrator_initialize_session` from the new directory
5. **Begin Execution**: Start with `00-main-coordination/index.md`

## 🎯 Priorities Overview

| Priority | Task | Status | Completion Target |
|----------|------|--------|------------------|
| **1** | Critical System Bugs (4 issues) | [IN-PROGRESS] | 4 hours |
| **2** | Workflow-Breaking Bugs (2 issues) | [DRAFT] | 2 hours |
| **3** | Architecture Implementation (3 areas) | [DRAFT] | 3 hours |
| **4** | Integration Testing & Validation | [DRAFT] | 1 hour |

## 🤖 Orchestrator Integration

- **Session ID**: `session_65574b8d_1755323773`
- **Parent Task**: `task_1477b237`
- **Working Directory**: `/home/aya/dev/monorepo/vespera-atelier/PRPs/in-progress/vespera-scriptorium-critical-fixes`
- **Coordination Method**: Multi-agent swarm with git worktree isolation

## 📚 Key Concepts

### What We're Building

**Vespera-Scriptorium Critical Fixes**: Systematic resolution of 9 critical bugs blocking core workflows in the vespera-scriptorium MCP tools, plus implementation of background automation architecture to improve system reliability from 68% to 90%+ tool success rate.

### Why This Structure

- **Systematic Approach**: Each bug gets dedicated GitHub issue, specialized agent, and isolated git worktree to prevent conflicts and enable parallel execution
- **Agent Coordination**: Designed for multi-agent execution via orchestrator with specialist context and artifact storage
- **Executive Dysfunction Support**: Pre-created directory structure eliminates decision paralysis, isolated worktrees prevent overwhelm, auto-preservation prevents lost work

## 🔗 Related Documents

### Template and Design Philosophy

- [PRPs/templates/meta_prp_structure.md](../meta_prp_structure.md) - Template structure used
- [executive-dysfunction-philosophy.md](executive-dysfunction-philosophy.md) - Core design principles
- [git-worktree-strategy.md](git-worktree-strategy.md) - Multi-agent coordination strategy

### Source Context

- **Comprehensive MCP Tools Audit**: Results from systematic testing of all 32 vespera-scriptorium tools
- **Handler Migration Analysis**: Investigation of Pydantic vs dictionary handler transition issues
- **Architecture Review**: Assessment of MCP tools vs background automation recommendations

## ⚡ Next Steps

**PHASE 1**: Critical System Bug Fixes

1. **Create GitHub Issues** (Priority: High)
   - Create detailed issues for each of the 9 critical bugs
   - Link issues to orchestrator task IDs for tracking
   - Include reproduction steps from audit findings

2. **Initialize Git Worktrees** (Priority: High)
   - Create isolated worktrees for each priority area
   - Set up branch structure for parallel development
   - Configure auto-preservation for executive dysfunction support

### **Available Context/Inputs**

- **Comprehensive audit artifacts** stored in orchestrator task system
- **Specialist testing reports** with detailed bug reproduction steps
- **Architecture recommendations** for background automation design
- **Handler migration analysis** documenting data structure issues

## 🎨 Vision

A reliable, production-ready vespera-scriptorium with 90%+ tool success rate, background automation for routine tasks, and systematic validation processes that prevent regressions. Users can trust the system for critical workflows without worrying about fundamental failures.

---

## 🏆 Success Metrics

**Achievement Scores Target**:
- Context Engineering: 10/10
- Security Integration: 9/10
- Orchestrator Integration: 10/10
- Multi-Agent Coordination: 10/10
- Executive Dysfunction Design: 10/10
- Future Automation Readiness: 9/10

**Git Worktree Strategy**: Active (4 isolated worktrees for parallel development)

**Next Phase**: After critical fixes, implement advanced monitoring and user experience improvements

---

**Remember**: This meta-PRP addresses fundamental system reliability issues that block user workflows. Success means users can trust vespera-scriptorium for production work without encountering critical failures.