---
trigger: model_decision
description: "Apply when working with NATS messaging functionality or testing message flows"
---

# NATS MCP Server Tools

## Overview

The NATS MCP Server provides direct integration with the NATS messaging system, which is the foundation of the Vespera-Scriptorium A2A communication layer. These tools enable AI assistants to interact directly with NATS for testing, monitoring, and development.

## Available Tools

### Message Publishing and Subscription

- **`nats_publish`**: Publish messages to NATS subjects
  - Use for sending messages to the A2A communication layer
  - Essential for testing message handlers and event listeners
  - Example: `nats_publish({ subject: "system.heartbeat", payload: JSON.stringify(heartbeatPayload) })`

- **`nats_subscribe`**: Subscribe to NATS subjects
  - Use for monitoring message flows in real-time
  - Helpful for debugging communication issues
  - Example: `nats_subscribe({ subject: "system.>" })`

- **`nats_request`**: Send request-reply pattern messages
  - Use for testing service discovery and task delegation
  - Implements the request-reply pattern in NATS
  - Example: `nats_request({ subject: "service.discovery", payload: JSON.stringify(discoveryRequest), timeout: 2000 })`

### JetStream Operations

- **`nats_stream_create`**: Create JetStream streams
  - Use for setting up persistent message streams
  - Configure retention policies and storage options
  - Example: `nats_stream_create({ name: "TASKS", subjects: ["task.>"], retention: "limits", max_msgs: 10000 })`

- **`nats_stream_info`**: Get information about streams
  - Use for monitoring stream health and configuration
  - Check message counts and consumer information
  - Example: `nats_stream_info({ stream: "TASKS" })`

- **`nats_consumer_create`**: Create durable consumers
  - Use for setting up message processing pipelines
  - Configure acknowledgment policies and delivery options
  - Example: `nats_consumer_create({ stream: "TASKS", durable: "task-processor", filter_subject: "task.create" })`

- **`nats_consumer_info`**: Get consumer information
  - Use for monitoring consumer health and performance
  - Check message delivery statistics
  - Example: `nats_consumer_info({ stream: "TASKS", consumer: "task-processor" })`

- **`nats_stream_publish`**: Publish to JetStream
  - Use for sending persistent messages
  - Ensures message delivery with acknowledgments
  - Example: `nats_stream_publish({ stream: "TASKS", subject: "task.create", payload: JSON.stringify(taskPayload) })`

- **`nats_stream_get`**: Get messages from streams
  - Use for retrieving historical messages
  - Access messages by sequence number
  - Example: `nats_stream_get({ stream: "TASKS", seq: 42 })`

- **`nats_kv_operations`**: Interact with NATS Key-Value store
  - Use for distributed configuration and state management
  - Provides atomic operations for key-value pairs
  - Example: `nats_kv_operations({ bucket: "config", operation: "put", key: "service.timeout", value: "5000" })`

## Best Practices

1. **Message Structure**:
   - Always use the standard Message interface from `types.ts`
   - Include proper headers with correlationId, messageId, and source
   - Use appropriate MessageType enum values

2. **Error Handling**:
   - Implement timeout handling for all NATS operations
   - Use try-catch blocks to handle connection issues
   - Check acknowledgments for JetStream operations

3. **Performance Considerations**:
   - Use queue groups for load balancing when appropriate
   - Implement backpressure mechanisms for high-volume flows
   - Consider message size limits (default 1MB in NATS)

4. **Testing Workflow**:
   - Start with simple publish/subscribe tests
   - Progress to request-reply pattern tests
   - Finally test JetStream persistence and delivery guarantees

## Integration with A2A Architecture

The NATS MCP tools integrate directly with the A2A messaging components:

- Use with `NatsClient.ts` for testing connection management
- Test service discovery mechanisms in `ServiceManager.ts`
- Verify task delegation flows in `TaskManager.ts`
- Test distributed storage operations in `StorageManager.ts`

## Last Updated: 2025-05-25
