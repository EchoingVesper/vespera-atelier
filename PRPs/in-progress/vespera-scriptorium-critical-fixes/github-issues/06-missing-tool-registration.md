# [HIGH] orchestrator_create_generic_task missing from MCP tool registration

**Severity**: High (P1)  
**Component**: Task Management Tools / MCP Registration  
**Orchestrator Task**: Will be linked to fix agent task  
**Meta-PRP**: `PRPs/in-progress/vespera-scriptorium-critical-fixes/`

## 📋 High Priority Bug: Planned MCP Tool Not Available to Users

## Problem Description

The `orchestrator_create_generic_task` tool was identified in the audit scope as one of the 32 vespera-scriptorium tools, but it's not actually registered as an MCP tool. Users cannot access this functionality despite it being part of the planned tool suite.

## Reproduction Steps

1. Check available MCP tools in Claude Code (`/mcp` menu)
2. Look for `orchestrator_create_generic_task` in tool list
3. Observe: Tool is missing from available tools
4. Verify: Other task management tools are present
5. Confirm: Tool should exist based on audit scope

## Expected Behavior

- `orchestrator_create_generic_task` should be available as MCP tool
- Tool should be registered alongside other task management tools
- Users should be able to create generic tasks through MCP interface
- Tool suite should be complete as originally planned

## Actual Behavior

```python
# Available task management tools:
✅ orchestrator_plan_task - Available
✅ orchestrator_execute_task - Available  
✅ orchestrator_complete_task - Available
✅ orchestrator_update_task - Available (but broken)
✅ orchestrator_delete_task - Available (but broken)
✅ orchestrator_cancel_task - Available
✅ orchestrator_query_tasks - Available (but broken)
❌ orchestrator_create_generic_task - MISSING

# Tool registration gap:
Expected: 8 task management tools
Actual: 7 task management tools
Status: INCOMPLETE TOOL SUITE
```

## Root Cause Analysis

**Tool registration oversight**: The tool exists in codebase planning but was never:
1. **Implemented** as an MCP tool handler
2. **Registered** in the MCP tool router  
3. **Added** to tool definitions
4. **Tested** as part of tool suite

## Investigation Required

1. **Check if tool handler exists** in codebase but isn't registered
2. **Determine if tool needs implementation** from scratch
3. **Verify tool specifications** and intended functionality  
4. **Review tool registration process** for gaps

## Fix Required

1. **Implement tool handler** if missing from codebase
2. **Register tool** in MCP tool router and definitions
3. **Add tool validation** and testing
4. **Document tool functionality** and usage
5. **Verify complete tool suite** availability

## Impact

- **Incomplete tool suite** - users missing planned functionality
- **Tool discovery confusion** - audit assumes tool exists but it doesn't
- **Workflow gaps** - potential missing functionality for generic task creation
- **Documentation inconsistency** - tool referenced but not available

## Technical Context

- Files:
  - Tool router: `vespera_scriptorium/infrastructure/mcp/tool_router.py`
  - Tool handlers: `vespera_scriptorium/infrastructure/mcp/handlers/task_handlers.py`
  - Tool definitions: MCP tool definition system
- Architecture: MCP tool registration and routing system
- Issue: Missing tool implementation or registration

## Related Issues

This complements the other task management tool issues (#02, #05) by ensuring the complete tool suite is available once bugs are fixed.

## Acceptance Criteria

- [ ] `orchestrator_create_generic_task` implemented as MCP tool
- [ ] Tool registered and available in MCP interface
- [ ] Tool functionality tested and working
- [ ] Complete tool suite (8 task management tools) available
- [ ] Tool documentation updated

## Labels

`high`, `enhancement`, `tool-registration`, `task-management`, `missing-feature`, `vespera-scriptorium`