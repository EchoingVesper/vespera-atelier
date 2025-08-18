---
trigger: model_decision
description: "Apply when researching APIs and implementation patterns for the A2A messaging architecture"
---

# Context7 Tools

## Overview

The Context7 MCP Server provides access to documentation for libraries and frameworks, which is valuable for researching APIs and implementation patterns for the Vespera-Scriptorium A2A messaging architecture.

## Available Tools

### Documentation Access

- **`resolve-library-id`**: Find the correct library identifier
  - Use before accessing library documentation
  - Resolves package/product names to Context7-compatible IDs
  - Example: `resolve_library_id({ libraryName: "nats.js" })`

- **`get-library-docs`**: Fetch documentation for a specific library
  - Use for accessing official documentation
  - Provides up-to-date information on APIs and usage
  - Example:

  ```javascript
  get_library_docs({
    context7CompatibleLibraryID: "/nats-io/nats.js",
    userQuery: "How to create a JetStream consumer"
  });
  ```

## Best Practices

1. **Documentation Research**:
   - Use for accessing official NATS.js documentation
   - Research TypeScript interface definitions
   - Understand message broker configuration options
   - Find examples of event-driven patterns

2. **API Integration**:
   - Look up method signatures and parameters
   - Find usage examples for NATS client methods
   - Research error handling patterns
   - Understand authentication and security options

3. **A2A Messaging Research**:
   - Research message flow patterns
   - Find examples of service discovery implementations
   - Understand JetStream configuration options
   - Learn about message acknowledgment patterns

## Last Updated: 2025-05-25
