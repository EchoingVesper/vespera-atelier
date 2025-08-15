

# Architecture Overview

*Visual guide to Task Orchestrator + Claude Code MCP integration*

#

# 🏗️ High-Level System Architecture

```text
                    ┌─── User Instructions ───┐
                    │                         │
                    ▼                         ▼
    ┌─────────────────────────────┐  ┌─────────────────────────────┐
    │    Task Orchestrator MCP    │  │     Claude Code MCP         │
    │                             │  │                             │
    │  ┌─────────────────────┐    │  │  ┌─────────────────────┐    │
    │  │   Session Manager   │    │  │  │   File Operations   │    │
    │  │                     │    │  │  │                     │    │
    │  │ • Context Tracking  │    │  │  │ • Read/Write Files  │    │
    │  │ • Task State        │    │  │  │ • Directory Ops     │    │
    │  │ • Progress Monitor  │    │  │  │ • Search & Analysis │    │
    │  └─────────────────────┘    │  │  └─────────────────────┘    │
    │                             │  │                             │
    │  ┌─────────────────────┐    │  │  ┌─────────────────────┐    │
    │  │  Task Planner       │    │  │  │  Code Generator     │    │
    │  │                     │    │  │  │                     │    │
    │  │ • Break Down Tasks  │◄───┼──┼──► • Implementation    │    │
    │  │ • Assign Specialists│    │  │  │ • Testing          │    │
    │  │ • Manage Dependencies│   │  │  │ • Validation       │    │
    │  └─────────────────────┘    │  │  └─────────────────────┘    │
    │                             │  │                             │
    │  ┌─────────────────────┐    │  │  ┌─────────────────────┐    │
    │  │ Specialist Contexts │    │  │  │   Tool Integration  │    │
    │  │                     │    │  │  │                     │    │
    │  │ • Architect         │    │  │  │ • Shell Commands    │    │
    │  │ • Implementer       │    │  │  │ • Process Control   │    │
    │  │ • Documenter        │    │  │  │ • Environment Setup │    │
    │  │ • Debugger          │    │  │  │ • Dependency Mgmt   │    │
    │  └─────────────────────┘    │  │  └─────────────────────┘    │
    └─────────────────────────────┘  └─────────────────────────────┘
                    │                             │
                    └──────── Shared Project ─────┘
                               Context & State

```text

#

# 🔄 Coordination Flow

```text

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   User Request   │────▶│  Orchestrator    │────▶│  Claude Code     │
│                  │     │  Strategic Plan  │     │  Implementation  │
│ "Build a web     │     │                  │     │                  │
│  scraper with    │     │ 1. Analyze req   │     │ 4. Write files   │
│  authentication"│     │ 2. Create tasks  │     │ 5. Execute code  │
│                  │     │ 3. Assign roles  │     │ 6. Test & debug  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         ▲                         │                         │
         │                         ▼                         │
         │               ┌──────────────────┐                │
         │               │   Progress       │                │
         └───────────────│   Tracking &     │◄───────────────┘
                         │   Synthesis      │
                         └──────────────────┘

```text

#

# 📊 Responsibility Matrix

| Function                  | Task Orchestrator | Claude Code | Shared |
|---------------------------|:----------------:|:-----------:|:------:|
| **Strategic Planning**    |        ✅        |      ❌     |   ❌   |
| **Task Breakdown**        |        ✅        |      ❌     |   ❌   |
| **Specialist Coordination**|       ✅        |      ❌     |   ❌   |
| **File Operations**       |        ❌        |      ✅     |   ❌   |
| **Code Implementation**   |        ❌        |      ✅     |   ❌   |
| **Testing & Validation**  |        ❌        |      ✅     |   ❌   |
| **Progress Tracking**     |        ✅        |      ❌     |   ❌   |
| **Context Maintenance**   |        ❌        |      ❌     |   ✅   |
| **Error Recovery**        |        ✅        |      ✅     |   ❌   |
| **Final Synthesis**       |        ✅        |      ❌     |   ❌   |

#

# 🎯 Key Design Principles

#

#

# 1. Single Responsibility

```text

Task Orchestrator ────┐
                      ├─── NO OVERLAP ─── Clean Separation
Claude Code     ──────┘

```text

#

#

# 2. Sequential Coordination

```text

Plan ──▶ Execute ──▶ Track ──▶ Synthesize
  ▲                                │
  └────── Feedback Loop ───────────┘

```text

#

#

# 3. Context Preservation

```text

┌─── Session Context ───┐
│                       │
│ • Project Goals       │
│ • Current Progress    │
│ • Specialist States   │
│ • File Locations      │
│ • Dependencies        │
│                       │
└───────────────────────┘
```text

This architecture ensures clean separation of concerns while maintaining powerful coordination capabilities.
