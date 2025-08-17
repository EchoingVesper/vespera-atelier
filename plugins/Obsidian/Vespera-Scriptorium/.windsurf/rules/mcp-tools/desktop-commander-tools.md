---
trigger: model_decision
description: "Apply when working with file system and terminal operations"
---

# Desktop Commander Tools

## Overview

Desktop Commander provides file system and terminal operations essential for development tasks in the Vespera-Scriptorium project.

## Key Tools

### File Operations

- **`create_directory`**: Create directories for project organization
  - Use for setting up new component directories
  - Example: `create_directory({ path: "/path/to/new/directory" })`

- **`edit_block`**: Make surgical edits to files
  - Use for updating message type definitions
  - Example: `edit_block({ file_path: "/path/to/file", old_string: "...", new_string: "..." })`

- **`move_file`**: Reorganize project files
  - Use for refactoring component structure
  - Example: `move_file({ source: "/old/path", destination: "/new/path" })`

- **`read_file`**: View file contents
  - Use for examining configuration and code
  - Example: `read_file({ path: "/path/to/file" })`

- **`write_file`**: Create or update files
  - Use for creating new components or configurations
  - Example: `write_file({ path: "/path/to/file", content: "file content" })`

### Terminal Operations

- **`execute_command`**: Run terminal commands
  - Use for starting NATS servers, running tests
  - Example: `execute_command({ command: "npm test", timeout_ms: 5000 })`

- **`read_output`**: View terminal output
  - Use for checking command results
  - Example: `read_output({ pid: 1234 })`

## Last Updated: 2025-05-26s
