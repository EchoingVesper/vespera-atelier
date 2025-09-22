# MCP Tools Integration Test

Once Claude Code is restarted and the MCP server is connected, test these 14 tools:

## 1. Health Check
Test the backend connection:
- Tool: `health_check`
- Expected: Should return health status or connection error

## 2. Create Task
Create a new task:
- Tool: `create_task`
- Args: TaskInput with title="Test Task", description="Testing MCP integration", priority="medium"

## 3. Get Task
Retrieve the created task:
- Tool: `get_task`
- Args: task_id from previous step

## 4. Update Task
Update the task:
- Tool: `update_task`
- Args: task_id and TaskUpdateInput with title="Updated Test Task"

## 5. List Tasks
List all tasks:
- Tool: `list_tasks`
- Args: None (or with filters)

## 6. Complete Task
Mark task as completed:
- Tool: `complete_task`
- Args: task_id, completion_notes="Task completed successfully"

## 7. Execute Task
Execute a task with a role:
- Tool: `execute_task`
- Args: task_id, role_name="developer"

## 8. Assign Role
Assign a role to a task:
- Tool: `assign_role_to_task`
- Args: task_id, role_name="architect"

## 9. List Roles
List all available roles:
- Tool: `list_roles`
- Args: None

## 10. Delete Task
Delete a task:
- Tool: `delete_task`
- Args: task_id

## 11. Create Project
Create a new project:
- Tool: `create_project`
- Args: ProjectInput with name="Test Project", description="MCP integration test"

## 12. Get Dashboard Stats
Get dashboard statistics:
- Tool: `get_dashboard_stats`
- Args: None

## 13. Search Entities
Search across tasks and projects:
- Tool: `search_entities`
- Args: SearchInput with query="test"

## 14. Index Document
Index a document for RAG:
- Tool: `index_document`
- Args: DocumentInput with content="Test document content", title="Test Doc", document_type="TEXT"

## Expected Results
- Without Bindery backend: Each tool should return structured error response
- With Bindery backend: Each tool should perform its operation successfully

## Verification Commands

After restarting Claude Code, run:
```bash
# List MCP servers and check connection status
claude mcp list

# If vespera-bindery shows as connected, the server is working!
```

## Tool Access in Claude Code

The tools should be accessible via:
- Direct MCP tool calls in Claude Code
- The MCP Tools panel in Claude Code UI
- Commands like `/mcp call vespera-bindery <tool_name> <args>`