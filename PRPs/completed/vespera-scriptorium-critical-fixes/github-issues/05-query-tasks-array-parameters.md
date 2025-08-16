# [HIGH] orchestrator_query_tasks array parameter conversion broken

**Severity**: High (P1)  
**Component**: Task Management Tools  
**Orchestrator Task**: Will be linked to fix agent task  
**Meta-PRP**: `PRPs/in-progress/vespera-scriptorium-critical-fixes/`

## 🔍 High Priority Bug: Task Discovery System Blocked by Array Parameter Failures

## Problem Description

The `orchestrator_query_tasks` tool fails with array parameter conversion errors, completely blocking task discovery functionality. This is part of the broader handler migration issues but specifically affects the query system's ability to handle arrays and date parameters.

## Reproduction Steps

1. Try to query tasks with array parameters:
   ```python
   orchestrator_query_tasks(
       status=["pending", "in_progress"],
       task_type=["testing", "implementation"]
   )
   ```
2. Observe error: `"type 'list' is not supported"`
3. Try with date parameters and observe date formatting errors
4. Task discovery is completely blocked

## Expected Behavior

- Array parameters should be properly converted and handled
- Date parameters should work correctly
- Task queries should return filtered results
- Task discovery should be fully functional

## Actual Behavior

```python
# Array parameter failure:
Input: status=["pending", "in_progress"]
Output: "type 'list' is not supported"

# Date parameter failure:  
Input: created_after="2025-08-16"
Output: Date formatting error

# Task discovery blocked:
Result: Cannot discover or filter tasks effectively
Impact: Task management workflow broken
```

## Root Cause Analysis

**Handler migration conversion issue**: The migration from dictionary to Pydantic handlers doesn't properly convert:
1. **Array parameters** - Lists not converted between handler formats
2. **Date parameters** - String vs datetime object confusion
3. **Complex parameter structures** - Nested objects and filters

## Fix Required

1. **Implement proper array parameter conversion** in handler migration system
2. **Fix date/time parameter handling** - consistent string/datetime conversion
3. **Add parameter type validation** and conversion for complex structures
4. **Test query functionality** with all parameter types
5. **Verify migration system** handles all data types correctly

## Impact

- **Task discovery completely blocked** - cannot find or filter tasks
- **Workflow management severely impacted** - cannot query task status
- **Debugging and monitoring difficult** - cannot inspect task states
- **Multi-agent coordination hindered** - agents cannot find tasks

## Technical Context

- Files:
  - Query handler: `vespera_scriptorium/infrastructure/mcp/handlers/task_handlers.py`
  - Migration system: `vespera_scriptorium/infrastructure/mcp/handlers/migration_config.py`
  - Parameter conversion logic in migration layer
- Architecture: MCP handler migration and parameter conversion system
- Issue: Array and date parameter conversion in handler migration

## Related Issues

This is closely related to issue #02 (Handler migration data mapping) but specifically focuses on the query system parameter conversion failures.

## Acceptance Criteria

- [ ] `orchestrator_query_tasks` handles array parameters correctly
- [ ] Date parameter conversion works for all date formats
- [ ] Complex parameter structures are properly converted
- [ ] Task discovery and filtering fully functional
- [ ] Query system works with all planned parameter types

## Labels

`high`, `bug`, `task-query`, `handler-migration`, `parameter-conversion`, `vespera-scriptorium`