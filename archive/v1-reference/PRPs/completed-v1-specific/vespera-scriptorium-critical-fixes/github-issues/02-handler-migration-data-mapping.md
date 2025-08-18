# [CRITICAL] Handler migration data mapping failures block 4 MCP tools

**Severity**: Critical (P0)  
**Component**: Task Management Tools / Handler Migration System  
**Orchestrator Task**: Will be linked to fix agent task  
**Meta-PRP**: `PRPs/in-progress/vespera-scriptorium-critical-fixes/`

## 🚨 Critical Bug: Handler Migration System Data Structure Incompatibility

## Problem Description

The migration from old dictionary handlers to new Pydantic handlers has fundamental data structure compatibility issues causing 4 critical MCP tools to fail with mapping errors:

- `orchestrator_update_task` - Cannot modify existing tasks
- `orchestrator_delete_task` - Cannot remove tasks
- `orchestrator_query_tasks` - Cannot execute queries (blocks task discovery)  
- `orchestrator_create_generic_task` - Tool missing entirely from registration

## Reproduction Steps

### For orchestrator_update_task:
1. Create a task with `orchestrator_plan_task`
2. Try to update it with `orchestrator_update_task`
3. Observe error: `"'str' object is not a mapping"`

### For orchestrator_query_tasks:
1. Call `orchestrator_query_tasks` with any parameters
2. Observe error: `"type 'list' is not supported"` for array parameters
3. Date formatting errors prevent any queries from working

## Expected Behavior

- Task update operations should succeed
- Task deletion should work correctly
- Query operations should handle arrays and dates properly
- All planned MCP tools should be registered and functional

## Actual Behavior

```python
# orchestrator_update_task / orchestrator_delete_task
Error: "'str' object is not a mapping"
Handler data mapping: BROKEN
Task lifecycle operations: BLOCKED

# orchestrator_query_tasks  
Error: "type 'list' is not supported"
Array parameter conversion: BROKEN
Date formatting: FAILED
Task discovery: COMPLETELY BLOCKED
```

## Root Cause Analysis

1. **Data Structure Mismatch**: Migration system expects different data structures between old/new handlers
2. **Parameter Type Conversion**: Array parameters not properly converted between dictionary and Pydantic formats
3. **Date/Time Object Confusion**: String vs datetime object handling inconsistencies
4. **Missing Tool Registration**: `orchestrator_create_generic_task` not registered as MCP tool

## Fix Required

1. **Fix parameter mapping** between old and new handler formats
2. **Implement proper array parameter conversion** for query operations
3. **Resolve date/time serialization** inconsistencies
4. **Add missing tool registration** for `orchestrator_create_generic_task`
5. **Test complete handler migration workflow**

## Impact

- **Task lifecycle management broken** (update/delete operations fail)
- **Task discovery completely blocked** (query system non-functional)
- **Workflow management severely impacted**
- **60% failure rate in task management tools**

## Technical Context

- Files: 
  - `vespera_scriptorium/infrastructure/mcp/handlers/migration_config.py`
  - `vespera_scriptorium/infrastructure/mcp/tool_router.py`
  - Handler migration system components
- Architecture: MCP handler migration layer
- Issue: Data structure compatibility between old/new handlers

## Acceptance Criteria

- [ ] `orchestrator_update_task` successfully updates tasks
- [ ] `orchestrator_delete_task` successfully removes tasks  
- [ ] `orchestrator_query_tasks` handles arrays and dates correctly
- [ ] `orchestrator_create_generic_task` registered and functional
- [ ] All handler migration tests pass
- [ ] Parameter conversion works for all data types

## Labels

`critical`, `bug`, `handler-migration`, `task-management`, `vespera-scriptorium`