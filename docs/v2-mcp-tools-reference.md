# Vespera Scriptorium V2 MCP Tools Reference

---

## ⚠️ IMPLEMENTATION STATUS WARNING

**THIS DOCUMENT DESCRIBES UNIMPLEMENTED V2 TOOLS**

This reference documentation describes a planned set of V2 MCP tools that **are not fully implemented**. The tool signatures, parameters, and behaviors described here represent aspirational design goals.

**Current Reality (Phase 15 - October 2025)**:
- ❌ `create_task_tree`: **NOT IMPLEMENTED**
- ❌ `get_task_tree`: **NOT IMPLEMENTED**
- ❌ `analyze_task_dependencies`: **NOT IMPLEMENTED**
- ❌ `add_task_dependency`: **NOT IMPLEMENTED**
- ✅ `create_task`, `get_task`, `update_task`: **IMPLEMENTED** (basic versions)
- ✅ `list_tasks`, `delete_task`, `complete_task`: **IMPLEMENTED** (basic versions)
- ✅ `execute_task`, `assign_role_to_task`: **IMPLEMENTED** (basic versions)
- ✅ `get_dashboard_stats`, `list_roles`, `health_check`: **IMPLEMENTED**

**Actual Current Tools**: See `packages/vespera-scriptorium/mcp_server.py` for implemented MCP tools

**This document is preserved for reference and future API design.**

---

## Overview

Vespera Scriptorium V2 provides 14 comprehensive MCP tools for complete task lifecycle management. All tools are available through Claude Code's MCP integration and use Pydantic validation for type safety.

## Tool Categories

### 📋 Task Management
Core task creation, retrieval, and modification operations.

### 🏗️ Task Hierarchy  
Parent-child relationships and tree structure management.

### ⚡ Task Execution
Role-based execution and completion workflows.

### 🔗 Dependencies & Analytics
Dependency management and progress monitoring.

---

## Task Management Tools

### `create_task`
**Purpose**: Create a new individual task  
**Usage**: Basic task creation with metadata

**Input Parameters**:
```python
{
  "task_input": {
    "title": "string",              # Required: Task title
    "description": "string",        # Optional: Detailed description  
    "priority": "string",           # Optional: low|normal|high|urgent
    "role": "string",              # Optional: Assigned role name
    "parent_id": "string",         # Optional: Parent task ID
    "project_id": "string",        # Optional: Project identifier
    "feature": "string"            # Optional: Feature area
  }
}
```

**Example**:
```json
{
  "task_input": {
    "title": "Implement user authentication",
    "description": "Create login/logout functionality with JWT tokens",
    "priority": "high",
    "role": "implementer",
    "feature": "authentication"
  }
}
```

**Returns**: Task object with generated ID and metadata

---

### `get_task`
**Purpose**: Retrieve detailed task information  
**Usage**: Query task status, relationships, and execution details

**Input Parameters**:
```python
{
  "task_id": "string"  # Required: Task ID to retrieve
}
```

**Returns**: Complete task object including:
- Basic metadata (title, description, priority)
- Status and timestamps
- Parent/child relationships 
- Role assignments
- Execution history
- Dependencies

---

### `update_task`
**Purpose**: Modify existing task properties  
**Usage**: Change task metadata, status, or assignments

**Input Parameters**:
```python
{
  "update_input": {
    "task_id": "string",           # Required: Task ID to update
    "title": "string",             # Optional: New title
    "description": "string",       # Optional: New description
    "status": "string",            # Optional: TODO|DOING|REVIEW|DONE
    "priority": "string",          # Optional: low|normal|high|urgent
    "role": "string"              # Optional: New role assignment
  }
}
```

**Status Workflow**: TODO → DOING → REVIEW → DONE

---

### `delete_task`
**Purpose**: Remove tasks and optionally their children  
**Usage**: Clean up completed or cancelled tasks

**Input Parameters**:
```python
{
  "task_id": "string",    # Required: Task ID to delete
  "recursive": boolean    # Optional: Delete children too (default: true)
}
```

**Behavior**:
- `recursive=true`: Deletes task and all descendants
- `recursive=false`: Deletes only the specified task

---

### `list_tasks`
**Purpose**: Query tasks with filtering and pagination  
**Usage**: Find tasks by status, assignee, project, etc.

**Input Parameters**:
```python
{
  "project_id": "string",        # Optional: Filter by project
  "status_filter": "string",     # Optional: Filter by status
  "priority_filter": "string",   # Optional: Filter by priority
  "assignee": "string",          # Optional: Filter by assigned role
  "parent_id": "string",         # Optional: Filter by parent task
  "limit": integer               # Optional: Max results (default: 50)
}
```

**Returns**: Array of matching tasks with summary information

---

## Task Hierarchy Tools

### `create_task_tree`
**Purpose**: Create hierarchical task structures  
**Usage**: Define complex projects with parent-child relationships

**Input Parameters**:
```python
{
  "tree_input": {
    "title": "string",             # Required: Root task title
    "description": "string",       # Optional: Root task description
    "project_id": "string",        # Optional: Project identifier
    "feature": "string",           # Optional: Feature area
    "subtasks": [                  # Optional: Array of subtasks
      {
        "title": "string",         # Required: Subtask title
        "description": "string",   # Optional: Subtask description
        "priority": "string",      # Optional: Subtask priority
        "role": "string",         # Optional: Assigned role
        "order": integer          # Optional: Ordering hint
      }
    ]
  }
}
```

**Example**:
```json
{
  "tree_input": {
    "title": "Build E-commerce Platform",
    "description": "Complete online store with cart and payments",
    "project_id": "ecommerce-v1",
    "subtasks": [
      {
        "title": "Design database schema",
        "role": "architect",
        "priority": "high",
        "order": 1
      },
      {
        "title": "Implement product catalog",
        "role": "implementer", 
        "priority": "normal",
        "order": 2
      },
      {
        "title": "Add shopping cart functionality",
        "role": "implementer",
        "priority": "normal", 
        "order": 3
      }
    ]
  }
}
```

**Returns**: Root task with all subtasks created and linked

---

### `get_task_tree`
**Purpose**: Visualize hierarchical task structure  
**Usage**: Understanding project organization and progress

**Input Parameters**:
```python
{
  "task_id": "string"  # Required: Root task ID to display tree for
}
```

**Returns**: Nested structure showing:
- Task hierarchy with indentation
- Status indicators for each task
- Progress summaries at each level
- Role assignments throughout tree

---

## Task Execution Tools

### `execute_task`
**Purpose**: Execute task through role-based workflow  
**Usage**: Run tasks with capability validation and restrictions

**Input Parameters**:
```python
{
  "task_id": "string",    # Required: Task ID to execute
  "dry_run": boolean      # Optional: Simulate execution (default: false)
}
```

**Execution Process**:
1. Validate task has assigned role
2. Check role capabilities and file restrictions
3. Verify task dependencies are satisfied
4. Execute through role-specific workflow
5. Update task status and record execution metadata

**Role Validation**: Ensures assigned role has necessary tool groups and file access

---

### `complete_task`
**Purpose**: Mark task as completed with artifacts  
**Usage**: Finalize task execution with deliverables

**Input Parameters**:
```python
{
  "task_id": "string",           # Required: Task ID to complete
  "output": "string",            # Optional: Completion summary/notes
  "artifacts": ["string"]        # Optional: Array of artifact paths/URLs
}
```

**Completion Effects**:
- Sets task status to DONE
- Records completion timestamp
- Stores output and artifacts
- Triggers dependency resolution for blocking tasks
- Updates project progress metrics

---

### `assign_role_to_task`
**Purpose**: Assign role with capability validation  
**Usage**: Ensure tasks have appropriate role assignments

**Input Parameters**:
```python
{
  "task_id": "string",     # Required: Task ID to assign role to
  "role_name": "string"    # Required: Role name to assign
}
```

**Validation Process**:
1. Verify role exists in role definitions
2. Check role has required tool groups for task type
3. Validate file access patterns if applicable
4. Assign role and update task metadata

---

## Dependencies & Analytics Tools

### `analyze_task_dependencies`
**Purpose**: Identify task blocking relationships  
**Usage**: Understanding critical path and bottlenecks

**Input Parameters**:
```python
{
  "task_id": "string"  # Required: Task ID to analyze dependencies for
}
```

**Returns**:
- **Blocking tasks**: Tasks this task depends on
- **Blocked tasks**: Tasks that depend on this task  
- **Critical path**: Longest dependency chain
- **Dependency depth**: Levels of dependency nesting
- **Circular dependencies**: Any detected cycles

---

### `add_task_dependency`
**Purpose**: Create dependency relationship between tasks  
**Usage**: Define task ordering and prerequisites

**Input Parameters**:
```python
{
  "task_id": "string",              # Required: Task that depends
  "depends_on_task_id": "string"    # Required: Task being depended on
}
```

**Dependency Rules**:
- Creates "depends_on" relationship
- Prevents execution until dependency completed
- Updates critical path calculations
- Detects and prevents circular dependencies

---

### `get_task_dashboard`
**Purpose**: Real-time project metrics and insights  
**Usage**: Monitoring progress and identifying issues

**Input Parameters**:
```python
{
  "project_id": "string"  # Optional: Filter dashboard to specific project
}
```

**Returns Dashboard Data**:
- **Task Counts**: Total, by status, by priority
- **Progress Metrics**: Completion percentage, velocity trends
- **Role Distribution**: Tasks per role, workload balance
- **Dependency Analysis**: Blocking relationships, critical path
- **Recent Activity**: Latest task updates and completions
- **Health Indicators**: Overdue tasks, blocked tasks, bottlenecks

**Example Dashboard Output**:
```json
{
  "summary": {
    "total_tasks": 45,
    "completed": 23,
    "in_progress": 8,
    "blocked": 3,
    "completion_percentage": 51.1
  },
  "by_role": {
    "implementer": {"assigned": 15, "completed": 8},
    "tester": {"assigned": 8, "completed": 5},
    "architect": {"assigned": 6, "completed": 4}
  },
  "critical_path": ["task_001", "task_005", "task_012"],
  "blocked_tasks": [
    {"id": "task_018", "blocked_by": "task_005", "days_blocked": 3}
  ]
}
```

---

### `list_roles`
**Purpose**: Display available roles and capabilities  
**Usage**: Understanding role system and assignments

**Returns**: Complete role catalog including:
- **Role Name**: Identifier and display name
- **Tool Groups**: Available capability groups
- **File Restrictions**: Access pattern limitations
- **Description**: Role purpose and responsibilities
- **Current Assignments**: Tasks using this role

---

## Tool Integration Patterns

### Workflow Example: Project Setup
```bash
1. create_task_tree     # Define project structure
2. assign_role_to_task  # Assign roles to each task
3. add_task_dependency  # Define task ordering
4. get_task_dashboard   # Monitor initial state
5. execute_task         # Begin execution
6. analyze_task_dependencies  # Check for bottlenecks
7. complete_task        # Finalize deliverables
```

### Common Tool Combinations
- **Planning**: `create_task_tree` + `assign_role_to_task` + `add_task_dependency`
- **Monitoring**: `get_task_dashboard` + `list_tasks` + `analyze_task_dependencies`
- **Execution**: `execute_task` + `update_task` + `complete_task`
- **Analysis**: `get_task_tree` + `analyze_task_dependencies` + `get_task_dashboard`

---

## Error Handling

All tools return structured error responses with:
- **Error Code**: Machine-readable error type
- **Error Message**: Human-readable description
- **Suggested Actions**: Recommendations for resolution
- **Context**: Relevant IDs and state information

**Common Error Types**:
- `TASK_NOT_FOUND`: Invalid task ID provided
- `ROLE_VALIDATION_ERROR`: Role lacks required capabilities
- `DEPENDENCY_CYCLE`: Circular dependency detected
- `INVALID_STATUS_TRANSITION`: Illegal status change
- `FILE_ACCESS_DENIED`: Role file restrictions violated

---

## Performance Considerations

### Tool Response Times
- **Fast** (< 100ms): `get_task`, `list_tasks`, `list_roles`
- **Medium** (< 500ms): `create_task`, `update_task`, `assign_role_to_task`
- **Slower** (< 2s): `create_task_tree`, `get_task_dashboard`, `analyze_task_dependencies`

### Optimization Tips
- Use `list_tasks` with filters instead of retrieving all tasks
- Cache dashboard data for frequently accessed projects
- Batch role assignments when creating multiple tasks
- Limit task tree depth for better performance

---

This comprehensive tool set enables complete task lifecycle management through Claude Code's MCP integration, providing intelligent orchestration for complex development workflows.