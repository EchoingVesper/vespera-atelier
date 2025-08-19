# Vespera V2 REST API

A comprehensive REST API layer for Vespera's task management and intelligence capabilities, designed specifically for VS Code and Obsidian plugin integration.

## 🌟 Overview

The Vespera V2 REST API provides a clean, RESTful interface to all of Vespera's sophisticated task management features, including:

- **Task Management**: Full CRUD operations for hierarchical tasks
- **Semantic Search**: AI-powered task discovery and similarity matching
- **Project Intelligence**: Graph analysis, dependency tracking, and health metrics
- **Role Management**: Capability-based role assignments and permissions
- **Plugin Integration**: Specialized endpoints for VS Code and Obsidian
- **Real-time Updates**: WebSocket support for live notifications

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd packages/vespera-scriptorium
pip install -r requirements.txt

# Install FastAPI dependencies
pip install fastapi uvicorn[standard] websockets python-multipart
```

### 2. Start the API Server

```bash
# Method 1: Using the startup script
python run_api_server.py

# Method 2: Using uvicorn directly
uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload

# Method 3: Using the server module
python -m api.server
```

### 3. Access the API

- **API Base URL**: `http://localhost:8000`
- **Interactive Documentation**: `http://localhost:8000/docs`
- **Alternative Documentation**: `http://localhost:8000/redoc`
- **WebSocket Endpoint**: `ws://localhost:8000/ws/plugins`

## 📚 API Endpoints

### Core Task Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tasks/` | List tasks with filtering and pagination |
| `POST` | `/api/v1/tasks/` | Create a new task |
| `GET` | `/api/v1/tasks/{id}` | Get task details |
| `PUT` | `/api/v1/tasks/{id}` | Update task |
| `DELETE` | `/api/v1/tasks/{id}` | Delete task |
| `POST` | `/api/v1/tasks/trees` | Create hierarchical task tree |
| `GET` | `/api/v1/tasks/{id}/tree` | Get task tree structure |
| `POST` | `/api/v1/tasks/{id}/complete` | Mark task as completed |
| `GET` | `/api/v1/tasks/dashboard` | Get task management dashboard |

### Semantic Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/search/semantic` | Semantic task search |
| `GET` | `/api/v1/search/similar/{id}` | Find similar tasks |
| `POST` | `/api/v1/search/cluster` | Semantic task clustering |
| `GET` | `/api/v1/search/recommendations` | Intelligent task recommendations |
| `GET` | `/api/v1/search/insights` | Search and discovery insights |

### Project Intelligence

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/projects/{id}/health` | Project health analysis |
| `GET` | `/api/v1/projects/{id}/dependencies` | Dependency analysis |
| `GET` | `/api/v1/projects/cycles` | Detect dependency cycles |
| `GET` | `/api/v1/projects/bottlenecks` | Find workflow bottlenecks |
| `POST` | `/api/v1/projects/{id}/impact/{task_id}` | Task impact analysis |
| `GET` | `/api/v1/projects/{id}/timeline` | Project timeline analysis |

### Role Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/roles/` | List available roles |
| `GET` | `/api/v1/roles/{name}` | Get role details |
| `POST` | `/api/v1/roles/{name}/assign/{task_id}` | Assign role to task |
| `DELETE` | `/api/v1/roles/{name}/unassign/{task_id}` | Unassign role from task |
| `GET` | `/api/v1/roles/{name}/tasks` | Get role's assigned tasks |
| `GET` | `/api/v1/roles/workload/analysis` | Workload distribution analysis |

### Plugin Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/plugins/register` | Register plugin and get token |
| `POST` | `/api/v1/plugins/auth` | Authenticate plugin |
| `GET` | `/api/v1/plugins/status` | Get plugin status |
| `POST` | `/api/v1/plugins/vscode/context/file` | Analyze file context (VS Code) |
| `POST` | `/api/v1/plugins/vscode/tasks/from-selection` | Create task from code selection |
| `POST` | `/api/v1/plugins/obsidian/context/note` | Analyze note context (Obsidian) |
| `POST` | `/api/v1/plugins/obsidian/tasks/from-note` | Create task from note |

### System & Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API root and status |
| `GET` | `/health` | System health check |
| `GET` | `/metrics` | API usage metrics |

## 🔐 Authentication

The API uses token-based authentication designed for plugin integration.

### 1. Register Your Plugin

```bash
curl -X POST "http://localhost:8000/api/v1/plugins/register" \
  -H "Content-Type: application/json" \
  -d '{
    "plugin_info": {
      "name": "My Plugin",
      "version": "1.0.0",
      "type": "vscode",
      "capabilities": ["task_creation", "file_context"]
    }
  }'
```

### 2. Use the Token

Include the token in the Authorization header:

```bash
curl -X GET "http://localhost:8000/api/v1/tasks/" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Plugin Types & Permissions

- **VS Code**: Full task management, file context, git integration
- **Obsidian**: Task management, note context, knowledge graph
- **Custom**: Basic task reading and search

## 🔌 WebSocket Real-time Updates

Connect to `ws://localhost:8000/ws/plugins?token=YOUR_TOKEN` for real-time updates.

### Example Connection (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/plugins?token=YOUR_TOKEN');

ws.onopen = function() {
    console.log('Connected to Vespera API');
    
    // Subscribe to specific events
    ws.send(JSON.stringify({
        type: 'subscribe',
        events: ['task.created', 'task.updated', 'task.completed']
    }));
};

ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    console.log('Received update:', message);
    
    if (message.type === 'task.updated') {
        // Handle task update
        updateTaskInUI(message.data);
    }
};
```

### Available Event Types

- `task.created` - New task created
- `task.updated` - Task modified
- `task.completed` - Task marked as complete
- `project.updated` - Project-level changes
- `connection.established` - WebSocket connected
- `notification.*` - Plugin-specific notifications

## 📖 Usage Examples

### Creating a Task

```bash
curl -X POST "http://localhost:8000/api/v1/tasks/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication to the API",
    "priority": "high",
    "tags": ["backend", "security"],
    "project_id": "api-v2"
  }'
```

### Semantic Search

```bash
curl -X POST "http://localhost:8000/api/v1/search/semantic" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database optimization tasks",
    "n_results": 10,
    "min_similarity": 0.7
  }'
```

### VS Code File Context Analysis

```bash
curl -X POST "http://localhost:8000/api/v1/plugins/vscode/context/file" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "src/auth.py",
    "language": "python",
    "function_name": "authenticate_user",
    "content_preview": "def authenticate_user(token):\n    # TODO: implement validation"
  }'
```

## 🏗️ Architecture

The API is built with:

- **FastAPI**: High-performance Python web framework
- **Pydantic**: Data validation and serialization
- **WebSockets**: Real-time communication
- **MCP Bridge**: Integration with existing Vespera MCP tools

### Key Components

```
api/
├── server.py              # Main FastAPI application
├── routers/               # API endpoint routers
│   ├── tasks.py          # Task management endpoints
│   ├── search.py         # Semantic search endpoints  
│   ├── projects.py       # Project intelligence endpoints
│   ├── roles.py          # Role management endpoints
│   └── plugins.py        # Plugin integration endpoints
├── middleware/            # Request/response middleware
│   ├── auth.py           # Authentication middleware
│   ├── cors.py           # CORS configuration
│   └── error_handler.py  # Error handling
├── models/                # Pydantic data models
│   ├── requests.py       # Request models
│   ├── responses.py      # Response models
│   └── common.py         # Shared models
├── utils/                 # Utility modules
│   ├── mcp_bridge.py     # MCP tool integration
│   └── plugin_helpers.py # Plugin utilities
└── websocket.py          # WebSocket handling
```

## 🧪 Testing

### Manual Testing

Use the interactive documentation at `http://localhost:8000/docs` to test endpoints directly in your browser.

### Example Python Client

```python
import requests

# Setup
BASE_URL = "http://localhost:8000"
TOKEN = "your_plugin_token"
headers = {"Authorization": f"Bearer {TOKEN}"}

# Create a task
task_data = {
    "title": "Test task",
    "description": "Created via API",
    "priority": "normal"
}
response = requests.post(f"{BASE_URL}/api/v1/tasks/", 
                        json=task_data, headers=headers)
task = response.json()["task"]

# Search for similar tasks
search_data = {"query": "test task", "n_results": 5}
response = requests.post(f"{BASE_URL}/api/v1/search/semantic", 
                        json=search_data, headers=headers)
results = response.json()["results"]
```

## 🔧 Configuration

### Environment Variables

- `VESPERA_API_HOST`: Server host (default: 0.0.0.0)
- `VESPERA_API_PORT`: Server port (default: 8000)
- `VESPERA_API_SECRET`: JWT secret key
- `VESPERA_LOG_LEVEL`: Logging level (default: INFO)

### Development vs Production

For development:
```bash
python run_api_server.py
```

For production:
```bash
uvicorn api.server:app --host 0.0.0.0 --port 8000 --workers 4
```

## 🐛 Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Ensure your token is valid and not expired
   - Check that the plugin type matches the endpoint permissions

2. **Connection Refused**
   - Verify the MCP bridge is initialized
   - Check that the underlying Vespera V2 system is running

3. **WebSocket Disconnections**
   - Implement proper reconnection logic in your client
   - Handle ping/pong messages to maintain connection

### Debugging

Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

Check server logs for detailed error information.

## 🤝 Plugin Development

### VS Code Plugin Integration

```typescript
// Example VS Code extension code
import * as vscode from 'vscode';

const API_BASE = 'http://localhost:8000';
const token = 'your_plugin_token';

async function analyzeCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const document = editor.document;
    const selection = editor.selection;
    
    const fileContext = {
        file_path: vscode.workspace.asRelativePath(document.fileName),
        language: document.languageId,
        line_number: selection.start.line,
        content_preview: document.getText(selection)
    };
    
    const response = await fetch(`${API_BASE}/api/v1/plugins/vscode/context/file`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(fileContext)
    });
    
    const result = await response.json();
    // Handle related tasks and suggestions
}
```

### Obsidian Plugin Integration

```javascript
// Example Obsidian plugin code
class VesperaPlugin extends Plugin {
    async analyzeCurrentNote() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;
        
        const content = await this.app.vault.read(activeFile);
        const noteContext = {
            note_path: activeFile.path,
            note_title: activeFile.basename,
            content_preview: content.substring(0, 1000),
            tags: this.getNoteTags(activeFile)
        };
        
        const response = await fetch(`${API_BASE}/api/v1/plugins/obsidian/context/note`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(noteContext)
        });
        
        const result = await response.json();
        // Handle related tasks and knowledge connections
    }
}
```

## 📈 Performance & Scaling

- **Async/Await**: All endpoints use async processing
- **Connection Pooling**: Automatic connection management
- **Rate Limiting**: Built-in protection against abuse
- **Caching**: Response caching for repeated queries
- **WebSocket Management**: Automatic cleanup of dead connections

## 🔗 Integration with Existing Vespera

The REST API acts as a bridge to existing Vespera V2 MCP tools:

- **MCP Bridge**: `api/utils/mcp_bridge.py` handles all MCP tool calls
- **No Duplication**: API endpoints wrap existing functionality
- **Consistent Data**: Same data models and validation as MCP tools
- **Real-time Sync**: Changes made via API are reflected in MCP tools

## 📋 Future Enhancements

- [ ] GraphQL endpoint for flexible queries
- [ ] OpenAPI 3.1 specification
- [ ] Rate limiting per plugin type
- [ ] Advanced analytics and metrics
- [ ] Batch operations for bulk updates
- [ ] Plugin marketplace integration
- [ ] Advanced webhook filtering
- [ ] Multi-tenant support

---

For more information, see the interactive documentation at `/docs` when the server is running.