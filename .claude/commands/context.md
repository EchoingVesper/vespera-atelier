---
description: Quick context dump for understanding current project state
---

# Quick Context Dump

Provide a quick overview of the Vespera Atelier project's current state. This is useful for:
- Starting a new session
- After reviewing changes
- Before making significant decisions
- When user asks "what's the current state?"

## What to Include

### 1. Project Snapshot

```
Vespera Atelier - [Current Date]
Current Branch: [branch name]
Current Phase: Phase [N] - [Title] ([Status])
```

### 2. Architecture Overview

Provide a brief (3-4 bullet) summary of the system architecture:

```markdown
**Core Architecture**:
- Projects are fundamental - everything exists in a project
- Dynamic JSON5-based templates define content types
- Codices can nest (Scrivener-style folders)
- VS Code extension + Rust Bindery backend + FastMCP server
```

### 3. Recent Work

What's been done in the last 1-2 sessions:

```markdown
**Recent Changes**:
- Phase 15: Complete documentation audit and restructure
  - Reorganized docs/ into architecture/, development/, etc.
  - Created 3 foundation documents for project-centric architecture
  - Added ADR system for tracking decisions
```

### 4. Current Focus

What we're working on right now:

```markdown
**Current Focus**: [One-sentence description]

**Active Files**:
- [File paths that are being worked on]

**Status**: [Brief status update]
```

### 5. What's Next

Immediate next steps:

```markdown
**Next Steps**:
1. [Immediate next action]
2. [Following action]
3. [After that]
```

### 6. Key Files to Know

Point to the most important documentation:

```markdown
**Essential Docs**:
- [docs/README.md](docs/README.md) - Documentation hub
- [CLAUDE.md](CLAUDE.md) - Development guidelines
- [docs/development/phases/PHASE_[N]_COMPLETE.md] - Latest phase
- [docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md] - Core concept
```

### 7. Quick Stats

```markdown
**Stats**:
- Current Phase: Phase [N]
- ADRs Created: [count]
- Open TODOs: [count from hook if available]
- Last Commit: [hash] - [message]
```

## Output Format

Present as a clean, scannable markdown document that can be read in 60 seconds.

---

**Example Usage**:
```
User: /context
Assistant:

# Vespera Atelier - Context Snapshot
**Date**: 2025-10-24
**Branch**: feat/codex-ui-framework
**Phase**: Phase 15 - Documentation Audit (Complete)

## Architecture Overview
- Projects are fundamental - everything exists in a project
- Dynamic JSON5-based templates define content types
- Codices can nest (Scrivener-style folders with content)
- VS Code extension + Rust Bindery backend + FastMCP server

## Recent Work
Phase 15 just completed:
- Reorganized documentation structure (docs/technical/ → docs/architecture/)
- Created 3 foundation documents (PROJECT_CENTRIC, HIERARCHICAL_TEMPLATES, CODEX_NESTING)
- Established ADR system for decision tracking
- Added implementation warnings to aspirational docs

## Current Focus
**Setting up phase handover system for context management**

Files being created:
- .claude/commands/ - Custom slash commands
- docs/development/phases/PHASE_TEMPLATE.md
- Phase 15 completion document

Status: Creating /phase-start, /phase-complete, /handover commands

## Next Steps
1. Complete Phase 15 documentation
2. Plan Phase 16 (project-centric implementation)
3. Begin implementation of mandatory projects

## Key Documents
- [docs/README.md](docs/README.md) - Start here
- [docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md] - Core concept
- [docs/development/decisions/README.md] - ADR index
- [CLAUDE.md](CLAUDE.md) - Dev guidelines

## Stats
- Phase: 15 (Documentation Audit)
- ADRs: 3 created (ADR-001, ADR-004, ADR-007)
- Open TODOs: 290 (from hook)
- Last Commit: a358de5 - docs(CLAUDE.md): Update references
```

---

**When to Use This Command**:
- Starting a new session: `/context` to get oriented
- After git pull: `/context` to see what changed
- Before big decisions: `/context` to recall current state
- After long break: `/context` to refresh memory
