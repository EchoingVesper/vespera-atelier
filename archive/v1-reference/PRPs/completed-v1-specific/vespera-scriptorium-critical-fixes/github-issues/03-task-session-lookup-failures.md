# [CRITICAL] Task/Session lookup system failure blocks 3 core tools

**Severity**: Critical (P0)  
**Component**: Core Orchestration Tools  
**Orchestrator Task**: Will be linked to fix agent task  
**Meta-PRP**: `PRPs/in-progress/vespera-scriptorium-critical-fixes/`

## 🚨 Critical Bug: Task/Session Lookup System Cannot Find Existing Data

## Problem Description

Three core orchestration tools cannot retrieve tasks/sessions that clearly exist in the system, indicating a fundamental database or file path resolution problem:

- `orchestrator_session_status` - Cannot find sessions that exist
- `orchestrator_resume_session` - Same session lookup issue  
- `orchestrator_synthesize_results` - Cannot find tasks visible in get_status

## Reproduction Steps

### For orchestrator_session_status:
1. Initialize session with `orchestrator_initialize_session`
2. Verify session exists with `orchestrator_list_sessions`
3. Try to get status with `orchestrator_session_status session_id="<session_id>"`
4. Observe error: `"Parent task <task_id> not found"`

### For orchestrator_synthesize_results:
1. Create tasks that are visible in `orchestrator_get_status`
2. Try to synthesize with `orchestrator_synthesize_results parent_task_id="<task_id>"`
3. Observe error: `"Parent task <task_id> not found"`

## Expected Behavior

- Session status should be retrievable for existing sessions
- Session resumption should work for valid session IDs
- Result synthesis should work for tasks visible in status

## Actual Behavior

```python
# orchestrator_session_status
Input: session_id="session_65574b8d_1755323773" (exists in list_sessions)
Output: "Parent task task_1477b237 not found"
Status: LOOKUP FAILED

# orchestrator_resume_session
Input: session_id="session_65574b8d_1755323773"  
Output: "Session not found or cannot be resumed"
Status: LOOKUP FAILED

# orchestrator_synthesize_results  
Input: parent_task_id="task_1477b237" (visible in get_status)
Output: "Parent task task_1477b237 not found"
Status: LOOKUP FAILED
```

## Root Cause Analysis

**Fundamental issue**: Task/session lookup system cannot locate data that exists

**Possible causes**:
1. **Database path resolution**: Wrong database file being queried
2. **Session isolation**: Tasks stored in different session contexts
3. **File system issues**: Database files not properly synchronized
4. **Query logic bugs**: Lookup queries using wrong parameters or logic

## Fix Required

1. **Investigate database file paths** - ensure all tools query same database
2. **Debug session context isolation** - verify task storage and retrieval contexts match
3. **Fix query logic** - ensure lookup parameters and SQL queries are correct
4. **Add comprehensive logging** to track where tasks are stored vs retrieved
5. **Test cross-tool consistency** - ensure all tools see same data

## Impact

- **Core workflow coordination broken** (cannot resume sessions)
- **Result aggregation impossible** (synthesis fails)
- **Session management unreliable** (status checks fail)
- **Multi-agent coordination blocked**

## Technical Context

- Files:
  - Session management: `vespera_scriptorium/orchestrator/orchestration_state_manager.py`
  - Database layer: `vespera_scriptorium/infrastructure/database/`
  - Core handlers: `vespera_scriptorium/infrastructure/mcp/handlers/core_handlers.py`
- Architecture: Database persistence and session management layers
- Issue: Data lookup and retrieval system failures

## Acceptance Criteria

- [ ] `orchestrator_session_status` finds existing sessions
- [ ] `orchestrator_resume_session` successfully resumes valid sessions
- [ ] `orchestrator_synthesize_results` finds tasks from get_status
- [ ] All tools query same consistent data store
- [ ] Lookup system reliability verified with comprehensive tests

## Labels

`critical`, `bug`, `database`, `session-management`, `task-lookup`, `vespera-scriptorium`