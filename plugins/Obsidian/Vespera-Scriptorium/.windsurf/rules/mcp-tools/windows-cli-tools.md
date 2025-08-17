---
trigger: model_decision
description: "Apply when working with Windows-specific command line operations"
---

# Windows CLI Tools

## Overview

The Windows CLI MCP Server provides Windows-specific command line operations that complement Desktop Commander for system-level tasks in the Vespera-Scriptorium project.

## Available Tools

### Command Execution

- **`execute_command`**: Run commands in different shells
  - Use for PowerShell, CMD, or Git Bash commands
  - Specify working directory for reliable execution
  - Example: `execute_command({ shell: "powershell", command: "Get-Process", workingDir: "C:\\Projects" })`

### Command History

- **`get_command_history`**: View previously executed commands
  - Use for reviewing past operations
  - Helpful for debugging and documentation
  - Example: `get_command_history({ limit: 5 })`

### Directory Management

- **`get_current_directory`**: Get the current working directory
  - Use for verifying execution context
  - Example: `get_current_directory()`

## Best Practices

1. **Path Handling**: Always use absolute paths for reliability
2. **Shell Selection**: Choose the appropriate shell for each task
3. **Error Handling**: Check command output for errors

## Last Updated: 2025-05-25
