# Backend Integration for MCP Server

## Summary
The MCP server has been enhanced to automatically manage the Bindery Rust backend lifecycle. When enabled, it will:
1. Build the Rust binary if needed
2. Launch the backend on startup
3. Wait for health checks before proceeding
4. Gracefully shut down the backend on exit

## Current Status
✅ **MCP Server Integration Complete**
- Backend manager module created (`backend_manager.py`)
- MCP server modified to auto-launch backend
- Environment variable control: `MCP_AUTO_LAUNCH_BACKEND`
- Proper process lifecycle management
- Health checking and retry logic

❌ **Bindery Backend Build Issues**
The Rust backend currently has compilation errors that need to be fixed:
- Missing sqlx::Error conversion for BinderyError
- Unresolved imports for metrics functions
- Various type mismatches and missing trait implementations

## How It Works

### Backend Manager Features
- **Automatic building**: Runs `cargo build` if binary doesn't exist
- **Process management**: Starts/stops the Rust server process
- **Health checking**: Waits for `/health` endpoint to respond
- **Graceful shutdown**: Sends SIGTERM, then SIGKILL if needed
- **Configurable timeouts**: Build, startup, and shutdown timeouts

### MCP Server Integration
```python
# The MCP server now:
1. Checks MCP_AUTO_LAUNCH_BACKEND environment variable
2. If true (default), creates a BinderyBackendManager
3. Builds and starts the Bindery backend
4. Waits for health check to pass
5. Proceeds with normal MCP operation
6. On shutdown, stops the backend gracefully
```

## Configuration

### Environment Variables
- `MCP_AUTO_LAUNCH_BACKEND`: Set to "false" to disable auto-launch (default: "true")
- `BINDERY_PORT`: Port for the backend server (default: 3000)
- `RUST_LOG`: Logging level for the Rust backend (default: "info")

### File Locations
- Backend project: `/packages/vespera-utilities/vespera-bindery/`
- Backend binary: `/packages/vespera-utilities/vespera-bindery/target/debug/bindery-server`
- MCP server: `/packages/vespera-scriptorium/mcp_server.py`
- Backend manager: `/packages/vespera-scriptorium/backend_manager.py`

## Usage

### With Auto-Launch (Default)
```bash
# Just start the MCP server, backend launches automatically
python3 mcp_server.py
```

### Without Auto-Launch
```bash
# Disable auto-launch and manage backend separately
export MCP_AUTO_LAUNCH_BACKEND=false
python3 mcp_server.py

# In another terminal, start backend manually
cd packages/vespera-utilities/vespera-bindery
cargo run --bin bindery-server
```

### In Claude Code
The MCP server registered as `vespera-bindery` will automatically manage the backend when Claude Code starts it.

## Next Steps

1. **Fix Rust Compilation Errors**
   - Add sqlx::Error to BinderyError conversions
   - Fix missing metrics imports
   - Resolve type mismatches

2. **Test Full Integration**
   - Once Rust builds, test the full auto-launch flow
   - Verify all 14 MCP tools work with real backend
   - Test shutdown and cleanup

3. **Production Considerations**
   - Add retry logic for transient failures
   - Implement backend restart on crash
   - Add monitoring and alerting
   - Configure for different environments (dev/staging/prod)

## Benefits

✅ **Single Command Launch**: No need to start backend separately
✅ **Automatic Cleanup**: Backend stops when MCP server stops
✅ **Build Management**: Automatically builds Rust binary if needed
✅ **Health Assurance**: Won't proceed until backend is healthy
✅ **Graceful Degradation**: Works without backend (returns errors)
✅ **Configurable**: Can disable for manual backend management

## Technical Details

The implementation uses:
- Python `subprocess` for process management
- `httpx` for health checks
- Signal handlers for graceful shutdown
- Async/await for non-blocking operations
- Structured logging to stderr

The backend manager is designed to be resilient and handle various failure scenarios while providing clear logging for debugging.