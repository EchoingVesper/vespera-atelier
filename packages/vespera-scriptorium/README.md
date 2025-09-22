# Vespera Scriptorium - FastMCP Translation Layer

A minimal FastMCP server that serves as a pure translation layer to the Rust Bindery backend. This implementation focuses on clean, reliable MCP tool exposure with proper error handling and graceful shutdown capabilities.

## Overview

This FastMCP server translates MCP tool calls into HTTP requests to the Rust Bindery backend running at `http://localhost:3000`. It implements FastMCP best practices including:

- **Proper error handling** to prevent "Interrupted by user" errors
- **Structured logging** to stderr only (stdout reserved for MCP protocol)
- **Graceful shutdown** handling with signal management
- **Async HTTP client** with connection pooling and timeouts
- **Pydantic validation** for all inputs and outputs

## Architecture

```
Claude Code (MCP Client)
    ↓ MCP Protocol (stdio)
FastMCP Server (Python)
    ↓ HTTP/JSON API
Rust Bindery Backend
```

### Components

1. **`mcp_server.py`** - Main FastMCP server with 8 core tools
2. **`bindery_client.py`** - HTTP client for Rust Bindery communication
3. **`models.py`** - Pydantic models for type safety and validation
4. **`pyproject.toml`** - Modern Python project configuration
5. **`requirements.txt`** - Minimal dependencies

## Available MCP Tools

### Task Management
- `create_task(task_input: TaskInput)` - Create a new task
- `get_task(task_id: str)` - Retrieve task by ID
- `update_task(task_id: str, task_update: TaskUpdateInput)` - Update existing task
- `list_tasks(project_id?: str, status?: str)` - List tasks with optional filtering

### Project Management
- `create_project(project_input: ProjectInput)` - Create a new project

### Search & Analytics
- `search_entities(search_input: SearchInput)` - Search across tasks, projects, notes
- `get_dashboard_stats()` - Retrieve dashboard statistics

### System
- `health_check()` - Check backend health and connectivity

## Installation

### Prerequisites

- Python 3.9+
- Rust Bindery backend running at `http://localhost:3000`

### Setup

1. **Install dependencies:**
   ```bash
   cd /home/aya/Development/vespera-atelier/packages/vespera-scriptorium
   pip install -r requirements.txt
   ```

2. **Run the MCP server:**
   ```bash
   python mcp_server.py
   ```

   Or using the entry point:
   ```bash
   vespera-mcp
   ```

## Development

### Project Structure

```
packages/vespera-scriptorium/
├── mcp_server.py           # Main FastMCP server
├── bindery_client.py       # HTTP client for Rust backend
├── models.py               # Pydantic models
├── requirements.txt        # Dependencies
├── pyproject.toml         # Project configuration
├── README.md              # This file
├── legacy/                # Archived previous implementation
└── tests/                 # Test files
```

### Running Tests

```bash
pytest tests/
```

### Code Formatting

```bash
black .
isort .
```

## Configuration

### Environment Variables

- `BINDERY_URL` - Rust Bindery backend URL (default: `http://localhost:3000`)
- `LOG_LEVEL` - Logging level (default: `INFO`)

### Bindery Backend

The server expects the Rust Bindery backend to provide these HTTP endpoints:

- `GET /health` - Health check
- `POST /api/tasks` - Create task
- `GET /api/tasks/{id}` - Get task
- `PUT /api/tasks/{id}` - Update task
- `GET /api/tasks` - List tasks
- `POST /api/projects` - Create project
- `POST /api/search` - Search entities
- `GET /api/dashboard/stats` - Dashboard statistics

## Error Handling

The server implements comprehensive error handling:

1. **Connection Errors**: When Bindery backend is unavailable
2. **HTTP Errors**: 4xx/5xx responses from backend
3. **Validation Errors**: Invalid data from backend or client
4. **Timeout Errors**: Request timeouts and network issues

All errors are returned as structured responses rather than exceptions to prevent MCP protocol disruption.

## Logging

All logging goes to stderr using structured JSON format:

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "event": "Starting create_task",
  "logger": "mcp_server"
}
```

This ensures stdout remains clean for MCP protocol communication.

## Signal Handling

The server handles shutdown signals gracefully:

- `SIGINT` (Ctrl+C) - Initiates graceful shutdown
- `SIGTERM` - Process termination signal

During shutdown:
1. Stop accepting new requests
2. Complete in-flight operations
3. Close HTTP connections
4. Clean up resources

## Claude Code Integration

To use with Claude Code, ensure your `.claude/config.json` includes:

```json
{
  "mcpServers": {
    "vespera-scriptorium": {
      "command": "python",
      "args": ["/home/aya/Development/vespera-atelier/packages/vespera-scriptorium/mcp_server.py"],
      "cwd": "/home/aya/Development/vespera-atelier/packages/vespera-scriptorium"
    }
  }
}
```

Then restart Claude Code or reconnect:
```bash
/mcp reconnect vespera-scriptorium
```

## Migration from Previous Versions

The previous implementation has been archived to the `legacy/` directory. Key changes in v3.0:

1. **FastMCP Framework**: Migrated from custom MCP implementation
2. **Improved Error Handling**: Structured error responses instead of exceptions
3. **Better Async Support**: Full async/await throughout
4. **Type Safety**: Comprehensive Pydantic models
5. **Modular Architecture**: Separated concerns across multiple files

## Troubleshooting

### Common Issues

1. **"Cannot connect to Bindery backend"**
   - Ensure Rust Bindery is running at `http://localhost:3000`
   - Check firewall and network connectivity
   - Verify backend health with `curl http://localhost:3000/health`

2. **"Tool execution interrupted"**
   - Usually indicates an unhandled exception
   - Check stderr logs for detailed error information
   - Ensure all dependencies are installed

3. **"Invalid response from backend"**
   - Backend returned unexpected data format
   - Check backend API compatibility
   - Verify Pydantic model definitions match backend schema

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=DEBUG python mcp_server.py
```

### Health Check

Test connectivity manually:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/call", "params": {"name": "health_check"}}'
```

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
Part of the Vespera Atelier monorepo ecosystem.

## Contributing

1. Follow existing code style (Black + isort)
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure error handling follows established patterns
5. Log to stderr only, never stdout

## Related Projects

- **Rust Bindery**: Backend task and project management service
- **Vespera Atelier**: Main platform coordination services
- **Vespera Utilities**: Shared utility functions across the monorepo