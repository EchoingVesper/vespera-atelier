---
trigger: glob
globs: *.md
---

# Rule Creation Best Practices

## Overview

This guide outlines best practices for creating and maintaining Windsurf rules for the Vespera-Scriptorium project. Following these guidelines will ensure rules are effective, maintainable, and optimized for Claude's context window.

## Content Guidelines

1. **Be Concise and Specific**

   - Focus on one topic per rule file
   - Limit file size to under 6,000 characters (Windsurf will truncate files larger than 6,000 characters)
   - Use clear, direct language with explicit examples

2. **Include Practical Examples**

   - Provide code snippets that demonstrate the rule in practice
   - Use TypeScript for all code examples
   - Include both correct and incorrect examples where applicable

3. **Use Standardized Formatting**

   - Follow the markdown style guide in `markdown-style.md`
   - Use explicit numbering for ordered lists (1, 2, 3)
   - Include a "Last Updated" date at the end of each file

4. **Organize Hierarchically**

   - Start with a clear title and brief overview
   - Use consistent header levels (# for title, ## for sections, ### for subsections)
   - Group related concepts together under appropriate headings

5. **Cross-Reference Related Rules**

   - Link to related rules using relative paths
   - Avoid duplicating content across multiple rule files
   - Mention dependencies between components when relevant## Activation Mode Guidelines

6. **Choose the Appropriate Activation Mode**

   - Use `always_on` only for critical architecture information
   - Use `glob` for file-type specific rules with appropriate patterns
   - Use `model_decision` for specialized tool guides with clear descriptions

7. **Optimize Glob Patterns**

   - Keep patterns simple: `globs: *.{ts,js}` for TypeScript/JavaScript files
   - For documentation: `globs: *.md`
   - For test files: `globs: *.{test,spec}.{ts,js}`

8. **Write Effective Model Decision Descriptions**

   - Be specific about when the rule should be applied
   - Include key functionality or tools in the description
   - Format as: "Apply when working with [specific functionality]"

## Maintenance Guidelines

1. **Regular Review and Updates**

   - Review rules quarterly for accuracy and relevance
   - Update "Last Updated" dates when changes are made
   - Remove outdated or redundant rules

2. **Version Control**

   - Document significant rule changes in commit messages
   - Use the implementation status notation in filenames
   - Maintain a changelog for major rule updates

3. **Testing New Rules**

   - Verify rule activation with different file types
   - Test context size with various rule combinations
   - Ensure critical rules are always available

## Implementation Status Notation

Use the following notation in filenames to indicate implementation status:

- [0/4]: Not Started
- [1/4]: Initial Implementation
- [2/4]: Partial Implementation
- [3/4]: Near Completion
- [4/4]: Fully Implemented

## Last Updated: 2025-05-26
