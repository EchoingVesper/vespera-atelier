# PRP: Vespera Scriptorium Connection and Orchestrator Bug Fixes

**Status**: [COMPLETED] ✅  
**Completed**: 2025-08-16  
**Resolution**: All issues fixed as part of meta-PRP execution

## Executive Summary

~~Fix two critical issues preventing proper Vespera Scriptorium operation:~~
**COMPLETED**: Both critical issues successfully resolved:
1. ✅ MCP server connection fixed through proper package.json configuration
2. ✅ Orchestrator query errors resolved with improved data handling

## Problem Statement

### Issue 1: Scriptorium MCP Connection Failure
- **Root Cause**: The vespera-scriptorium package is installed in a local venv but scripts reference it globally
- **Impact**: MCP server cannot start, blocking all orchestrator functionality
- **Evidence**: `which vespera-scriptorium` returns error, but `./venv/bin/vespera-scriptorium` works

### Issue 2: Orchestrator Query Errors
- **Root Cause**: Database query handling issues with datetime serialization
- **Impact**: Tasks cannot be synthesized or queried properly
- **Evidence**: User reported "'str' object has no attribute 'isoformat'" errors

## Context References

### Required Files to Review
```yaml
files_to_read:
  - file: packages/vespera-scriptorium/pyproject.toml
    why: "Package configuration and entry points"
    sections: ["project.scripts"]
    
  - file: package.json
    why: "Monorepo scripts that need path fixes"
    sections: ["scripts.dev:scriptorium", "scripts.build:scriptorium"]
    
  - file: packages/vespera-scriptorium/vespera_scriptorium/domain/repositories/task_repository.py
    why: "Task repository interface for query methods"
    sections: ["query_tasks", "get_task_by_id"]
    
  - file: packages/vespera-scriptorium/vespera_scriptorium/infrastructure/database/sqlite/sqlite_task_repository.py
    why: "SQLite implementation with datetime handling"
    sections: ["query_tasks", "_build_query", "datetime handling"]
```

### Pattern References
```yaml
existing_patterns:
  - file: packages/vespera-scriptorium/CLAUDE.md
    pattern: "MCP server restart procedure after code changes"
    
  - file: packages/vespera-scriptorium/install.sh
    pattern: "Virtual environment activation and path setup"
```

## Implementation Blueprint

### Phase 1: Fix Vespera Scriptorium Path References

#### 1.1 Update Root package.json Scripts
```javascript
// In package.json at lines 31-32
"dev:scriptorium": "cd packages/vespera-scriptorium && ./venv/bin/vespera-scriptorium --server",
"build:scriptorium": "cd packages/vespera-scriptorium && ./venv/bin/pip install -e '.[dev]' && ./venv/bin/python -m build",
```

#### 1.2 Create MCP Server Launch Script
```bash
# Create packages/vespera-scriptorium/launch_server.sh
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate 2>/dev/null || true
exec vespera-scriptorium --server "$@"
```

#### 1.3 Update MCP Configuration
```json
// For Claude Code MCP configuration
{
  "mcpServers": {
    "vespera-scriptorium": {
      "command": "bash",
      "args": ["packages/vespera-scriptorium/launch_server.sh"],
      "env": {
        "MCP_TASK_ORCHESTRATOR_USE_DI": "true"
      }
    }
  }
}
```

### Phase 2: Fix Orchestrator Query Errors

#### 2.1 Fix DateTime Serialization in Query Methods
```python
# In packages/vespera-scriptorium/vespera_scriptorium/infrastructure/database/sqlite/sqlite_task_repository.py
# Around line 200-250 in query_tasks method

def _serialize_datetime(self, dt):
    """Safely serialize datetime objects."""
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt  # Already a string
    if hasattr(dt, 'isoformat'):
        return dt.isoformat()
    return str(dt)

def query_tasks(self, filters: Dict[str, Any]) -> List[Task]:
    """Query tasks with proper datetime handling."""
    # ... existing query building code ...
    
    # Fix datetime fields in results
    for task in tasks:
        if hasattr(task, 'created_at'):
            task.created_at = self._serialize_datetime(task.created_at)
        if hasattr(task, 'updated_at'):
            task.updated_at = self._serialize_datetime(task.updated_at)
        if hasattr(task, 'completed_at'):
            task.completed_at = self._serialize_datetime(task.completed_at)
    
    return tasks
```

#### 2.2 Fix Task ID Generation and Storage
```python
# In packages/vespera-scriptorium/vespera_scriptorium/domain/services/task_service.py
# Ensure consistent task ID format

def generate_task_id(self) -> str:
    """Generate unique task ID with consistent format."""
    import uuid
    return f"task_{uuid.uuid4().hex[:8]}"

def validate_task_id(self, task_id: str) -> bool:
    """Validate task ID format."""
    import re
    return bool(re.match(r'^task_[a-f0-9]{8}$', task_id))
```

### Phase 3: Add Comprehensive Error Handling

#### 3.1 Wrap Orchestrator Methods with Error Recovery
```python
# In packages/vespera-scriptorium/vespera_scriptorium/orchestrator/task_orchestration_service.py

def synthesize_results(self, parent_task_id: str) -> Dict[str, Any]:
    """Synthesize results with error recovery."""
    try:
        # Validate task ID format
        if not self.validate_task_id(parent_task_id):
            return {
                "status": "synthesis_failed",
                "error": f"Invalid task ID format: {parent_task_id}",
                "recovery_suggestions": [
                    "Verify the task ID format (task_XXXXXXXX)",
                    "Use orchestrator_query_tasks to find valid tasks"
                ]
            }
        
        # Check if task exists
        task = self.task_repository.get_task_by_id(parent_task_id)
        if not task:
            return {
                "status": "synthesis_failed", 
                "error": f"Parent task {parent_task_id} not found",
                "parent_task_id": parent_task_id,
                "recovery_suggestions": [
                    "Verify the parent task ID exists",
                    "Use orchestrator_query_tasks to find valid tasks"
                ]
            }
        
        # ... rest of synthesis logic ...
        
    except Exception as e:
        logger.error(f"Synthesis error: {str(e)}")
        return {
            "status": "synthesis_error",
            "error": str(e),
            "parent_task_id": parent_task_id
        }
```

## Validation Framework

### Stage 1: Path Resolution Testing
```bash
# Test venv path resolution
cd packages/vespera-scriptorium
./venv/bin/vespera-scriptorium --health-check

# Test package.json scripts
cd /home/aya/dev/monorepo/vespera-atelier
pnpm run dev:scriptorium &
sleep 5
pkill -f vespera-scriptorium
```

### Stage 2: MCP Connection Testing
```bash
# Test MCP server launch
cd packages/vespera-scriptorium
bash launch_server.sh &
SERVER_PID=$!
sleep 3
kill $SERVER_PID

# Test with Claude Code (if available)
claude mcp restart vespera-scriptorium
claude mcp list | grep vespera-scriptorium
```

### Stage 3: Orchestrator Query Testing
```python
# Create test script: test_orchestrator_queries.py
import sys
sys.path.insert(0, 'packages/vespera-scriptorium')

from vespera_scriptorium.infrastructure.database.sqlite.sqlite_task_repository import SqliteTaskRepository

# Test datetime handling
repo = SqliteTaskRepository(":memory:")
tasks = repo.query_tasks({"status": "pending"})
for task in tasks:
    assert isinstance(task.created_at, (str, type(None)))
    print(f"Task {task.task_id}: created_at is properly serialized")

# Test task ID validation
from vespera_scriptorium.domain.services.task_service import TaskService
service = TaskService()
assert service.validate_task_id("task_12345678") == True
assert service.validate_task_id("invalid_id") == False
print("Task ID validation working correctly")
```

### Stage 4: Integration Testing
```bash
# Full integration test
cd packages/vespera-scriptorium
pytest tests/integration/test_orchestrator.py -v
pytest tests/integration/test_task_execution.py -v
```

### Stage 5: User Acceptance Testing
```bash
# Test the full workflow
pnpm install
pnpm run dev:scriptorium &
# In another terminal:
pnpm run test:scriptorium
```

## Security Considerations

1. **Path Traversal Prevention**: Use absolute paths in launch scripts
2. **Environment Isolation**: Keep venv isolated from system Python
3. **Error Message Sanitization**: Don't expose internal paths in error messages
4. **Input Validation**: Validate all task IDs and datetime inputs

## Rollback Plan

If issues persist after implementation:

1. **Immediate Rollback**:
   ```bash
   git stash  # Save current changes
   git checkout HEAD -- package.json
   git checkout HEAD -- packages/vespera-scriptorium/
   ```

2. **Alternative Approach**:
   - Use pipx for global installation: `pipx install ./packages/vespera-scriptorium`
   - Update package.json to use pipx path

## Task Breakdown

1. [ ] Update package.json with venv paths
2. [ ] Create launch_server.sh script
3. [ ] Fix datetime serialization in sqlite_task_repository.py
4. [ ] Add task ID validation in task_service.py
5. [ ] Enhance error handling in task_orchestration_service.py
6. [ ] Run validation tests
7. [ ] Update documentation with new launch procedure
8. [ ] Test with fresh clone to verify GitHub Issue #1 remains fixed

## Success Criteria

- [ ] `pnpm run dev:scriptorium` successfully starts the MCP server
- [ ] MCP server connects properly in Claude Code
- [ ] No datetime serialization errors in orchestrator queries
- [ ] Task synthesis works with valid task IDs
- [ ] Error messages provide helpful recovery suggestions
- [ ] Fresh clone and setup works without errors

## Quality Scores

- **Context Engineering Score**: 9/10 - Comprehensive file references and patterns
- **Security Integration Score**: 8/10 - Path security and input validation included
- **Overall Confidence Score**: 9/10 - Clear root causes identified with specific fixes

## Next Steps

After implementation:
1. Close GitHub Issue #1 with confirmation of fixes
2. Update CHANGELOG.md with bug fixes
3. Consider adding automated tests for MCP server launch
4. Document venv setup requirements in GETTING_STARTED.md