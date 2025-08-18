#!/usr/bin/env python3
"""
Run the Vespera Scriptorium with database persistence enabled.

This script sets the necessary environment variables to enable database persistence
and then runs the Vespera Scriptorium server.
"""

import os
import sys
import subprocess
from pathlib import Path

# Set environment variables for database persistence
os.environ["MCP_TASK_ORCHESTRATOR_USE_DB"] = "true"

# Optional: Set database path if needed
# os.environ["MCP_TASK_ORCHESTRATOR_DB_PATH"] = str(Path(__file__).parent / "vespera_scriptorium.db")

# Get the path to the Python executable
python_exe = sys.executable

# Run the Vespera Scriptorium server module
subprocess.run([python_exe, "-m", "mcp_task_orchestrator.server"])
