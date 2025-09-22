# API Reference

**Complete reference for Vespera V2's REST API and MCP tools - everything developers need to build powerful integrations.**

## 🌟 Overview

Vespera V2 provides two complementary APIs:

- **🔗 REST API**: HTTP-based API with 50+ endpoints for web applications and plugins
- **⚡ MCP Tools**: 14 Model Context Protocol tools for AI agent integration

Both APIs provide access to the same underlying system with consistent data models and real-time synchronization.

## 📡 REST API Reference

### Base Configuration

```
Base URL: http://localhost:8000
API Version: v1
Content-Type: application/json
Authentication: Bearer token (plugin-based)
```

### Authentication

#### Plugin Registration

Register your application to get an access token:

```http
POST /api/v1/plugins/register
Content-Type: application/json

{
  "plugin_info": {
    "name": "My Application",
    "version": "1.0.0", 
    "type": "vscode|obsidian|custom",
    "capabilities": ["task_creation", "file_context", "search"]
  }
}
```

**Response:**
```json
{
  "status": "success",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expires_in": 86400,
  "plugin_id": "my-app-12345"
}
```

#### Using Authentication

Include the token in all subsequent requests:

```http
Authorization: Bearer YOUR_TOKEN_HERE
```

### Core Task Management

#### List Tasks

```http
GET /api/v1/tasks/
```

**Query Parameters:**
- `project_id` (string): Filter by project
- `status` (string): `pending|in_progress|completed|blocked`
- `priority` (string): `low|normal|high|critical`
- `role` (string): Filter by assigned role
- `parent_id` (string): Get children of specific task
- `limit` (int, default: 50): Results per page
- `offset` (int, default: 0): Pagination offset

**Response:**
```json
{
  "status": "success",
  "tasks": [
    {
      "task_id": "task_12345",
      "title": "Implement user authentication",
      "description": "Add JWT-based authentication to the API",
      "status": "in_progress",
      "priority": "high",
      "project_id": "api-v2",
      "role": "backend_developer",
      "created_at": "2025-01-19T10:30:00Z",
      "updated_at": "2025-01-19T14:15:00Z",
      "parent_id": null,
      "dependencies": ["task_11111"],
      "metadata": {
        "tags": ["backend", "security"],
        "estimated_hours": 8,
        "actual_hours": 4.5
      }
    }
  ],
  "total": 1,
  "page": 1,
  "has_more": false
}
```

#### Create Task

```http
POST /api/v1/tasks/
Content-Type: application/json

{
  "title": "Implement user authentication",
  "description": "Add JWT-based authentication to the API",
  "priority": "high",
  "project_id": "api-v2",
  "parent_id": null,
  "role": "backend_developer",
  "metadata": {
    "tags": ["backend", "security"],
    "estimated_hours": 8
  }
}
```

**Response:**
```json
{
  "status": "success", 
  "task": {
    "task_id": "task_12345",
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication to the API",
    "status": "pending",
    "priority": "high",
    "project_id": "api-v2", 
    "role": "backend_developer",
    "created_at": "2025-01-19T10:30:00Z",
    "updated_at": "2025-01-19T10:30:00Z",
    "parent_id": null,
    "dependencies": [],
    "metadata": {
      "tags": ["backend", "security"],
      "estimated_hours": 8,
      "actual_hours": 0
    }
  }
}
```

#### Get Task Details

```http
GET /api/v1/tasks/{task_id}
```

**Response:** Same as task object above, plus:
```json
{
  "task": { ... },
  "children": [
    {
      "task_id": "task_12346", 
      "title": "Design authentication schema",
      "status": "completed"
    }
  ],
  "dependencies": [
    {
      "task_id": "task_11111",
      "title": "Setup database models",
      "status": "completed"
    }
  ]
}
```

#### Update Task

```http
PUT /api/v1/tasks/{task_id}
Content-Type: application/json

{
  "title": "Implement user authentication (updated)",
  "status": "in_progress",
  "priority": "critical",
  "metadata": {
    "actual_hours": 4.5
  }
}
```

#### Delete Task

```http
DELETE /api/v1/tasks/{task_id}?cascade=true
```

**Query Parameters:**
- `cascade` (boolean): Delete children tasks as well

#### Create Task Tree

Create hierarchical task structures in one request:

```http
POST /api/v1/tasks/trees
Content-Type: application/json

{
  "title": "User Management System",
  "description": "Complete user authentication and management",
  "project_id": "user-system",
  "subtasks": [
    {
      "title": "Design database schema",
      "description": "Design user tables and relationships",
      "role": "database_architect",
      "priority": "high"
    },
    {
      "title": "Implement authentication",
      "description": "JWT token-based authentication",
      "role": "backend_developer", 
      "priority": "high"
    },
    {
      "title": "Create user interface",
      "description": "Login and registration forms",
      "role": "frontend_developer",
      "priority": "normal"
    }
  ]
}
```

#### Get Task Tree

```http
GET /api/v1/tasks/{task_id}/tree
```

**Response:**
```json
{
  "status": "success",
  "tree": {
    "task_id": "task_12345",
    "title": "User Management System", 
    "status": "in_progress",
    "children": [
      {
        "task_id": "task_12346",
        "title": "Design database schema",
        "status": "completed",
        "children": []
      },
      {
        "task_id": "task_12347", 
        "title": "Implement authentication",
        "status": "in_progress",
        "children": []
      }
    ]
  },
  "statistics": {
    "total_tasks": 3,
    "completed": 1,
    "in_progress": 1,
    "pending": 1
  }
}
```

#### Complete Task

```http
POST /api/v1/tasks/{task_id}/complete
Content-Type: application/json

{
  "output": "Authentication system implemented with JWT tokens and bcrypt hashing",
  "artifacts": [
    "auth.py",
    "user_model.py", 
    "jwt_utils.py"
  ],
  "metrics": {
    "actual_hours": 8.5,
    "lines_of_code": 450
  }
}
```

### Semantic Search & Intelligence

#### Semantic Search

AI-powered task search using embeddings:

```http
POST /api/v1/search/semantic
Content-Type: application/json

{
  "query": "database optimization performance tuning",
  "n_results": 10,
  "min_similarity": 0.7,
  "filters": {
    "project_id": "backend-optimization",
    "status": ["completed", "in_progress"]
  }
}
```

**Response:**
```json
{
  "status": "success",
  "results": [
    {
      "task_id": "task_98765",
      "title": "Optimize database queries",
      "description": "Improve query performance with indexing",
      "similarity": 0.89,
      "project_id": "backend-optimization",
      "status": "completed"
    },
    {
      "task_id": "task_98766", 
      "title": "Implement connection pooling",
      "description": "Add database connection pooling for better performance",
      "similarity": 0.83,
      "project_id": "backend-optimization", 
      "status": "in_progress"
    }
  ],
  "query_embedding": [0.1, 0.2, ...],
  "search_time_ms": 45
}
```

#### Find Similar Tasks

```http
GET /api/v1/search/similar/{task_id}?n_results=5
```

**Response:**
```json
{
  "status": "success",
  "reference_task": {
    "task_id": "task_12345",
    "title": "Implement user authentication"
  },
  "similar_tasks": [
    {
      "task_id": "task_67890",
      "title": "Add OAuth integration", 
      "similarity": 0.92
    },
    {
      "task_id": "task_67891",
      "title": "Implement session management",
      "similarity": 0.87
    }
  ]
}
```

#### Task Clustering

Group related tasks using AI:

```http
POST /api/v1/search/cluster
Content-Type: application/json

{
  "project_id": "web-app",
  "algorithm": "kmeans",
  "n_clusters": 5,
  "min_cluster_size": 2
}
```

**Response:**
```json
{
  "status": "success",
  "clusters": [
    {
      "cluster_id": 0,
      "label": "Authentication & Security",
      "tasks": [
        {"task_id": "task_001", "title": "Implement login"},
        {"task_id": "task_002", "title": "Add password hashing"}
      ],
      "centroid": [0.1, 0.2, ...]
    },
    {
      "cluster_id": 1,
      "label": "Frontend Components", 
      "tasks": [
        {"task_id": "task_003", "title": "Create navigation bar"},
        {"task_id": "task_004", "title": "Design user profile page"}
      ],
      "centroid": [0.3, 0.4, ...]
    }
  ],
  "silhouette_score": 0.72
}
```

#### Smart Recommendations

Get AI-powered task suggestions:

```http
GET /api/v1/search/recommendations?project_id=web-app&n_recommendations=3
```

**Response:**
```json
{
  "status": "success",
  "recommendations": [
    {
      "title": "Add input validation",
      "description": "Implement client and server-side validation",
      "reasoning": "Based on authentication implementation, input validation is typically needed",
      "confidence": 0.85,
      "suggested_role": "backend_developer",
      "estimated_effort": "medium"
    },
    {
      "title": "Implement error handling",
      "description": "Add comprehensive error handling for authentication flows", 
      "reasoning": "Authentication systems require robust error handling",
      "confidence": 0.78,
      "suggested_role": "backend_developer",
      "estimated_effort": "low"
    }
  ]
}
```

### Project Intelligence

#### Project Health Analysis

```http
GET /api/v1/projects/{project_id}/health
```

**Response:**
```json
{
  "status": "success",
  "health": {
    "overall_score": 8.5,
    "metrics": {
      "completion_rate": 0.75,
      "velocity": 2.3,
      "quality_score": 9.1,
      "risk_level": "low"
    },
    "insights": [
      {
        "type": "warning",
        "message": "3 tasks are blocked by dependencies",
        "affected_tasks": ["task_001", "task_002", "task_003"]
      },
      {
        "type": "success", 
        "message": "Project is ahead of schedule by 2 days"
      }
    ],
    "recommendations": [
      "Consider parallelizing blocked tasks",
      "Add more frontend developers to balance workload"
    ]
  }
}
```

#### Dependency Analysis

```http
GET /api/v1/projects/{project_id}/dependencies
```

**Response:**
```json
{
  "status": "success",
  "dependencies": [
    {
      "task_id": "task_002",
      "task_title": "Implement authentication",
      "depends_on_id": "task_001", 
      "depends_on_title": "Design database schema",
      "dependency_type": "hard",
      "status": "satisfied"
    }
  ],
  "cycles": [
    {
      "cycle_id": "cycle_001",
      "tasks": ["task_003", "task_004", "task_003"],
      "severity": "high"
    }
  ],
  "critical_path": [
    "task_001",
    "task_002", 
    "task_005"
  ],
  "statistics": {
    "total_dependencies": 15,
    "satisfied": 12,
    "pending": 3,
    "cycles_detected": 1
  }
}
```

#### Bottleneck Detection

```http
GET /api/v1/projects/bottlenecks?project_id=web-app
```

**Response:**
```json
{
  "status": "success",
  "bottlenecks": [
    {
      "type": "resource",
      "description": "backend_developer role is overallocated",
      "affected_tasks": 8,
      "severity": "medium",
      "suggestions": [
        "Reassign 2 tasks to full_stack_developer",
        "Consider hiring additional backend developer"
      ]
    },
    {
      "type": "dependency",
      "description": "task_001 blocks 5 other tasks",
      "blocking_task": "task_001",
      "blocked_tasks": ["task_002", "task_003", "task_004", "task_005", "task_006"],
      "severity": "high",
      "suggestions": [
        "Prioritize completion of task_001",
        "Break down task_001 into smaller parallel tasks"
      ]
    }
  ]
}
```

#### Task Impact Analysis

```http
POST /api/v1/projects/{project_id}/impact/{task_id}
Content-Type: application/json

{
  "change_type": "delay|complete|delete|modify",
  "estimated_delay_days": 3
}
```

### Role Management

#### List Roles

```http
GET /api/v1/roles/
```

**Response:**
```json
{
  "status": "success",
  "roles": [
    {
      "name": "frontend_developer",
      "description": "Frontend development with modern frameworks",
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
        "*.html"
      ],
      "tools": [
        "npm",
        "webpack",
        "babel"
      ],
      "max_concurrent_tasks": 3,
      "estimated_capacity": 40
    }
  ]
}
```

#### Get Role Details

```http
GET /api/v1/roles/{role_name}
```

#### Assign Role to Task

```http
POST /api/v1/roles/{role_name}/assign/{task_id}
```

#### Role Workload Analysis

```http
GET /api/v1/roles/workload/analysis
```

**Response:**
```json
{
  "status": "success",
  "workload": [
    {
      "role": "frontend_developer",
      "assigned_tasks": 5,
      "max_capacity": 8,
      "utilization": 0.625,
      "estimated_hours": 25,
      "available_hours": 15,
      "status": "normal"
    },
    {
      "role": "backend_developer", 
      "assigned_tasks": 8,
      "max_capacity": 6,
      "utilization": 1.33,
      "estimated_hours": 40,
      "available_hours": 30,
      "status": "overloaded"
    }
  ],
  "recommendations": [
    "Reassign 2 backend tasks to full_stack_developer",
    "Consider hiring additional backend developer"
  ]
}
```

### Plugin Integration

#### VS Code Integration

##### Analyze File Context

```http
POST /api/v1/plugins/vscode/context/file
Content-Type: application/json

{
  "file_path": "src/auth/authentication.py",
  "language": "python",
  "line_number": 45,
  "function_name": "authenticate_user",
  "content_preview": "def authenticate_user(username, password):\n    # TODO: implement validation",
  "git_info": {
    "branch": "feature/auth",
    "commit": "abc123",
    "modified": true
  }
}
```

**Response:**
```json
{
  "status": "success",
  "analysis": {
    "related_tasks": [
      {
        "task_id": "task_12345",
        "title": "Implement user authentication",
        "relevance": 0.95,
        "line_references": [42, 45, 67]
      }
    ],
    "suggestions": [
      {
        "type": "task_creation",
        "title": "Add password validation",
        "description": "Implement secure password validation for the authenticate_user function",
        "suggested_role": "backend_developer"
      },
      {
        "type": "code_improvement",
        "title": "Add input sanitization", 
        "description": "Sanitize username and password inputs to prevent injection attacks"
      }
    ],
    "code_patterns": [
      {
        "pattern": "TODO comment",
        "location": "line 46",
        "suggestion": "Convert TODO to a tracked task"
      }
    ]
  }
}
```

##### Create Task from Code Selection

```http
POST /api/v1/plugins/vscode/tasks/from-selection
Content-Type: application/json

{
  "selection": {
    "file_path": "src/components/UserProfile.jsx",
    "start_line": 15,
    "end_line": 28,
    "content": "// TODO: Add profile picture upload functionality\nconst uploadProfilePicture = () => {\n  // Implementation needed\n};"
  },
  "context": {
    "project_id": "user-management",
    "feature": "profile-management"
  }
}
```

#### Obsidian Integration

##### Analyze Note Context

```http
POST /api/v1/plugins/obsidian/context/note
Content-Type: application/json

{
  "note_path": "Projects/Web App/Authentication Requirements.md",
  "note_title": "Authentication Requirements",
  "content_preview": "# Authentication Requirements\n\nThe system needs to support:\n- JWT tokens\n- Password hashing\n- Session management",
  "tags": ["authentication", "security", "requirements"],
  "links": [
    "[[Database Schema]]",
    "[[Security Considerations]]"
  ]
}
```

##### Create Task from Note

```http
POST /api/v1/plugins/obsidian/tasks/from-note
Content-Type: application/json

{
  "note_info": {
    "title": "Authentication Requirements",
    "content": "Implement JWT-based authentication...",
    "tags": ["auth", "backend"]
  },
  "task_extraction": {
    "auto_extract": true,
    "create_subtasks": true
  }
}
```

### WebSocket Real-time Updates

Connect to real-time events:

```
WebSocket URL: ws://localhost:8000/ws/plugins?token=YOUR_TOKEN
```

#### Connection Flow

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/plugins?token=YOUR_TOKEN');

// 1. Connection established
ws.onopen = function() {
    console.log('Connected to Vespera V2');
    
    // 2. Subscribe to events
    ws.send(JSON.stringify({
        type: 'subscribe',
        events: ['task.created', 'task.updated', 'task.completed', 'project.updated']
    }));
};

// 3. Receive real-time updates
ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    
    switch(message.type) {
        case 'task.created':
            handleTaskCreated(message.data);
            break;
        case 'task.updated': 
            handleTaskUpdated(message.data);
            break;
        case 'task.completed':
            handleTaskCompleted(message.data);
            break;
        case 'connection.established':
            console.log('WebSocket connection confirmed');
            break;
    }
};
```

#### Event Types

| Event Type | Triggered When | Data Included |
|------------|----------------|---------------|
| `task.created` | New task created | Full task object |
| `task.updated` | Task modified | Updated fields only |
| `task.completed` | Task marked complete | Task ID, completion data |
| `task.deleted` | Task removed | Task ID |
| `project.updated` | Project-level changes | Project health metrics |
| `dependency.added` | New dependency created | Dependency relationship |
| `dependency.removed` | Dependency removed | Affected task IDs |
| `role.assigned` | Role assigned to task | Task ID, role name |
| `search.indexed` | Task indexed for search | Task ID, embedding status |
| `connection.established` | WebSocket connected | Connection metadata |
| `error` | Operation failed | Error details |

#### Subscription Management

```javascript
// Subscribe to specific events
ws.send(JSON.stringify({
    type: 'subscribe',
    events: ['task.created', 'task.updated']
}));

// Subscribe with filters
ws.send(JSON.stringify({
    type: 'subscribe', 
    events: ['task.updated'],
    filters: {
        project_id: 'web-app',
        role: 'frontend_developer'
    }
}));

// Unsubscribe from events
ws.send(JSON.stringify({
    type: 'unsubscribe',
    events: ['task.deleted']
}));
```

### System & Health

#### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-19T10:30:00Z",
  "version": "2.0.0",
  "services": {
    "task_manager": "healthy",
    "role_manager": "healthy", 
    "sqlite_database": "healthy",
    "chroma_search": "healthy",
    "kuzu_graph": "healthy",
    "mcp_bridge": "healthy"
  },
  "performance": {
    "avg_response_time_ms": 45,
    "requests_per_second": 120,
    "active_connections": 15
  }
}
```

#### API Metrics

```http
GET /metrics
```

**Response:**
```json
{
  "status": "success",
  "metrics": {
    "requests": {
      "total": 15420,
      "successful": 15280,
      "errors": 140,
      "rate_limited": 0
    },
    "endpoints": {
      "/api/v1/tasks/": {"count": 5840, "avg_time": 45},
      "/api/v1/search/semantic": {"count": 2130, "avg_time": 180},
      "/api/v1/projects/health": {"count": 890, "avg_time": 120}
    },
    "authentication": {
      "total_plugins": 12,
      "active_sessions": 8,
      "expired_tokens": 4
    },
    "performance": {
      "avg_response_time": 67,
      "p95_response_time": 250, 
      "p99_response_time": 500
    }
  }
}
```

## ⚡ MCP Tools Reference

Vespera V2 provides 14 specialized MCP tools for AI agent integration. These tools are accessible through Claude Code and other MCP-compatible systems.

### Task Management Tools

#### 1. create_task

Create a new task with comprehensive metadata.

**Input:**
```json
{
  "task_input": {
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication to the API",
    "parent_id": null,
    "project_id": "api-v2", 
    "feature": "authentication",
    "role": "backend_developer",
    "priority": "high"
  }
}
```

**Output:**
```json
{
  "status": "success",
  "task": {
    "task_id": "task_12345",
    "title": "Implement user authentication",
    "status": "pending",
    "created_at": "2025-01-19T10:30:00Z"
  }
}
```

#### 2. create_task_tree

Create hierarchical task structures in a single operation.

**Input:**
```json
{
  "tree_input": {
    "title": "User Management System",
    "description": "Complete user authentication and management",
    "project_id": "user-system",
    "feature": "user-management",
    "subtasks": [
      {
        "title": "Design database schema",
        "description": "Design user tables and relationships",
        "role": "database_architect",
        "priority": "high",
        "order": 1
      },
      {
        "title": "Implement authentication API",
        "description": "JWT token-based authentication endpoints",
        "role": "backend_developer",
        "priority": "high", 
        "order": 2
      }
    ]
  }
}
```

#### 3. get_task

Retrieve detailed task information including relationships.

**Input:**
```json
{
  "task_id": "task_12345"
}
```

**Output:**
```json
{
  "status": "success",
  "task": {
    "task_id": "task_12345",
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication to the API",
    "status": "in_progress",
    "priority": "high",
    "role": "backend_developer",
    "parent_id": null,
    "children": ["task_12346", "task_12347"],
    "dependencies": ["task_11111"],
    "metadata": {
      "estimated_hours": 8,
      "actual_hours": 4.5,
      "tags": ["backend", "security"]
    }
  }
}
```

#### 4. update_task

Modify existing task properties.

**Input:**
```json
{
  "update_input": {
    "task_id": "task_12345",
    "title": "Implement user authentication (updated)",
    "status": "in_progress",
    "priority": "critical"
  }
}
```

#### 5. delete_task

Remove a task and optionally its children.

**Input:**
```json
{
  "task_id": "task_12345",
  "recursive": true
}
```

#### 6. list_tasks

Get filtered list of tasks with pagination.

**Input:**
```json
{
  "project_id": "user-system",
  "status_filter": "in_progress",
  "priority_filter": "high",
  "assignee": "backend_developer",
  "limit": 50
}
```

### Task Hierarchy & Relationships

#### 7. get_task_tree

Retrieve hierarchical task structure.

**Input:**
```json
{
  "task_id": "task_12345"
}
```

**Output:**
```json
{
  "status": "success",
  "tree": {
    "task_id": "task_12345",
    "title": "User Management System",
    "children": [
      {
        "task_id": "task_12346",
        "title": "Design database schema",
        "children": []
      }
    ]
  },
  "statistics": {
    "total_nodes": 5,
    "completed": 2,
    "in_progress": 2,
    "pending": 1
  }
}
```

#### 8. analyze_task_dependencies

Analyze task dependencies and detect cycles.

**Input:**
```json
{
  "task_id": "task_12345"
}
```

**Output:**
```json
{
  "status": "success",
  "dependencies": [
    {
      "task_id": "task_12346",
      "depends_on": "task_12345",
      "dependency_type": "hard"
    }
  ],
  "cycles": [],
  "critical_path": ["task_12345", "task_12346", "task_12347"]
}
```

#### 9. add_task_dependency

Create dependency relationships between tasks.

**Input:**
```json
{
  "task_id": "task_12346",
  "depends_on_task_id": "task_12345"
}
```

### Task Execution & Completion

#### 10. execute_task

Execute a task using its assigned role (dry run supported).

**Input:**
```json
{
  "task_id": "task_12345",
  "dry_run": false
}
```

**Output:**
```json
{
  "status": "success",
  "execution": {
    "task_id": "task_12345",
    "role": "backend_developer",
    "capabilities_used": ["WRITE_CODE", "TEST_CODE"],
    "files_accessed": ["auth.py", "test_auth.py"],
    "execution_time": "00:02:30",
    "output": "Authentication system implemented successfully"
  }
}
```

#### 11. complete_task

Mark a task as completed with outputs and artifacts.

**Input:**
```json
{
  "task_id": "task_12345",
  "output": "Authentication system implemented with JWT tokens",
  "artifacts": ["auth.py", "jwt_utils.py", "test_auth.py"]
}
```

### Role Management

#### 12. list_roles

Get all available roles and their capabilities.

**Output:**
```json
{
  "status": "success",
  "roles": [
    {
      "name": "backend_developer",
      "description": "Backend development with Python/Node.js",
      "capabilities": ["WRITE_CODE", "READ_CODE", "DEBUG_CODE", "TEST_CODE"],
      "file_patterns": ["*.py", "*.js", "*.sql"],
      "max_concurrent_tasks": 5
    }
  ]
}
```

#### 13. assign_role_to_task

Assign a role to a task with capability validation.

**Input:**
```json
{
  "task_id": "task_12345",
  "role_name": "backend_developer"
}
```

### Dashboard & Analytics

#### 14. get_task_dashboard

Get comprehensive project dashboard with metrics.

**Input:**
```json
{
  "project_id": "user-system"
}
```

**Output:**
```json
{
  "status": "success",
  "summary": {
    "total_tasks": 25,
    "completed_tasks": 15,
    "in_progress_tasks": 6,
    "pending_tasks": 4,
    "blocked_tasks": 0
  },
  "metrics": {
    "completion_rate": 0.60,
    "average_task_duration": "2.5 days",
    "velocity": 3.2,
    "quality_score": 8.7
  },
  "recent_activity": [
    {
      "type": "task_completed",
      "task_id": "task_12345",
      "task_title": "Implement authentication",
      "timestamp": "2025-01-19T14:30:00Z"
    }
  ],
  "role_workload": [
    {
      "role": "backend_developer",
      "assigned_tasks": 8,
      "utilization": 0.8
    }
  ]
}
```

## 🔧 Error Handling

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Invalid or missing token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., dependency cycle) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Response Format

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_TASK_STATUS",
    "message": "Invalid task status 'invalid_status'. Valid values: pending, in_progress, completed, blocked",
    "details": {
      "field": "status",
      "provided_value": "invalid_status",
      "valid_values": ["pending", "in_progress", "completed", "blocked"]
    },
    "timestamp": "2025-01-19T10:30:00Z",
    "request_id": "req_12345"
  }
}
```

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_TOKEN` | Authentication token is invalid | Refresh or regenerate token |
| `TOKEN_EXPIRED` | Authentication token has expired | Get new token via `/api/v1/plugins/register` |
| `TASK_NOT_FOUND` | Task ID does not exist | Verify task ID exists |
| `DEPENDENCY_CYCLE` | Creating dependency would cause cycle | Remove conflicting dependencies |
| `ROLE_NOT_FOUND` | Role name does not exist | Check available roles via `/api/v1/roles/` |
| `INSUFFICIENT_PERMISSIONS` | Plugin lacks required permissions | Check plugin capabilities |
| `INVALID_TASK_STATUS` | Invalid status transition | Check valid status values |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Implement backoff strategy |

## 📊 Rate Limits

| Endpoint Category | Requests per Minute | Burst Limit |
|-------------------|---------------------|-------------|
| Task Management | 100 | 20 |
| Search & Intelligence | 50 | 10 |
| Role Management | 30 | 5 |
| Project Analytics | 20 | 5 |
| WebSocket connections | 10 new connections | 3 |

When rate limits are exceeded, the API returns:

```json
{
  "status": "error",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "retry_after": 60
  }
}
```

## 🚀 Performance Guidelines

### Response Times

| Operation Type | Target Response Time | Maximum |
|----------------|---------------------|---------|
| Task CRUD operations | < 100ms | 500ms |
| Semantic search | < 300ms | 1000ms |
| Project analytics | < 500ms | 2000ms |
| WebSocket events | < 50ms | 200ms |

### Optimization Tips

1. **Use pagination** for large result sets
2. **Filter requests** to reduce payload size
3. **Cache frequently accessed data** on client side
4. **Use WebSockets** for real-time updates instead of polling
5. **Batch operations** when creating multiple tasks
6. **Specify fields** to return only needed data

### Caching

The API includes automatic caching for:
- Role definitions (1 hour)
- Project health metrics (5 minutes)  
- Search results (2 minutes)
- Task trees (1 minute)

Include `Cache-Control: no-cache` header to bypass cache.

## 🔗 Integration Examples

### React Hook for Task Management

```javascript
import { useState, useEffect } from 'react';

const useVesperaAPI = (token) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const api = {
    baseURL: 'http://localhost:8000',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  
  const fetchTasks = async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${api.baseURL}/api/v1/tasks/?${params}`, {
        headers: api.headers
      });
      const data = await response.json();
      setTasks(data.tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const createTask = async (taskData) => {
    try {
      const response = await fetch(`${api.baseURL}/api/v1/tasks/`, {
        method: 'POST',
        headers: api.headers,
        body: JSON.stringify(taskData)
      });
      const data = await response.json();
      setTasks(prev => [...prev, data.task]);
      return data.task;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  };
  
  return { tasks, loading, fetchTasks, createTask };
};
```

### Python Client Library

```python
import requests
from typing import Dict, List, Optional

class VesperaClient:
    def __init__(self, base_url: str = "http://localhost:8000", token: str = None):
        self.base_url = base_url
        self.session = requests.Session()
        if token:
            self.session.headers.update({'Authorization': f'Bearer {token}'})
    
    def create_task(self, title: str, description: str = "", **kwargs) -> Dict:
        """Create a new task"""
        data = {
            'title': title,
            'description': description,
            **kwargs
        }
        response = self.session.post(f'{self.base_url}/api/v1/tasks/', json=data)
        response.raise_for_status()
        return response.json()
    
    def search_tasks(self, query: str, n_results: int = 10) -> Dict:
        """Semantic search for tasks"""
        data = {
            'query': query,
            'n_results': n_results
        }
        response = self.session.post(f'{self.base_url}/api/v1/search/semantic', json=data)
        response.raise_for_status()
        return response.json()
    
    def get_project_health(self, project_id: str) -> Dict:
        """Get project health metrics"""
        response = self.session.get(f'{self.base_url}/api/v1/projects/{project_id}/health')
        response.raise_for_status()
        return response.json()

# Usage example
client = VesperaClient(token="your-token-here")

# Create a task
task = client.create_task(
    title="Implement search feature",
    description="Add full-text search with filters",
    project_id="web-app",
    priority="high"
)

# Search for related tasks
results = client.search_tasks("search functionality implementation")

# Check project health
health = client.get_project_health("web-app")
```

---

**🎉 You now have complete API reference for building powerful Vespera V2 integrations!**

*Next: Explore specific integration guides for [VS Code](plugin-development/vscode-integration.md), [Obsidian](plugin-development/obsidian-integration.md), or [Custom Applications](plugin-development/custom-plugins.md).*