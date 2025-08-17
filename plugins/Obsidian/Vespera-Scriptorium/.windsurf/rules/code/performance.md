---
trigger: glob
globs: *.{ts,js}
---

# Performance Considerations Rules

## Message Handling

1. Implement efficient message handling patterns
2. Use appropriate NATS subscription options for different message types
3. Implement backpressure mechanisms for high-volume message flows
4. Avoid blocking the event loop during message processing
5. Use queue groups for load balancing when appropriate

## Large Data Transfers

1. Use streaming patterns for large data transfers
2. Implement chunking for messages exceeding size limits
3. Include checksums for data integrity verification
4. Provide progress tracking for long-running transfers
5. Implement resumable transfers for reliability

## Event Listeners

1. Always remove event listeners when they are no longer needed
2. Use debouncing or throttling for high-frequency events
3. Keep event callback functions lightweight
4. Avoid memory leaks by properly managing listener references
5. Implement error handling in all event listeners

## Resource Management

1. Implement proper connection pooling for external services
2. Close connections and release resources when they are no longer needed
3. Use timeouts for all external requests
4. Implement circuit breakers for external dependencies
5. Monitor resource usage and implement appropriate limits

## Last Updated: 2025-05-25
