# AI Agent Documentation Style Guide

**Purpose**: Guidelines for AI agents writing or editing Vespera Atelier documentation.

## Core Principles

### 1. Grounded in Reality

**DO:**
- Be honest about what exists vs. what's planned
- Acknowledge solo development and limited bandwidth
- Use "goal is..." or "intended to..." for future features
- Admit uncertainty with "attempting to..." or "working toward..."

**DON'T:**
- Oversell or use marketing hype
- Promise features not yet implemented
- Use grandiose language ("revolutionary", "groundbreaking")
- Present plans as if they're complete

**Examples:**

✅ "Vespera Atelier is an attempt to build a universal project management tool..."
❌ "Vespera Atelier is a revolutionary platform that delivers..."

✅ "The goal is to have one system that transforms to fit your needs."
❌ "Vespera seamlessly adapts to any workflow."

### 2. Honest About Scope

**DO:**
- Acknowledge this is early-stage development
- Note that the vision is ambitious, implementation is incremental
- Warn about breaking changes and incomplete features
- Separate "What Works Now" from "What's Planned"

**DON'T:**
- Hide limitations or development status
- Imply features are complete when they're not
- Skip warnings about instability
- Create expectations that can't be met

**Examples:**

✅ "Current Reality: This is a solo development project in active construction."
❌ "Vespera Atelier provides comprehensive project management..."

✅ "Not ready for general use yet. Check back when Phase 17+ is complete."
❌ "Now available for early adopters!"

### 3. Personal and Humble Tone

**DO:**
- Use first person when appropriate ("I built this to...")
- Acknowledge health challenges and limited time
- Frame as a personal journey or learning experience
- Show vulnerability about struggles and limitations

**DON'T:**
- Sound corporate or impersonal
- Hide the human element
- Be self-deprecating to a fault
- Apologize excessively

**Examples:**

✅ "I built this to solve my own problems with managing creative projects while dealing with executive dysfunction."
❌ "Our enterprise-grade platform was developed by leading experts..."

✅ "That's years of work. Right now, I'm focused on getting the basic editor working."
❌ "Sorry this isn't better, I'm just one person struggling with health issues..."

### 4. Vision Without Promises

**DO:**
- Describe long-term vision clearly
- Use conditional language ("would", "could", "planned")
- Give timescales when realistic ("years of work")
- Separate aspiration from commitment

**DON'T:**
- Make definitive promises about future features
- Set specific deadlines
- Imply inevitability ("will have", "going to deliver")
- Oversell the vision

**Examples:**

✅ "The long-term vision is a 'chameleon' tool that transforms based on project needs..."
❌ "Vespera will become the world's most adaptable project manager by 2026."

✅ "Future: Template marketplace where users share project types"
❌ "Coming Soon: Revolutionary template marketplace!"

### 5. Technical Without Jargon

**DO:**
- Explain technical concepts clearly
- Provide context for architecture decisions
- Link to detailed docs for depth
- Use concrete examples

**DON'T:**
- Assume expert knowledge
- Use unexplained acronyms
- Over-simplify to the point of inaccuracy
- Bury important details in jargon

**Examples:**

✅ "Codices: Universal file containers with metadata. Wrap any file type..."
❌ "Codices leverage our proprietary metadata abstraction layer..."

✅ "See [Architecture Decision Records](../development/decisions/) for detailed rationale."
❌ "Check the ADRs for implementation specs."

## Documentation Types

### README Files

- Start with clear, honest "What This Is (and Isn't)"
- Include explicit development status warning
- Separate user perspective from developer perspective
- End with humble sign-off ("Built incrementally by someone who needs it to exist")

### Architecture Documents

- Be technically precise but accessible
- Explain the "why" not just the "what"
- Include concrete examples and use cases
- Note implementation status clearly

### Contributing Guides

- Set realistic expectations about review time
- Acknowledge solo development context
- Be specific about what helps most
- Explain what to avoid (gently)

### Phase Plans and Reports

- Be honest about progress and blockers
- Separate "what's done" from "what's next"
- Acknowledge when things didn't go as planned
- Link to related decisions and commits

## Specific Guidance

### Status Warnings

Always include when documenting features:

```markdown
⚠️ **Development Status**: [Feature] is planned but not yet implemented. See [Phase X Plan](link) for timeline.
```

### Feature Descriptions

Use this pattern:

```markdown
**[Feature Name]**: [Simple description]

**Current Status**: [What works now]
**Planned**: [What's intended]
**Timeline**: [Realistic estimate or "future"]
```

### Implementation Notes

When documenting code:

```markdown
**Implementation Note**: This approach was chosen because [reason]. See [ADR-XXX](link) for full rationale. Current limitations: [list].
```

## Checklist for Markdown Edits

Before finalizing any .md file, verify:

- [ ] No marketing hype or overselling
- [ ] Clear about what exists vs. what's planned
- [ ] Acknowledges solo development context
- [ ] Uses grounded, realistic language
- [ ] Includes appropriate status warnings
- [ ] Links to deeper documentation where helpful
- [ ] Provides concrete examples
- [ ] Honest about limitations and challenges

## When in Doubt

Ask yourself:
1. Would I be comfortable if this was quoted out of context?
2. Does this set realistic expectations?
3. Am I being honest about implementation status?
4. Would this feel true six months from now?

If the answer to any is "no", revise toward more grounded language.

## Philosophy Reference

This style guide is based on the project's core values:
- Cognitive accessibility over polish
- Honest progress over marketing
- Personal journey over corporate facade
- Realistic increments over grand promises

See [docs/philosophy/](../philosophy/) for deeper context.

---

**Remember**: The goal is honest, helpful documentation that serves users and contributors without overselling or over-promising. When in doubt, err on the side of being grounded and realistic.
