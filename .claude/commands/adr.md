---
description: Create a new Architecture Decision Record (ADR)
---

# Create Architecture Decision Record

Create a new ADR to document a significant architectural decision. This ensures design decisions are captured with their context, alternatives considered, and consequences.

## When to Create an ADR

Create an ADR when making decisions about:
- System architecture or design patterns
- Technology or framework choices
- Data models or API designs
- Significant refactors or migrations
- Trade-offs with lasting impact

**Don't create ADRs for**:
- Bug fixes
- Minor refactors
- Implementation details
- Temporary workarounds

## Process

### 1. Determine ADR Number

Check `docs/development/decisions/` to find the next available ADR number:

```bash
ls docs/development/decisions/ADR-*.md | tail -1
# If last is ADR-007, next is ADR-008
```

### 2. Gather Decision Context

Ask the user for:
- **Decision title**: Brief, descriptive name
- **Problem statement**: What problem are we solving?
- **Options considered**: What alternatives were evaluated?
- **Chosen solution**: Which option was selected and why?
- **Consequences**: What are the trade-offs?

### 3. Create ADR Document

Use the template at `docs/development/decisions/ADR-TEMPLATE.md`:

**File name**: `ADR-XXX-short-title.md` (use kebab-case)

**Required sections**:
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: YYYY-MM-DD
- **Context and Problem Statement**: Why is this decision needed?
- **Decision Drivers**: What factors influenced the decision?
- **Considered Options**: What alternatives were evaluated?
- **Decision Outcome**: What was chosen and why?
- **Pros and Cons**: Detailed analysis of each option
- **Links**: Related ADRs and documents

### 4. Write Clear Pros/Cons

For each option, list:
- **Good, because**: Advantages
- **Bad, because**: Disadvantages
- **Neutral**: Trade-offs

### 5. Update ADR Index

Add the new ADR to `docs/development/decisions/README.md`:

```markdown
- **[ADR-XXX: Title](./ADR-XXX-short-title.md)** ✅
  - Status: Accepted
  - Summary: [One-sentence summary]
  - Impact: [Brief impact statement]
```

### 6. Link from Related Docs

Update relevant architecture documents to reference the ADR:

```markdown
See [ADR-XXX: Title](../../development/decisions/ADR-XXX-short-title.md)
for rationale.
```

### 7. Commit the ADR

```bash
git add docs/development/decisions/ADR-XXX-short-title.md
git add docs/development/decisions/README.md
git commit -m "docs: Add ADR-XXX for [decision title]"
```

---

## Example Workflow

```
User: /adr
Assistant: I'll help you create a new ADR. Let me check the next ADR number...

[Checks docs/development/decisions/]

Next ADR is ADR-011. What architectural decision do you need to document?

User: We need to decide whether to use WebSockets or Server-Sent Events for real-time updates
Assistant: Great, I'll create ADR-011 for real-time communication protocol. Let me gather details...

What problem are you solving with real-time updates?

User: Users need to see Codex changes from other users in real-time
Assistant: Perfect. What options are you considering?

User: WebSockets for bi-directional, or Server-Sent Events for simpler one-way updates
Assistant: Got it. I'll create ADR-011 with both options analyzed...

[Creates docs/development/decisions/ADR-011-real-time-communication.md with:
- Problem: Need real-time updates for collaborative editing
- Options: WebSockets vs SSE vs polling
- Pros/Cons for each
- Decision: [User's choice] because [rationale]
- Links to Event System architecture]

ADR-011 created. I've also updated the ADR index. Would you like me to commit this?
```

---

## ADR Quality Checklist

Before finalizing an ADR, ensure:

- [ ] Problem statement is clear and concise
- [ ] All reasonable options were considered
- [ ] Each option has pros AND cons listed
- [ ] Decision rationale is explicit (not just "we liked it")
- [ ] Consequences (both positive and negative) are documented
- [ ] Links to related ADRs and architecture docs are included
- [ ] ADR index is updated
- [ ] File name uses kebab-case
- [ ] Status is set appropriately

---

## Tips for Good ADRs

**Be honest**: Document the downsides of your choice
**Be specific**: "Improves performance" → "Reduces API latency from 200ms to 50ms"
**Be future-focused**: What will this decision mean in 6 months?
**Link heavily**: Connect to architecture docs, other ADRs, GitHub issues
**Keep it concise**: ADRs should be scannable, not novels

---

## Status Transitions

```
Proposed → (approved) → Accepted
Accepted → (time passes) → Deprecated
Accepted → (replaced) → Superseded by ADR-XXX
Proposed → (rejected) → Rejected
```

When superseding an ADR:
1. Update old ADR status to "Superseded by ADR-XXX"
2. In new ADR, link to old one: "Supersedes ADR-YYY"