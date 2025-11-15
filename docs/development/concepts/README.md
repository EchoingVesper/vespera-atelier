# Architectural Concepts

This directory contains exploratory architectural concepts, future feature ideas, and design inspirations that emerge during development. Unlike ADRs (which document decisions made), concepts document possibilities to explore.

## What is a Concept?

A Concept captures:
- **Inspirations** - Ideas that come to mind during development
- **Future possibilities** - Features or patterns we might implement later
- **Design explorations** - Architectural patterns worth investigating
- **Template ideas** - New Codex template types or automation workflows

Concepts are **not commitments** - they're explorations that may or may not be implemented.

## Concept Format

We use a lightweight format adapted from ADRs. See [CONCEPT-TEMPLATE.md](./CONCEPT-TEMPLATE.md) for the template.

## Status Definitions

- **Exploratory**: Initial idea, needs investigation
- **Proposed**: Refined enough to consider for implementation
- **Prototyped**: Proof-of-concept exists
- **Implemented**: Became reality (link to ADR/PR)
- **Superseded**: Better approach found
- **Abandoned**: No longer relevant

---

## Concept Index

### Template System Concepts

- **[CONCEPT-001: Plan-Question-Task-ADR Workflow](./CONCEPT-001-plan-question-task-adr-workflow.md)** 🔮
  - Status: Exploratory
  - Summary: Template composition where Plans contain Questions that spawn Tasks and ADRs when answered
  - Impact: Automated workflow for phase planning and decision tracking

---

## How to Create a Concept

1. Copy `CONCEPT-TEMPLATE.md` to new file with format `CONCEPT-XXX-short-title.md`
2. Assign next available concept number
3. Fill in sections:
   - **Inspiration**: What sparked this idea?
   - **Vision**: What would this enable?
   - **Rough Design**: High-level approach (not detailed implementation)
   - **Open Questions**: What needs investigation?
   - **Related**: Similar concepts, ADRs, or existing work
4. Update this index with concept summary
5. (Optional) Create PR for discussion

## Concept Lifecycle

```
Exploratory → [Investigation] → Proposed → [Prototyping] → Prototyped
                                    ↓                           ↓
                                Abandoned                  Implemented
                                    ↓
                                Superseded
```

## Using the `/concept` Command

Quick capture via slash command:
```bash
/concept <short-title>
```

This creates a new concept file from the template and opens it for editing.

## Related Documentation

- [Architecture Decision Records](../decisions/) - Decided architectural choices
- [Phase Planning](../phases/) - Active development work
- [Reports](../reports/) - Technical investigations

---

**Legend**:
- 🔮 Exploratory (initial idea)
- 📋 Proposed (ready to consider)
- 🧪 Prototyped (proof-of-concept exists)
- ✅ Implemented (became reality)
- ❌ Abandoned/Superseded
