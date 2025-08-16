# [CRITICAL] Missing watchfiles dependency breaks orchestrator_restart_server

**Severity**: Critical (P0)  
**Component**: Server Management Tools  
**Orchestrator Task**: Will be linked to fix agent task  
**Meta-PRP**: `PRPs/in-progress/vespera-scriptorium-critical-fixes/`

## 🚨 Critical Bug: Server Restart Functionality Completely Broken

## Problem Description

The `orchestrator_restart_server` MCP tool is completely non-functional due to a missing `watchfiles` dependency, leaving users unable to restart the server and causing the server to enter a failed maintenance mode.

## Reproduction Steps

1. Call `orchestrator_restart_server` MCP tool
2. Observe error: `ModuleNotFoundError: No module named 'watchfiles'`
3. Server enters failed state and cannot be restarted

## Expected Behavior

- Server restart should work reliably
- Graceful shutdown preparation should succeed
- Server should restart cleanly without entering failed state

## Actual Behavior

```
ModuleNotFoundError: No module named 'watchfiles'
Server state: FAILED_MAINTENANCE_MODE
Restart functionality: UNAVAILABLE
```

## Root Cause Analysis

Missing dependency in `pyproject.toml`. The server restart functionality requires `watchfiles>=0.18.0` but it's not declared in dependencies.

## Fix Required

1. **Add dependency**: Add `watchfiles>=0.18.0` to `/home/aya/dev/monorepo/vespera-atelier/packages/vespera-scriptorium/pyproject.toml`
2. **Test restart functionality** after dependency fix
3. **Verify graceful shutdown** works correctly
4. **Update documentation** if needed

## Impact

- **Users cannot restart vespera-scriptorium server**
- **Server can enter unrecoverable failed states**
- **Administrative operations blocked**
- **Production deployments affected**

## Technical Context

- File: `vespera_scriptorium/reboot/reboot_tools.py`
- Handler: `handle_restart_server`
- Architecture: Server management layer
- Dependencies: Missing `watchfiles` package

## Acceptance Criteria

- [ ] `watchfiles>=0.18.0` added to pyproject.toml
- [ ] `orchestrator_restart_server` executes successfully
- [ ] Server restart completes without errors
- [ ] No more FAILED_MAINTENANCE_MODE states
- [ ] Comprehensive testing of restart functionality

## Labels

`critical`, `bug`, `server-management`, `dependencies`, `vespera-scriptorium`