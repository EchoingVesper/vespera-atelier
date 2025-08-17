---
trigger: glob
globs: *.{ts,js}
---

# Type Safety Rules

## Interface Definitions

1. All message types must have proper TypeScript interfaces
2. Define clear, descriptive interfaces for all data structures
3. Use specific types rather than `any` whenever possible
4. Extend base interfaces for related message types to ensure consistency

## Type Guards

1. Implement type guards for runtime type checking of all message types
2. Follow the established pattern for type guards:

```typescript
export function isTaskMessage(msg: Message): msg is Message<BaseTaskPayload> {
  return (
    msg.type === MessageType.TASK_CREATE ||
    msg.type === MessageType.TASK_UPDATE ||
    msg.type === MessageType.TASK_COMPLETE ||
    msg.type === MessageType.TASK_FAIL
  );
}
```

1. Use type guards before accessing message-specific properties
2. Export type guards for use across the codebase

## Error Handling

1. Use the `ErrorPayload` interface for all error messages
2. Include detailed error information:
   - Error code
   - Error message
   - Source component
   - Timestamp
   - Severity level
   - Whether the error is retryable
3. Implement proper error propagation through the messaging system
4. Use typed error classes that extend Error for specific error types

## Last Updated: 2025-05-25
