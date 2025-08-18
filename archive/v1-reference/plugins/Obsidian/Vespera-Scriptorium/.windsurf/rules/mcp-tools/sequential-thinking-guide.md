---
trigger: model_decision
description: "Apply when designing message flows or troubleshooting messaging issues"
---

# Sequential Thinking for A2A Messaging

## When to Use

Use Sequential Thinking MCP when:

1. Designing new message flows
2. Troubleshooting complex messaging issues
3. Planning refactoring of messaging components
4. Designing service discovery mechanisms

## Step-by-Step Approach

### 1. Message Flow Design

When designing a new message flow:

1. **Define Message Purpose**
   - What information needs to be communicated?
   - Which components need to exchange this information?

2. **Design Message Structure**
   - What fields are required in the payload?
   - What metadata is needed in headers?

3. **Map Message Routing**
   - Which subjects will be used?
   - Is this a publish/subscribe or request/reply pattern?

4. **Handle Error Cases**
   - What happens if the message fails to deliver?
   - How will timeouts be handled?

5. **Implement Type Safety**
   - Create TypeScript interfaces for the message payload
   - Implement type guards for runtime validation

## Example: Task Delegation Flow

```typescript
1. Define the task delegation requirements
2. Design TaskRequestPayload and TaskAssignPayload interfaces
3. Implement publish/subscribe pattern on "task.request" subject
4. Add error handling for service unavailability
5. Create isTaskRequestMessage and isTaskAssignMessage type guards
```

## Last Updated: 2025-05-25## Last Updated: 2025-05-25
