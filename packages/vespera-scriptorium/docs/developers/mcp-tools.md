# MCP Tools Reference

**Complete guide to Vespera V2's 14 Model Context Protocol tools for AI agent integration and Claude Code workflows.**

## 🎯 Overview

Vespera V2 provides 14 specialized MCP tools that enable seamless integration with AI agents, particularly Claude Code. These tools offer the same functionality as the REST API but are optimized for conversational AI workflows.

### Key Benefits

- **🤖 AI-Native**: Designed specifically for AI agent interactions
- **🔄 Real-time**: Direct integration with Vespera's core systems
- **📊 Rich Data**: Comprehensive task and project information
- **🛡️ Validated**: Automatic input validation and error handling
- **⚡ Efficient**: Optimized for conversational workflows

### Tool Categories

| Category | Tools | Purpose |
|----------|--------|---------|
| **Task Management** | `create_task`, `get_task`, `update_task`, `delete_task`, `list_tasks` | Core CRUD operations |
| **Task Hierarchy** | `create_task` (with subtasks), `get_task_tree`, `analyze_task_dependencies`, `add_task_dependency` | Hierarchical organization |
| **Task Execution** | `execute_task`, `complete_task` | Role-based execution |
| **Role Management** | `list_roles`, `assign_role_to_task` | Capability management |
| **Analytics** | `get_task_dashboard` | Project insights |

## 🔧 Core Task Management Tools

### 1. create_task

Create a new task with comprehensive metadata and validation.

**Purpose**: Add individual tasks to your project with full control over properties and relationships.

**Input Schema**:
```json
{
  "task_input": {
    "title": "string (required)",
    "description": "string (optional, default: '')",
    "parent_id": "string (optional)",
    "project_id": "string (optional)",
    "feature": "string (optional)",
    "role": "string (optional)",
    "priority": "string (optional, default: 'normal')"
  }
}
```

**Example Usage**:
```python
create_task({
    "task_input": {
        "title": "Implement user authentication API",
        "description": "Create REST endpoints for user login, logout, and token refresh with JWT",
        "project_id": "ecommerce-backend",
        "feature": "authentication",
        "role": "backend_developer",
        "priority": "high"
    }
})
```

**Response**:
```json
{
    "status": "success",
    "task": {
        "task_id": "task_67890abc",
        "title": "Implement user authentication API",
        "description": "Create REST endpoints for user login, logout, and token refresh with JWT",
        "status": "pending",
        "priority": "high",
        "project_id": "ecommerce-backend",
        "feature": "authentication",
        "role": "backend_developer",
        "parent_id": null,
        "dependencies": [],
        "created_at": "2025-01-19T14:30:00Z",
        "updated_at": "2025-01-19T14:30:00Z",
        "metadata": {
            "estimated_hours": null,
            "actual_hours": 0,
            "tags": []
        }
    },
    "message": "Task created successfully"
}
```

**Common Use Cases**:
- Creating standalone tasks for immediate work
- Adding tasks to existing projects
- Breaking down large features into manageable tasks
- Setting up initial project structure

**Best Practices**:
- Use clear, action-oriented titles
- Include detailed descriptions with acceptance criteria
- Assign appropriate roles based on required capabilities
- Set realistic priorities based on business impact

### 2. create_task (Unified Interface)

Create simple tasks or hierarchical task structures in a single operation.

**Purpose**: Single interface for all task creation - from simple todos to complex project hierarchies.

**Note**: The `create_task` tool now supports hierarchical task creation through the `subtasks` parameter, eliminating the need for a separate `create_task_tree` tool.

**Input Schema**:
```json
{
  "tree_input": {
    "title": "string (required)",
    "description": "string (optional, default: '')",
    "project_id": "string (optional)",
    "feature": "string (optional)",
    "subtasks": [
      {
        "title": "string (required)",
        "description": "string (optional, default: '')",
        "role": "string (optional)",
        "priority": "string (optional, default: 'normal')",
        "order": "integer (optional)"
      }
    ]
  }
}
```

**Example Usage**:
```python
create_task({
    "task_input": {
        "title": "User Management System",
        "description": "Complete user registration, authentication, and profile management",
        "project_id": "user-platform",
        "feature": "user-management",
        "subtasks": [
            {
                "title": "Design user database schema",
                "description": "Create tables for users, profiles, and authentication tokens",
                "role": "database_architect",
                "priority": "high",
                "order": 1
            },
            {
                "title": "Implement user registration API",
                "description": "POST /api/users/register with validation and password hashing",
                "role": "backend_developer",
                "priority": "high",
                "order": 2
            },
            {
                "title": "Create login/logout endpoints",
                "description": "Authentication endpoints with JWT token management",
                "role": "backend_developer",
                "priority": "high",
                "order": 3
            },
            {
                "title": "Build user profile UI",
                "description": "React components for profile viewing and editing",
                "role": "frontend_developer",
                "priority": "normal",
                "order": 4
            },
            {
                "title": "Add user management tests",
                "description": "Unit and integration tests for all user endpoints",
                "role": "qa_engineer",
                "priority": "normal",
                "order": 5
            }
        ]
    }
})
```

**Response**:
```json
{
    "status": "success",
    "root_task": {
        "task_id": "task_12345abc",
        "title": "User Management System",
        "status": "pending"
    },
    "created_subtasks": [
        {
            "task_id": "task_12346def",
            "title": "Design user database schema",
            "role": "database_architect",
            "order": 1
        },
        {
            "task_id": "task_12347ghi",
            "title": "Implement user registration API",
            "role": "backend_developer",
            "order": 2
        }
    ],
    "summary": {
        "total_tasks_created": 6,
        "roles_assigned": ["database_architect", "backend_developer", "frontend_developer", "qa_engineer"]
    }
}
```

**Advanced Features**:
- Automatic dependency creation based on order
- Role validation for all subtasks
- Batch creation with rollback on errors
- Automatic project_id inheritance

### 3. get_task

Retrieve comprehensive task information including relationships and metadata.

**Purpose**: Get complete task details for analysis, display, or further operations.

**Input Schema**:
```json
{
  "task_id": "string (required)"
}
```

**Example Usage**:
```python
get_task({
    "task_id": "task_67890abc"
})
```

**Response**:
```json
{
    "status": "success",
    "task": {
        "task_id": "task_67890abc",
        "title": "Implement user authentication API",
        "description": "Create REST endpoints for user login, logout, and token refresh with JWT",
        "status": "in_progress",
        "priority": "high",
        "project_id": "ecommerce-backend",
        "feature": "authentication",
        "role": "backend_developer",
        "assignee": "john.doe@company.com",
        "parent_id": "task_12345abc",
        "children": [
            "task_67891def",
            "task_67892ghi"
        ],
        "dependencies": [
            "task_55555xyz"
        ],
        "dependents": [
            "task_77777uvw"
        ],
        "created_at": "2025-01-19T14:30:00Z",
        "updated_at": "2025-01-19T16:45:00Z",
        "started_at": "2025-01-19T15:15:00Z",
        "metadata": {
            "estimated_hours": 8,
            "actual_hours": 2.5,
            "tags": ["api", "security", "backend"],
            "complexity": "medium",
            "blockers": []
        }
    },
    "context": {
        "parent_title": "User Management System",
        "children_count": 2,
        "dependencies_satisfied": true,
        "progress_percentage": 31.25
    }
}
```

**Information Included**:
- Complete task properties and metadata
- Parent and children relationships
- Dependency chains (both directions)
- Progress and timing information
- Role and assignment details
- Contextual information

### 4. update_task

Modify existing task properties with validation and change tracking.

**Purpose**: Update task details while maintaining data integrity and audit trails.

**Input Schema**:
```json
{
  "update_input": {
    "task_id": "string (required)",
    "title": "string (optional)",
    "description": "string (optional)",
    "status": "string (optional)",
    "priority": "string (optional)",
    "role": "string (optional)"
  }
}
```

**Example Usage**:
```python
update_task({
    "update_input": {
        "task_id": "task_67890abc",
        "status": "in_progress",
        "priority": "critical",
        "description": "Create REST endpoints for user login, logout, and token refresh with JWT. URGENT: Security review required before deployment."
    }
})
```

**Response**:
```json
{
    "status": "success",
    "task": {
        "task_id": "task_67890abc",
        "title": "Implement user authentication API",
        "status": "in_progress",
        "priority": "critical",
        "updated_at": "2025-01-19T17:20:00Z"
    },
    "changes": {
        "status": {"from": "pending", "to": "in_progress"},
        "priority": {"from": "high", "to": "critical"},
        "description": {"changed": true}
    },
    "message": "Task updated successfully"
}
```

**Validation Rules**:
- Status transitions must be valid (pending → in_progress → completed)
- Role assignments validated against available roles
- Priority changes tracked for project metrics
- Description changes trigger re-embedding for search

### 5. delete_task

Remove tasks with optional cascade deletion for hierarchies.

**Purpose**: Clean up completed, obsolete, or duplicate tasks while maintaining project integrity.

**Input Schema**:
```json
{
  "task_id": "string (required)",
  "recursive": "boolean (optional, default: true)"
}
```

**Example Usage**:
```python
# Delete task and all children
delete_task({
    "task_id": "task_67890abc",
    "recursive": true
})

# Delete only the specific task (children become orphaned)
delete_task({
    "task_id": "task_67890abc", 
    "recursive": false
})
```

**Response**:
```json
{
    "status": "success",
    "deleted_tasks": [
        "task_67890abc",
        "task_67891def",
        "task_67892ghi"
    ],
    "affected_dependencies": [
        {
            "task_id": "task_77777uvw",
            "action": "dependency_removed"
        }
    ],
    "message": "Task and 2 children deleted successfully"
}
```

**Safety Features**:
- Automatic dependency cleanup
- Optional recursive deletion
- Rollback on constraint violations
- Audit trail preservation

### 6. list_tasks

Query tasks with flexible filtering and pagination.

**Purpose**: Retrieve task lists for dashboards, reports, and bulk operations.

**Input Schema**:
```json
{
  "project_id": "string (optional)",
  "status_filter": "string (optional)",
  "priority_filter": "string (optional)",
  "assignee": "string (optional)",
  "parent_id": "string (optional)",
  "limit": "integer (optional, default: 50)"
}
```

**Example Usage**:
```python
# Get all high-priority in-progress tasks
list_tasks({
    "status_filter": "in_progress",
    "priority_filter": "high",
    "limit": 20
})

# Get all tasks for a specific project
list_tasks({
    "project_id": "ecommerce-backend",
    "limit": 100
})

# Get children of a specific task
list_tasks({
    "parent_id": "task_12345abc"
})
```

**Response**:
```json
{
    "status": "success",
    "tasks": [
        {
            "task_id": "task_67890abc",
            "title": "Implement user authentication API",
            "status": "in_progress",
            "priority": "high",
            "role": "backend_developer",
            "created_at": "2025-01-19T14:30:00Z",
            "progress": 0.31
        }
    ],
    "pagination": {
        "total": 156,
        "returned": 20,
        "has_more": true,
        "next_offset": 20
    },
    "filters_applied": {
        "status": "in_progress",
        "priority": "high"
    }
}
```

## 🌲 Task Hierarchy Tools

### 7. get_task_tree

Retrieve hierarchical task structure with statistics and visualization data.

**Purpose**: Visualize project structure and analyze task relationships.

**Input Schema**:
```json
{
  "task_id": "string (required)"
}
```

**Example Usage**:
```python
get_task_tree({
    "task_id": "task_12345abc"
})
```

**Response**:
```json
{
    "status": "success",
    "tree": {
        "task_id": "task_12345abc",
        "title": "User Management System",
        "status": "in_progress",
        "priority": "high",
        "role": null,
        "progress": 0.40,
        "children": [
            {
                "task_id": "task_12346def",
                "title": "Design user database schema",
                "status": "completed",
                "progress": 1.0,
                "children": []
            },
            {
                "task_id": "task_12347ghi", 
                "title": "Implement user registration API",
                "status": "in_progress",
                "progress": 0.60,
                "children": [
                    {
                        "task_id": "task_12348jkl",
                        "title": "Add input validation",
                        "status": "completed",
                        "progress": 1.0,
                        "children": []
                    },
                    {
                        "task_id": "task_12349mno",
                        "title": "Implement password hashing",
                        "status": "in_progress", 
                        "progress": 0.20,
                        "children": []
                    }
                ]
            }
        ]
    },
    "statistics": {
        "total_nodes": 5,
        "completed": 2,
        "in_progress": 2,
        "pending": 1,
        "blocked": 0,
        "max_depth": 3,
        "completion_percentage": 40.0
    },
    "visualization": {
        "ascii_tree": "📁 User Management System\n├── ✅ Design user database schema\n└── 🚀 Implement user registration API\n    ├── ✅ Add input validation\n    └── 🚀 Implement password hashing"
    }
}
```

**Advanced Features**:
- Progress rollup calculation
- Visual tree representation
- Depth and breadth statistics
- Performance metrics

### 8. analyze_task_dependencies

Analyze dependency relationships and detect potential issues.

**Purpose**: Understand project workflow and identify bottlenecks or cycle risks.

**Input Schema**:
```json
{
  "task_id": "string (required)"
}
```

**Example Usage**:
```python
analyze_task_dependencies({
    "task_id": "task_12345abc"
})
```

**Response**:
```json
{
    "status": "success",
    "task": {
        "task_id": "task_12345abc",
        "title": "User Management System"
    },
    "dependencies": [
        {
            "task_id": "task_12347ghi",
            "task_title": "Implement user registration API",
            "depends_on_id": "task_12346def",
            "depends_on_title": "Design user database schema",
            "dependency_type": "hard",
            "satisfied": true
        }
    ],
    "dependents": [
        {
            "task_id": "task_55555xyz",
            "task_title": "Build admin dashboard",
            "depends_on_id": "task_12345abc",
            "depends_on_title": "User Management System",
            "blocked": false
        }
    ],
    "cycles": [],
    "critical_path": [
        {
            "task_id": "task_12346def",
            "title": "Design user database schema",
            "duration_hours": 8
        },
        {
            "task_id": "task_12347ghi", 
            "title": "Implement user registration API",
            "duration_hours": 12
        }
    ],
    "analysis": {
        "total_dependencies": 1,
        "satisfied_dependencies": 1,
        "blocking_tasks": 0,
        "critical_path_duration": 20,
        "parallelizable_tasks": 2,
        "bottleneck_risk": "low"
    }
}
```

**Analysis Features**:
- Cycle detection and prevention
- Critical path calculation
- Bottleneck identification
- Parallelization opportunities
- Risk assessment

### 9. add_task_dependency

Create dependency relationships between tasks with validation.

**Purpose**: Establish workflow sequences and prerequisites.

**Input Schema**:
```json
{
  "task_id": "string (required)",
  "depends_on_task_id": "string (required)"
}
```

**Example Usage**:
```python
add_task_dependency({
    "task_id": "task_12347ghi",
    "depends_on_task_id": "task_12346def"
})
```

**Response**:
```json
{
    "status": "success",
    "dependency": {
        "task_id": "task_12347ghi",
        "task_title": "Implement user registration API",
        "depends_on_id": "task_12346def",
        "depends_on_title": "Design user database schema",
        "created_at": "2025-01-19T17:30:00Z"
    },
    "validation": {
        "cycle_check": "passed",
        "role_compatibility": "compatible",
        "project_alignment": "same_project"
    },
    "impact": {
        "tasks_potentially_blocked": 0,
        "critical_path_changed": true,
        "estimated_delay": 0
    }
}
```

**Validation Checks**:
- Cycle detection and prevention
- Cross-project dependency warnings
- Role compatibility assessment
- Timeline impact analysis

## ⚡ Task Execution Tools

### 10. execute_task

Execute tasks using role-based capabilities with optional dry run.

**Purpose**: Run tasks through the role system to validate capabilities and simulate execution.

**Input Schema**:
```json
{
  "task_id": "string (required)",
  "dry_run": "boolean (optional, default: false)"
}
```

**Example Usage**:
```python
# Dry run to check capabilities
execute_task({
    "task_id": "task_67890abc",
    "dry_run": true
})

# Actual execution
execute_task({
    "task_id": "task_67890abc",
    "dry_run": false
})
```

**Response**:
```json
{
    "status": "success",
    "execution": {
        "task_id": "task_67890abc",
        "task_title": "Implement user authentication API",
        "role": "backend_developer",
        "dry_run": false,
        "capabilities_used": [
            "WRITE_CODE",
            "READ_CODE", 
            "TEST_CODE"
        ],
        "files_accessed": [
            "auth/api.py",
            "auth/models.py",
            "tests/test_auth.py"
        ],
        "execution_time": "00:02:15",
        "status_change": {
            "from": "pending",
            "to": "in_progress"
        }
    },
    "output": "Started implementation of authentication endpoints. Created basic API structure and placeholder functions.",
    "next_steps": [
        "Implement password hashing logic",
        "Add JWT token generation",
        "Create unit tests for endpoints"
    ]
}
```

**Execution Features**:
- Role capability validation
- File access restrictions
- Time tracking
- Automatic status updates
- Output capture

### 11. complete_task

Mark tasks as completed with outputs, artifacts, and metrics.

**Purpose**: Finalize tasks with comprehensive completion data for project tracking.

**Input Schema**:
```json
{
  "task_id": "string (required)",
  "output": "string (optional, default: '')",
  "artifacts": "array of strings (optional, default: [])"
}
```

**Example Usage**:
```python
complete_task({
    "task_id": "task_67890abc",
    "output": "Successfully implemented user authentication API with JWT tokens. All endpoints tested and documented.",
    "artifacts": [
        "auth/api.py",
        "auth/models.py", 
        "auth/jwt_utils.py",
        "tests/test_auth_api.py",
        "docs/api/authentication.md"
    ]
})
```

**Response**:
```json
{
    "status": "success",
    "completion": {
        "task_id": "task_67890abc",
        "task_title": "Implement user authentication API",
        "completed_at": "2025-01-19T18:45:00Z",
        "duration": "4h 15m",
        "output": "Successfully implemented user authentication API with JWT tokens. All endpoints tested and documented.",
        "artifacts": [
            "auth/api.py",
            "auth/models.py",
            "auth/jwt_utils.py", 
            "tests/test_auth_api.py",
            "docs/api/authentication.md"
        ]
    },
    "impact": {
        "dependent_tasks_unblocked": 3,
        "parent_progress_updated": true,
        "project_completion_percentage": 67.5
    },
    "metrics": {
        "estimated_vs_actual": {
            "estimated_hours": 8,
            "actual_hours": 4.25,
            "variance": -47
        },
        "quality_score": 9.2
    }
}
```

**Completion Features**:
- Automatic dependency resolution
- Parent task progress updates
- Project metrics recalculation
- Quality scoring
- Artifact tracking

## 👥 Role Management Tools

### 12. list_roles

Get comprehensive information about available roles and their capabilities.

**Purpose**: Understand available roles for task assignment and capability planning.

**Input Schema**: None (no parameters required)

**Example Usage**:
```python
list_roles()
```

**Response**:
```json
{
    "status": "success",
    "roles": [
        {
            "name": "backend_developer",
            "description": "Backend development with Python, Node.js, and databases",
            "capabilities": [
                "WRITE_CODE",
                "READ_CODE",
                "DEBUG_CODE",
                "TEST_CODE",
                "DEPLOY_CODE"
            ],
            "file_patterns": [
                "*.py",
                "*.js",
                "*.sql",
                "*.yaml",
                "*.json"
            ],
            "tools": [
                "python",
                "node",
                "git", 
                "docker",
                "pytest"
            ],
            "restrictions": {
                "max_concurrent_tasks": 5,
                "excluded_patterns": [
                    "*.jsx",
                    "*.tsx",
                    "*.css"
                ]
            },
            "current_workload": {
                "assigned_tasks": 3,
                "utilization": 0.60,
                "available_capacity": 2
            }
        },
        {
            "name": "frontend_developer", 
            "description": "Frontend development with React, Vue, and modern CSS",
            "capabilities": [
                "WRITE_CODE",
                "READ_CODE",
                "DEBUG_CODE",
                "TEST_CODE"
            ],
            "file_patterns": [
                "*.js",
                "*.jsx",
                "*.ts", 
                "*.tsx",
                "*.css",
                "*.scss",
                "*.html"
            ],
            "tools": [
                "npm",
                "webpack",
                "babel",
                "jest",
                "cypress"
            ],
            "current_workload": {
                "assigned_tasks": 4,
                "utilization": 0.80,
                "available_capacity": 1
            }
        }
    ],
    "summary": {
        "total_roles": 10,
        "total_assigned_tasks": 47,
        "average_utilization": 0.73,
        "overloaded_roles": ["devops_engineer"],
        "available_roles": ["qa_engineer", "technical_writer"]
    }
}
```

**Role Information Includes**:
- Capability definitions
- File access patterns
- Tool requirements
- Workload statistics
- Availability status

### 13. assign_role_to_task

Assign roles to tasks with comprehensive capability validation.

**Purpose**: Ensure tasks are assigned to roles with appropriate capabilities and availability.

**Input Schema**:
```json
{
  "task_id": "string (required)",
  "role_name": "string (required)"
}
```

**Example Usage**:
```python
assign_role_to_task({
    "task_id": "task_67890abc",
    "role_name": "backend_developer"
})
```

**Response**:
```json
{
    "status": "success",
    "assignment": {
        "task_id": "task_67890abc",
        "task_title": "Implement user authentication API",
        "role_name": "backend_developer",
        "assigned_at": "2025-01-19T14:30:00Z"
    },
    "validation": {
        "capability_match": {
            "required": ["WRITE_CODE", "TEST_CODE"],
            "available": ["WRITE_CODE", "READ_CODE", "DEBUG_CODE", "TEST_CODE", "DEPLOY_CODE"],
            "satisfied": true
        },
        "file_pattern_match": {
            "task_files": ["auth/api.py", "tests/test_auth.py"],
            "role_patterns": ["*.py", "*.js", "*.sql"],
            "compatible": true
        },
        "workload_impact": {
            "previous_utilization": 0.60,
            "new_utilization": 0.80,
            "status": "normal"
        }
    },
    "recommendations": [
        "Task aligns well with role capabilities",
        "Consider code review by senior_developer role"
    ]
}
```

**Validation Features**:
- Capability requirement checking
- File pattern compatibility
- Workload impact assessment
- Alternative role suggestions

## 📊 Analytics & Dashboard Tools

### 14. get_task_dashboard

Get comprehensive project dashboard with metrics, insights, and recommendations.

**Purpose**: Provide executive-level project overview and actionable insights.

**Input Schema**:
```json
{
  "project_id": "string (optional)"
}
```

**Example Usage**:
```python
# Get dashboard for specific project
get_task_dashboard({
    "project_id": "ecommerce-backend"
})

# Get global dashboard (all projects)
get_task_dashboard()
```

**Response**:
```json
{
    "status": "success",
    "summary": {
        "total_tasks": 127,
        "completed_tasks": 78,
        "in_progress_tasks": 23,
        "pending_tasks": 18,
        "blocked_tasks": 8,
        "completion_rate": 0.614,
        "velocity": 3.4,
        "estimated_completion": "2025-02-15"
    },
    "metrics": {
        "project_health": {
            "overall_score": 8.2,
            "completion_trend": "improving",
            "velocity_trend": "stable",
            "quality_score": 9.1,
            "risk_level": "low"
        },
        "performance": {
            "average_task_duration": "2.3 days",
            "planning_accuracy": 0.87,
            "scope_creep": 0.12,
            "rework_rate": 0.05
        }
    },
    "role_workload": [
        {
            "role": "backend_developer",
            "assigned_tasks": 15,
            "max_capacity": 20,
            "utilization": 0.75,
            "status": "normal",
            "estimated_completion": "2025-02-08"
        },
        {
            "role": "frontend_developer",
            "assigned_tasks": 18,
            "max_capacity": 15,
            "utilization": 1.20,
            "status": "overloaded",
            "estimated_completion": "2025-02-22"
        }
    ],
    "recent_activity": [
        {
            "type": "task_completed",
            "task_id": "task_67890abc",
            "task_title": "Implement user authentication API",
            "role": "backend_developer",
            "timestamp": "2025-01-19T18:45:00Z",
            "impact": "Unblocked 3 dependent tasks"
        },
        {
            "type": "task_created",
            "task_id": "task_11111def", 
            "task_title": "Add OAuth integration",
            "role": "backend_developer",
            "timestamp": "2025-01-19T17:20:00Z",
            "impact": "Added to authentication feature"
        }
    ],
    "insights": [
        {
            "type": "bottleneck",
            "severity": "medium",
            "message": "Frontend developer role is overallocated by 20%",
            "affected_tasks": 6,
            "recommendation": "Consider reassigning 3 tasks to full_stack_developer"
        },
        {
            "type": "opportunity",
            "severity": "low",
            "message": "8 tasks can be parallelized in authentication feature",
            "potential_time_savings": "5 days"
        }
    ],
    "forecasting": {
        "completion_scenarios": {
            "optimistic": "2025-02-08",
            "realistic": "2025-02-15", 
            "pessimistic": "2025-02-25"
        },
        "confidence_interval": 0.85,
        "risk_factors": [
            "Frontend developer overallocation",
            "Integration testing dependencies"
        ]
    }
}
```

**Dashboard Features**:
- Real-time project metrics
- Role workload analysis
- Trend analysis and forecasting
- Bottleneck identification
- Actionable recommendations
- Risk assessment

## 🛠️ Tool Integration Patterns

### Sequential Workflows

Common patterns for using multiple tools together:

```python
# 1. Project Setup Workflow
def setup_new_project(project_name, features):
    # Create main project task
    main_task = create_task({
        "task_input": {
            "title": f"{project_name} Development",
            "project_id": project_name.lower(),
            "description": f"Complete development of {project_name}"
        }
    })
    
    # Create feature hierarchies
    for feature in features:
        feature_tree = create_task({
            "task_input": {
                "title": f"{feature} Implementation",
                "parent_id": main_task["task"]["task_id"],
                "project_id": project_name.lower(),
                "feature": feature,
                "subtasks": generate_feature_tasks(feature)
            }
        })
    
    # Get overview
    dashboard = get_task_dashboard({"project_id": project_name.lower()})
    return dashboard

# 2. Task Execution Workflow
def execute_task_safely(task_id):
    # Get task details
    task = get_task({"task_id": task_id})
    
    # Check dependencies
    deps = analyze_task_dependencies({"task_id": task_id})
    if not deps["analysis"]["all_dependencies_satisfied"]:
        return {"error": "Dependencies not satisfied"}
    
    # Dry run first
    dry_run = execute_task({"task_id": task_id, "dry_run": True})
    if dry_run["status"] != "success":
        return {"error": "Dry run failed", "details": dry_run}
    
    # Execute for real
    execution = execute_task({"task_id": task_id, "dry_run": False})
    return execution

# 3. Project Analysis Workflow
def analyze_project_health(project_id):
    # Get dashboard overview
    dashboard = get_task_dashboard({"project_id": project_id})
    
    # Analyze role workloads
    roles = list_roles()
    workload_issues = []
    for role_data in dashboard["role_workload"]:
        if role_data["utilization"] > 1.0:
            workload_issues.append(role_data)
    
    # Find bottlenecks in task dependencies
    all_tasks = list_tasks({"project_id": project_id})
    bottlenecks = []
    for task in all_tasks["tasks"]:
        deps = analyze_task_dependencies({"task_id": task["task_id"]})
        if len(deps["dependents"]) > 3:  # Task blocks many others
            bottlenecks.append(task)
    
    return {
        "dashboard": dashboard,
        "workload_issues": workload_issues,
        "bottlenecks": bottlenecks
    }
```

### Error Handling Patterns

```python
def robust_task_operation(operation, **kwargs):
    try:
        result = operation(**kwargs)
        if result["status"] == "success":
            return result
        else:
            # Handle business logic errors
            return handle_business_error(result)
    except ValidationError as e:
        # Handle input validation errors
        return {
            "status": "error",
            "error_type": "validation",
            "message": str(e)
        }
    except ConnectionError as e:
        # Handle MCP connection errors
        return {
            "status": "error", 
            "error_type": "connection",
            "message": "MCP server unavailable"
        }

def handle_business_error(result):
    error_handlers = {
        "DEPENDENCY_CYCLE": lambda: "Remove circular dependencies",
        "ROLE_NOT_FOUND": lambda: "Check available roles with list_roles()",
        "TASK_NOT_FOUND": lambda: "Verify task ID exists",
        "INSUFFICIENT_CAPACITY": lambda: "Role overallocated, reassign tasks"
    }
    
    error_code = result.get("error", {}).get("code")
    if error_code in error_handlers:
        result["suggestion"] = error_handlers[error_code]()
    
    return result
```

### Batch Operation Patterns

```python
def batch_task_creation(task_specs):
    """Create multiple tasks with proper error handling"""
    created_tasks = []
    failed_tasks = []
    
    for spec in task_specs:
        try:
            task = create_task({"task_input": spec})
            created_tasks.append(task["task"])
        except Exception as e:
            failed_tasks.append({"spec": spec, "error": str(e)})
    
    return {
        "created": created_tasks,
        "failed": failed_tasks,
        "success_rate": len(created_tasks) / len(task_specs)
    }

def bulk_role_assignment(assignments):
    """Assign roles to multiple tasks efficiently"""
    results = []
    
    for task_id, role_name in assignments:
        assignment = assign_role_to_task({
            "task_id": task_id,
            "role_name": role_name
        })
        results.append(assignment)
    
    return results
```

## 🔧 Development Best Practices

### Tool Selection Guidelines

| Use Case | Recommended Tools | Reasoning |
|----------|------------------|-----------|
| **Project Setup** | `create_task` (with subtasks), `get_task_dashboard` | Efficient hierarchy creation + overview |
| **Daily Management** | `list_tasks`, `update_task`, `complete_task` | Core workflow operations |
| **Analysis & Planning** | `analyze_task_dependencies`, `get_task_dashboard` | Strategic insights |
| **Role Management** | `list_roles`, `assign_role_to_task` | Capability-based assignment |
| **Progress Tracking** | `get_task_tree`, `get_task_dashboard` | Visual and metric tracking |

### Performance Optimization

```python
# Cache role information
roles_cache = None
def get_cached_roles():
    global roles_cache
    if roles_cache is None:
        roles_cache = list_roles()
    return roles_cache

# Batch dependency analysis
def analyze_multiple_dependencies(task_ids):
    results = {}
    for task_id in task_ids:
        results[task_id] = analyze_task_dependencies({"task_id": task_id})
    return results

# Efficient task filtering
def get_filtered_tasks(filters):
    # Use specific filters to reduce data transfer
    return list_tasks({
        **filters,
        "limit": 100  # Reasonable limit for performance
    })
```

### Error Recovery Strategies

```python
def resilient_task_update(task_id, updates, max_retries=3):
    for attempt in range(max_retries):
        try:
            # Get current task state
            current_task = get_task({"task_id": task_id})
            
            # Apply updates
            result = update_task({
                "update_input": {
                    "task_id": task_id,
                    **updates
                }
            })
            
            if result["status"] == "success":
                return result
                
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(2 ** attempt)  # Exponential backoff
    
    return {"status": "error", "message": "Max retries exceeded"}
```

---

**🎉 You now have complete mastery of Vespera V2's MCP tools!**

*Next: Explore [Plugin Development](plugin-development/) guides for VS Code, Obsidian, and custom integrations, or dive into [Workflow Automation](../users/workflow-automation.md) for advanced productivity patterns.*