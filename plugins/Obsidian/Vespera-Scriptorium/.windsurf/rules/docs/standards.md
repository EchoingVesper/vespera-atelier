---
trigger: glob
globs: *.md
---

# Documentation Standards Rules

## JSDoc Requirements

1. All public APIs must have JSDoc comments
2. Include descriptions for all parameters and return values
3. Document exceptions and errors that may be thrown
4. Provide usage examples for complex functions
5. Use `@link` tags to reference related components

```typescript
/**
 * Sends a message through the NATS client
 * 
 * @param message - The message to send
 * @param subject - The subject to publish to
 * @param options - Optional publishing options
 * @returns A promise that resolves when the message is published
 * @throws {NatsConnectionError} If the NATS connection is not established
 * 
 * @example
 * await natsClient.sendMessage({ type: MessageType.HEARTBEAT, payload });
 */
```

## Markdown Formatting

1. Use explicit numbering in ordered lists (1, 2, 3 instead of 1, 1, 1)
2. Adhere to the line length limit of 120 characters (excluding code blocks and tables)
3. Include "Last Updated" dates in documentation files
4. Use consistent header levels (# for title, ## for sections, ### for subsections)
5. Use code blocks with appropriate language tags for all code examples

## Component Documentation

1. Each component should have its own README.md
2. Document the component's purpose and responsibilities
3. List key interfaces and methods
4. Provide usage examples
5. Explain integration with other components

## Last Updated: 2025-05-25
