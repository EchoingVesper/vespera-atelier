

# Setup and Installation Flow

*Visual guide to getting both MCP servers running*

#

# 🚀 Quick Setup Flowchart

```text
                    ┌─────────────────────────────┐
                    │       Prerequisites        │
                    │                             │
                    │ ✅ MCP-compatible client:   │
                    │   • Claude Desktop          │
                    │   • Cursor IDE              │
                    │   • VS Code + Cline         │
                    │   • Windsurf                │
                    └─────────────┬───────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │   Task Orchestrator Setup   │
                    │                             │
                    │ Option 1 (PyPI):            │
                    │ 1. pip install              │
                    │    mcp-task-orchestrator    │
                    │ 2. mcp-task-orchestrator-cli│
                    │    install                  │
                    │                             │
                    │ Option 2 (Source):          │
                    │ 1. git clone repository     │
                    │ 2. cd mcp-task-orchestrator │
                    │ 3. python run_installer.py  │
                    └─────────────┬───────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │     Claude Code Setup       │
                    │                             │
                    │ Install via package manager │
                    │ or download binary          │
                    └─────────────┬───────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │   Configuration Update      │
                    └─────────────┬───────────────┘
                                  │
                                  ▼

        ┌─────────────────────────────────────────────────────────┐
        │                MCP Configuration                        │
        │                                                         │
        │ Add to your MCP client config:                         │
        │                                                         │
        │ {                                                       │
        │   "mcpServers": {                                      │
        │     "task-orchestrator": {                             │
        │       "command": "python",                             │
        │       "args": ["-m", "mcp_task_orchestrator"]          │
        │     },                                                 │
        │     "claude-code": {                                   │
        │       "command": "claude-code",                        │
        │       "args": ["--mcp"]                                │
        │     }                                                  │
        │   }                                                    │
        │ }                                                      │
        └─────────────────┬───────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │         Restart MCP Client              │
        │                                         │
        │ • Claude Desktop: Restart app           │
        │ • VS Code: Reload window                │
        │ • Cursor: Restart Cursor                │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │         Verification Test               │
        │                                         │
        │ Run this command in your client:        │
        │                                         │
        │ "Initialize a session and plan a        │
        │  simple task to verify both servers     │
        │  are working together"                  │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │        SUCCESS! Ready to Use            │
        │                                         │
        │ 🎉 Both servers connected               │
        │ 📋 Task orchestration active            │
        │ 💻 File operations available            │
        │ 🔧 Ready for first project              │
        └─────────────────────────────────────────┘
```text
