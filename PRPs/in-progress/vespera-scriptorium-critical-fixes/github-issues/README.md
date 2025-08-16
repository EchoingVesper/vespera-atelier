# GitHub Issues for Vespera-Scriptorium Critical Fixes

**Meta-PRP**: `PRPs/in-progress/vespera-scriptorium-critical-fixes/`  
**Total Issues**: 9 critical bugs identified from comprehensive MCP tools audit  
**Status**: Ready for agent assignment and resolution

## 🚨 Priority 1: Critical System Bugs (4 issues)

| Issue | Title | Severity | Component | Status |
|-------|-------|----------|-----------|---------|
| [#01](01-missing-watchfiles-dependency.md) | Missing watchfiles dependency breaks orchestrator_restart_server | Critical | Server Management | Ready |
| [#02](02-handler-migration-data-mapping.md) | Handler migration data mapping failures block 4 MCP tools | Critical | Task Management | Ready |
| [#03](03-task-session-lookup-failures.md) | Task/Session lookup system failure blocks 3 core tools | Critical | Core Orchestration | Ready |
| [#04](04-template-instantiation-broken.md) | Template instantiation system cannot resolve any templates | Critical | Template System | Ready |

## ⚠️ Priority 2: Workflow-Critical Bugs (2 issues)

| Issue | Title | Severity | Component | Status |
|-------|-------|----------|-----------|---------|
| [#05](05-query-tasks-array-parameters.md) | orchestrator_query_tasks array parameter conversion broken | High | Task Management | Ready |
| [#06](06-missing-tool-registration.md) | orchestrator_create_generic_task missing from MCP tool registration | High | MCP Registration | Ready |

## 🏗️ Priority 3: Architecture Implementation (3 issues)

| Issue | Title | Severity | Component | Status |
|-------|-------|----------|-----------|---------|
| [#07](07-background-automation-system.md) | Implement background automation system for routine tasks | Medium | Architecture | Ready |
| [#08](08-validation-hooks-system.md) | Implement validation hooks system for automatic quality assurance | Medium | Validation | Ready |
| [#09](09-production-readiness-todos.md) | Replace 7 TODO placeholders with production implementations | Medium | Code Quality | Ready |

## 📊 Issue Summary

**By Severity**:
- 🚨 **Critical (P0)**: 4 issues - System-breaking bugs requiring immediate attention
- ⚠️ **High (P1)**: 2 issues - Workflow-blocking bugs affecting user productivity  
- 🔧 **Medium (P2)**: 3 issues - Architecture improvements and production readiness

**By Component**:
- **Task Management**: 3 issues (handler migration, query parameters, missing tool)
- **Server Management**: 1 issue (missing dependency)
- **Template System**: 1 issue (instantiation broken)
- **Core Orchestration**: 1 issue (lookup failures)
- **Architecture**: 2 issues (background automation, validation hooks)
- **Code Quality**: 1 issue (TODO placeholders)

## 🎯 Impact Analysis

**Current System Health**: 68% tool functionality (21/32 tools working)  
**Target System Health**: 90%+ tool functionality after fixes

**Critical Workflow Blocks**:
- ❌ **Server restart functionality** completely broken
- ❌ **Task discovery system** non-functional  
- ❌ **Template workflow** blocked
- ❌ **Session management** unreliable

**Expected Improvements After Fixes**:
- ✅ **All critical workflows** fully functional
- ✅ **Background automation** reducing manual maintenance
- ✅ **Validation hooks** ensuring system quality
- ✅ **Production-ready** codebase without placeholder implementations

## 🔗 Integration with Meta-PRP

Each issue is designed for integration with the meta-PRP orchestrator coordination:

**Orchestrator Integration**:
- Each issue will be linked to specific orchestrator task IDs
- Agent assignments coordinated through orchestrator specialist context
- Progress tracking via orchestrator artifacts and status monitoring
- Result synthesis through orchestrator_synthesize_results

**Git Worktree Strategy**:
- Issues grouped by priority for parallel development in isolated worktrees
- Each priority area gets dedicated development environment
- Auto-preservation and conflict prevention for executive dysfunction support

## 📋 Next Steps for Agents

1. **Agent Assignment**: Each priority area gets specialized agent with orchestrator context
2. **Task Linkage**: Link GitHub issues to orchestrator task IDs for tracking
3. **Worktree Setup**: Create isolated development environments for parallel work
4. **Implementation**: Systematic resolution with progress tracking via orchestrator
5. **Validation**: Comprehensive testing and verification of all fixes

---

**Note**: These issues are documented locally since GitHub API permissions prevented direct issue creation. They contain all necessary context for systematic resolution by specialized agents.