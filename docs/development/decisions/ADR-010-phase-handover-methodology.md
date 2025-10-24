# ADR-010: Phase Handover Methodology

**Status**: Accepted
**Date**: 2025-10-24
**Deciders**: Development Team
**Technical Story**: Phase 15 - Context Management for Claude Code Sessions

---

## Context and Problem Statement

When working with Claude Code (or any LLM assistant) across multiple sessions, context is lost between windows. The AI must be re-informed about:
- Current phase and goals
- Recent work completed
- Work in progress
- Where to pick up next
- Key architectural decisions
- Mental models for understanding the system

Manual context handover is error-prone, incomplete, and time-consuming. We need a standardized methodology that:
- Minimizes ramp-up time for new sessions
- Ensures critical information isn't lost
- Is lightweight enough to actually use
- Will eventually be automatable by the Codex system itself

**Question**: How do we standardize context handover between Claude Code sessions in a way that's effective now and automatable later?

## Decision Drivers

* **Context Loss Pain**: Currently spending 15-30 minutes re-explaining context each session
* **Consistency**: Need predictable structure so AI knows what to expect
* **Completeness**: Must capture technical AND conceptual context
* **Lightweight**: Can't be so burdensome it gets skipped
* **Future Automation**: Eventually Codex system should generate these automatically
* **Multi-Purpose**: Useful for humans AND AI assistants
* **Integration**: Should fit into existing Phase tracking system

## Considered Options

1. **Free-Form Session Notes**: No template, just write what's important
2. **PRP-Style Methodology**: Complex multi-document handover system (like sergei-innostack/prps-agentic-eng)
3. **BMAD Method**: Comprehensive methodology (bmad-code-org/BMAD-METHOD)
4. **GitHub Spec-Kit**: Specification-focused approach
5. **Custom Phase Template + Slash Commands**: Tailored to our workflow with automation

## Decision Outcome

Chosen option: **"Custom Phase Template + Slash Commands"**, because it:
- Builds on our existing Phase tracking infrastructure
- Is lightweight enough to actually use consistently
- Provides both structure (template) and convenience (slash commands)
- Is specifically designed for our workflow and architecture
- Can be automated by Codex system when ready
- Serves both AI assistants and human developers

### Positive Consequences

* Standardized structure makes AI context-loading predictable
* Slash commands reduce friction ("just run `/phase-complete`")
* Phase documents serve as historical record
* "Context for AI Assistant" section specifically tailored to LLM needs
* Eventually automatable - Codex system can generate these
* Integrates with existing documentation structure

### Negative Consequences

* Requires discipline to actually use the process
* Phase completion documents can be lengthy
* Need to maintain both template and slash commands
* Initial setup overhead (but only once)

## Implementation Details

### Phase Template

Created `docs/development/phases/PHASE_TEMPLATE.md` with sections:

**For Tracking**:
- Objectives (primary, secondary, non-goals)
- What Changed (code, docs, architecture)
- Current State (implemented, planned, technical debt)
- Testing & Validation

**For Handover** (the key innovation):
- **Context for AI Assistant**
  - Quick start for next session
  - Key files to read first
  - Mental models to understand
  - Common pitfalls and gotchas
  - Important file locations
  - Commands to run

### Slash Commands

Created 5 custom Claude Code slash commands in `.claude/commands/`:

1. **`/phase-start`** - Structured process for starting new phases
   - Reads previous phase completion
   - Gathers requirements from user
   - Creates phase plan with objectives
   - Initializes todo list

2. **`/phase-complete`** - Comprehensive phase completion
   - Analyzes git history
   - Documents all changes
   - Creates completion document
   - Focuses on "Context for AI Assistant" section

3. **`/handover`** - Quick context handover for session transitions
   - Concise summary of current state
   - What's in progress
   - Immediate next steps
   - Blockers and issues

4. **`/context`** - Quick context snapshot
   - Project state overview
   - Recent work
   - Current focus
   - Key files to read

5. **`/adr`** - Create Architecture Decision Records
   - Standardizes decision documentation
   - Integrates with ADR system

### Workflow

**At Phase Start**:
```
User: /phase-start
[Interactive planning session]
→ Creates PHASE_[N]_PLAN.md
→ Initializes todos
→ Creates related ADRs if needed
```

**During Phase**:
```
[Work on implementation]
[Make commits]
[Create ADRs for significant decisions]
```

**At Phase End**:
```
User: /phase-complete
[AI analyzes changes, creates documentation]
→ Creates PHASE_[N]_COMPLETE.md
→ Fills all sections from template
→ Special focus on "Context for AI Assistant"
→ Links to ADRs and commits
```

**At Session End** (context window full):
```
User: /handover
→ Creates concise handover summary
→ Specific instructions for next session
→ Can be saved to docs/development/handovers/
```

**Starting New Session**:
```
AI reads:
1. docs/development/phases/PHASE_[N]_COMPLETE.md
2. "Context for AI Assistant" section
3. Linked ADRs and docs
→ Minimal ramp-up time
```

## Pros and Cons of the Options

### Free-Form Session Notes

* Good, because no overhead or constraints
* Good, because flexible to situation
* Bad, because inconsistent structure
* Bad, because AI can't predict what to expect
* Bad, because easy to forget critical details
* Bad, because not automatable

### PRP-Style Methodology

* Good, because comprehensive and proven
* Good, because structured approach
* Bad, because designed for different workflow
* Bad, because heavy overhead
* Bad, because multiple complex documents
* Bad, because doesn't fit our Phase system

### BMAD Method

* Good, because thorough methodology
* Good, because community-tested
* Bad, because specification-heavy
* Bad, because oriented toward upfront design
* Bad, because doesn't match our iterative approach
* Bad, because integration overhead

### GitHub Spec-Kit

* Good, because good for GitHub integration
* Good, because specification templates
* Bad, because focused on specs not context
* Bad, because doesn't address session continuity
* Bad, because minimal LLM-specific guidance

### Custom Phase Template + Slash Commands (CHOSEN)

* Good, because tailored to our exact workflow
* Good, because builds on existing Phase system
* Good, because slash commands reduce friction
* Good, because "Context for AI Assistant" section optimized for LLMs
* Good, because eventually automatable by Codex
* Good, because lightweight and pragmatic
* Bad, because custom solution to maintain
* Bad, because requires adoption discipline
* Bad, because still manual (until Codex automates it)

## Evolution Path

**Phase 1** (Now): Manual use of template and slash commands
- Discipline required
- High value from standardization
- Phase documents accumulate historical knowledge

**Phase 2** (Near Future): Semi-automation
- Git hooks could prompt for `/phase-complete` when many commits accumulate
- CI could validate phase documents exist for branches
- Templates could pre-fill from git analysis

**Phase 3** (When Codex Works): Full Automation
- Codex system monitors development activity
- Automatically generates phase documentation
- Uses LLM to analyze code changes and write summaries
- AI assistant sessions read Codex-generated handovers
- Human reviews/edits generated content

**The template and commands are designed to be forward-compatible with automation.**

## Related Decisions

* [ADR-001: Projects as Fundamental](./ADR-001-projects-fundamental.md) - Phase tracking within project context
* [ADR-004: Dynamic Template System](./ADR-004-dynamic-templates.md) - Same philosophy: templates over hardcoding

## Links

* Refines [Phase Documentation System](../phases/PHASE_TEMPLATE.md)
* Inspired by: PRP methodology, BMAD Method, GitHub Spec-Kit
* **To Be Automated By**: Codex system (future)

---

## Appendix: Example Usage

See [PHASE_15_COMPLETE.md](../phases/PHASE_15_COMPLETE.md) for a complete example of the template in use, including the "Context for AI Assistant" section.

Key innovations in that section:
- Quick start instructions (read these 3 files first)
- Mental models explained in plain language
- Common pitfalls and how to avoid them
- Specific file locations and commands
- Clear instruction for how to continue work
