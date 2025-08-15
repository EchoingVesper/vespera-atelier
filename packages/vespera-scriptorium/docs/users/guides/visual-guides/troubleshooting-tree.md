

# Troubleshooting Decision Tree

*Visual guide to resolving common integration issues*

#

# 🔧 Common Issues Resolution Flow

```text
                    ┌─────────────────────────────┐
                    │        Issue Detected       │
                    │                             │
                    │ "Commands not working" or   │
                    │ "Server not responding"     │
                    └─────────────┬───────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │  Which server has issues?   │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
        ┌─────────────────────┐     ┌─────────────────────┐
        │  Task Orchestrator  │     │    Claude Code      │
        │      Issues         │     │      Issues         │
        └─────────┬───────────┘     └─────────┬───────────┘
                  │                           │
                  ▼                           ▼

    ┌─────────────────────────────┐     ┌─────────────────────────────┐
    │   Orchestrator Problems:    │     │    Claude Code Problems:    │
    │                             │     │                             │
    │ ❌ orchestrator_* commands   │     │ ❌ File operations failing  │
    │    not recognized           │     │ ❌ Directory access denied  │
    │ ❌ "No session active"       │     │ ❌ Command execution issues │
    │ ❌ Task planning fails       │     │ ❌ "Tool not available"     │
    └─────────────┬───────────────┘     └─────────────┬───────────────┘
                  │                                   │
                  ▼                                   ▼
    ┌─────────────────────────────┐     ┌─────────────────────────────┐
    │      SOLUTION STEPS:        │     │      SOLUTION STEPS:        │
    │                             │     │                             │
    │ 1. Check MCP config has:    │     │ 1. Verify Claude Code       │
    │    "task-orchestrator"      │     │    installation             │
    │                             │     │                             │
    │ 2. Restart MCP client       │     │ 2. Check file permissions   │
    │                             │     │                             │
    │ 3. Run: orchestrator_       │     │ 3. Test with: read_file     │
    │    initialize_session()     │     │                             │
    │                             │     │ 4. Restart MCP client       │
    │ 4. Check database access    │     │                             │
    └─────────────┬───────────────┘     └─────────────┬───────────────┘
                  │                                   │
                  └─────────────┬─────────────────────┘
                                │
                                ▼
                ┌─────────────────────────────────────┐
                │            Still Issues?           │
                └─────────────┬───────────────────────┘
                              │
                              ▼
                ┌─────────────────────────────────────┐
                │         Advanced Debugging          │
                │                                     │
                │ 1. Check logs in MCP client         │
                │ 2. Verify Python environment        │
                │ 3. Test servers individually        │
                │ 4. Check port conflicts             │
                │ 5. Review environment variables     │
                └─────────────────────────────────────┘

```text

#

# 🚨 Emergency Recovery

```text

Complete Reset Process:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ 1. Stop Client  │ ─► │ 2. Clear Config │ ─► │ 3. Reinstall    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐             │
│ 6. Test         │ ◄─ │ 5. Start Client │ ◄───────────┘
└─────────────────┘    └─────────────────┘
```text
