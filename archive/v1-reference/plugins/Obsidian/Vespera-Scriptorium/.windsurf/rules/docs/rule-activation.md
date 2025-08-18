---
trigger: glob
globs: *.md
---

# Rule Activation Guide

## Overview

This guide documents the rule activation modes used in the Vespera-Scriptorium project. Understanding these modes will help you create effective rules that load at the appropriate times, optimizing context usage and ensuring Claude has access to the most relevant information.

## Activation Modes

### 1. Always On

Rules with the `always_on` trigger are loaded in every context, regardless of the file being edited. Use this mode sparingly for critical architecture information that should always be available.

```yaml
---
trigger: always_on
---
```

**When to use**: For core architecture documentation and high-level project overviews that provide essential context for all tasks.

**Examples**:

- `code/component-relationships.md` - Critical component interaction map
- `index.md` - High-level project overview and navigation

### 2. Glob Pattern

Rules with the `glob` trigger are loaded only when working with files that match the specified pattern. This mode is ideal for file-type specific rules.

```yaml
---
trigger: glob
globs: *.{extension}
---
```

**When to use**: For language-specific or file-type specific rules that are only relevant when working with certain file types.

**Examples**:

- Documentation files: `globs: *.md`
- TypeScript/JavaScript files: `globs: *.{ts,js}`
- Test files: `globs: *.{test,spec}.{ts,js}`

### 3. Model Decision

Rules with the `model_decision` trigger are loaded based on Claude's assessment of their relevance to the current task. Each rule includes a description that helps Claude determine when to load it.

```yaml
---
trigger: model_decision
description: "Apply when working with [specific functionality]"
---
```

**When to use**: For specialized tool guides and context-specific rules that are only relevant for certain tasks.

**Examples**:

- `mcp-tools/nats-tools.md` - "Apply when working with NATS messaging functionality or testing message flows"
- `mcp-tools/github-tools.md` - "Apply when working with GitHub repositories or researching code examples"

## Best Practices

1. **Minimize Always-On Rules**: Limit the number of always-on rules to conserve context space
2. **Use Specific Glob Patterns**: Make glob patterns as specific as possible to avoid loading unnecessary rules
3. **Write Clear Descriptions**: For model decision rules, write clear, specific descriptions that help Claude determine relevance
4. **Organize by Functionality**: Group related rules together with consistent activation modes
5. **Test Activation Patterns**: Verify that rules are loading correctly with different file types

## Implementation Status Notation

The project uses a standardized notation for implementation status in filenames:

- [0/4]: Not Started
- [1/4]: Initial Implementation
- [2/4]: Partial Implementation
- [3/4]: Near Completion
- [4/4]: Fully Implemented

## Last Updated: 2025-05-26
