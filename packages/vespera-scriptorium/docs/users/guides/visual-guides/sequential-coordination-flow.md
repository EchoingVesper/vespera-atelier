

# Sequential Coordination Workflow

*Visual flowchart for the core integration pattern*

#

# 🔄 Complete Sequential Coordination Flow

```text
        ┌─────────────────────────────────────────┐
        │              User Request               │
        │                                         │
        │ "Create a web application with          │
        │  authentication and user management"    │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │        PHASE 1: INITIALIZATION          │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ orchestrator_initialize_session()       │
        │                                         │
        │ • Establishes workflow context          │
        │ • Sets up progress tracking             │
        │ • Initializes specialist system         │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │        PHASE 2: STRATEGIC PLANNING      │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ orchestrator_plan_task()                │
        │                                         │
        │ Input: description + subtasks_json      │
        │ • Analyzes project requirements         │
        │ • Creates structured breakdown          │
        │ • Assigns specialists to subtasks       │
        │ • Maps dependencies and order           │
        │                                         │
        │ Output: Task hierarchy with IDs         │
        └─────────────────┬───────────────────────┘
                          │
                          ▼

        ┌─────────────────────────────────────────┐
        │      PHASE 3: SEQUENTIAL EXECUTION      │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ FOR EACH SUBTASK (in dependency order): │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ orchestrator_execute_subtask(task_id)   │
        │                                         │
        │ • Retrieves specialist context          │
        │ • Provides expert guidance              │
        │ • Sets up execution environment         │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │         Claude Code Operations          │
        │                                         │
        │ 🛠️ File Operations:                     │
        │   • read_file, write_file               │
        │   • create_directory, list_directory    │
        │   • search_files, search_code           │
        │                                         │
        │ 💻 Code Operations:                     │
        │   • execute_command                     │
        │   • edit_block (targeted changes)      │
        │   • get_file_info                       │
        │                                         │
        │ 🔧 Implementation Tasks:                │
        │   • Write application code              │
        │   • Create configuration files          │
        │   • Set up project structure            │
        │   • Run tests and validation            │
        └─────────────────┬───────────────────────┘
                          │
                          ▼

        ┌─────────────────────────────────────────┐
        │ orchestrator_complete_subtask()         │
        │                                         │
        │ • Records what was accomplished         │
        │ • Logs artifacts created                │
        │ • Updates progress tracking             │
        │ • Determines next action                │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │      More subtasks remaining?           │
        └─────────────────┬───────────────────────┘
                          │
                     ┌────┴─── Yes
                     │         
                     ▼         
        ┌─────────────────────────────────────────┐
        │ Continue to next subtask                │
        │ (Return to execute_subtask)             │
        └─────────────────────────────────────────┘
                          │
                          └─────────┐
                                    │
                          ┌─────────▼─── No
                          │              
                          ▼              
        ┌─────────────────────────────────────────┐
        │       PHASE 4: SYNTHESIS                │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ orchestrator_synthesize_results()       │
        │                                         │
        │ • Combines all subtask outputs          │
        │ • Creates comprehensive summary         │
        │ • Lists all artifacts produced          │
        │ • Provides final project overview       │
        │ • Offers next steps or maintenance      │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │           PROJECT COMPLETE              │
        │                                         │
        │ ✅ All requirements met                 │
        │ 📁 All files created                    │
        │ 🧪 Tests passing                        │
        │ 📖 Documentation complete               │
        └─────────────────────────────────────────┘

```text

#

# 🎯 Key Coordination Principles

#

#

# Resource Ownership

```text

Task Orchestrator  ────► Planning & Coordination
Claude Code       ────► File Operations & Implementation

```text

#

#

# Error Handling Strategy

```text

                    Error Detected
                          │
                          ▼
            ┌─── Execution Error? ───┐
            │                       │
        Yes │                       │ No
            ▼                       ▼
    Claude Code handles         Orchestrator
    implementation issues       handles workflow
                                   issues

```text

#

#

# Context Flow

```text

Session Context ──┬── Task Context ──┬── Specialist Context
                  │                  │
                  │                  └── Implementation Details
                  │
                  └── Progress Tracking ─── Results Synthesis
```text

This flow ensures clean coordination while maintaining flexibility for complex projects.
