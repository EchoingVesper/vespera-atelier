#!/bin/bash

# Session start script for Vespera Scriptorium V2 development
# This runs when Claude Code starts or resumes a session

echo "🚀 Vespera Scriptorium V2 Development Session"
echo "=============================================="

# Check current directory context
if [[ -f "packages/vespera-scriptorium/mcp_server_v2.py" ]]; then
    echo "✅ V2 system detected in monorepo"
    cd packages/vespera-scriptorium 2>/dev/null || echo "⚠️  Could not switch to V2 directory"
elif [[ -f "mcp_server_v2.py" ]]; then
    echo "✅ V2 system detected in current directory"
else
    echo "⚠️  V2 system not found - ensure you're in the correct directory"
fi

# Check Python virtual environment for V2
if [[ -d "mcp_venv" ]]; then
    if [[ -n "$VIRTUAL_ENV" ]] && [[ "$VIRTUAL_ENV" == *"mcp_venv"* ]]; then
        echo "✅ V2 virtual environment active: $VIRTUAL_ENV"
    else
        echo "⚠️  V2 virtual environment not active"
        echo "   Consider running: source mcp_venv/bin/activate"
    fi
else
    echo "ℹ️  V2 virtual environment not found (run installation first)"
fi

# Check for V2 required tools
command -v black >/dev/null 2>&1 && echo "✅ black installed" || echo "⚠️  black not found (V2 formatting disabled)"
command -v isort >/dev/null 2>&1 && echo "✅ isort installed" || echo "⚠️  isort not found (V2 import sorting disabled)"

# Check V2 system status
if [[ -f "requirements.txt" ]]; then
    echo "✅ V2 requirements.txt found"
else
    echo "⚠️  V2 requirements.txt missing"
fi

if [[ -d "tasks" ]] && [[ -d "roles" ]]; then
    echo "✅ V2 core modules (tasks, roles) found"
else
    echo "⚠️  V2 core modules missing"
fi

# Check V2 database
if [[ -f "tasks.sqlite" ]]; then
    echo "✅ V2 task database found"
else
    echo "ℹ️  V2 task database will be created on first use"
fi

# Remind about V2 commands
echo ""
echo "V2 Development Commands:"
echo "  python test_task_system.py      # Test V2 task management"
echo "  python test_role_system.py      # Test V2 role system"
echo "  python test_mcp_fastmcp.py      # Test V2 MCP server"
echo "  ./mcp_venv/bin/python mcp_server_v2.py  # Run V2 MCP server"
echo "  black roles/ tasks/ *.py        # Format V2 code"
echo "  isort roles/ tasks/ *.py        # Sort V2 imports"
echo ""
echo "Claude Code MCP Integration:"
echo "  claude mcp restart vespera-scriptorium  # Restart V2 MCP server"
echo "  claude mcp list | grep vespera-scriptorium  # Check V2 MCP status"

echo "=============================================="
echo "Ready for V2 development! Check CLAUDE.md for V2 guidelines."