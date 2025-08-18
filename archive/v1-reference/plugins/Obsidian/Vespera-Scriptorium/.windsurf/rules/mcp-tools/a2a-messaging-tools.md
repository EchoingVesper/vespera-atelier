---
trigger: model_decision
description: "Apply when working with A2A messaging architecture and components"
---

# A2A Messaging Tools Guide

## Overview

This guide provides specific recommendations for which MCP tools to use when working on different aspects of the Vespera-Scriptorium A2A messaging architecture. It focuses on the tools that are most relevant for developing, testing, and documenting the NATS-based messaging system.

## Message Development and Testing

### 1. Publishing and Subscribing to Messages

When developing and testing basic message publishing and subscription:

- **Primary Tool**: `nats_publish` and `nats_subscribe`
  - Use for testing message handlers in `NatsClient.ts`
  - Verify message delivery between components
  - Example: `nats_publish({ subject: "system.heartbeat", payload: JSON.stringify(heartbeatPayload) })`

- **Supporting Tool**: `memory.create_entities`
  - Document message types and their relationships
  - Example: `create_entities({ entities: [{ name: "HeartbeatMessage", entityType: "MessageType", observations: ["Used for service health monitoring"] }] })`

### 2. Request-Reply Patterns

When implementing and testing request-reply messaging patterns:

- **Primary Tool**: `nats_request`
  - Test service discovery mechanisms in `ServiceManager.ts`
  - Verify task delegation in `TaskManager.ts`
  - Example: `nats_request({ subject: "service.discovery", payload: JSON.stringify(discoveryRequest), timeout: 2000 })`

- **Supporting Tool**: `github.search_code`
  - Research best practices for request-reply patterns
  - Example: `search_code({ q: "language:typescript nats request reply pattern" })`

### 3. Persistent Messaging with JetStream

When working with persistent messaging using JetStream:

- **Primary Tools**: `nats_stream_create`, `nats_stream_publish`, `nats_consumer_create`
  - Set up persistent message streams for task tracking
  - Configure durable consumers for reliable message processing
  - Example: `nats_stream_create({ name: "TASKS", subjects: ["task.>"], retention: "limits", max_msgs: 10000 })`

- **Supporting Tool**: `puppeteer_screenshot`
  - Document JetStream configuration through the NATS dashboard
  - Example: `puppeteer_screenshot({ name: "jetstream-configuration" })`

## Component Development

### 1. NatsClient Component

When working on the `NatsClient.ts` component:

- **Primary Tools**: `nats_publish`, `nats_subscribe`
  - Test connection management functionality
  - Verify message transport capabilities
  - Example: `nats_publish({ subject: "test", payload: JSON.stringify({ test: true }) })`

- **Supporting Tool**: `memory.create_relations`
  - Document the client's relationships with other components
  - Example: `create_relations({ relations: [{ from: "NatsClient", to: "ServiceManager", relationType: "provides transport for" }] })`

### 2. ServiceManager Component

When working on the `ServiceManager.ts` component:

- **Primary Tools**: `nats_publish` (with system messages)
  - Test service registration and discovery
  - Verify health monitoring capabilities
  - Example: `nats_publish({ subject: "system.register", payload: JSON.stringify(registrationPayload) })`

- **Supporting Tool**: `github.get_file_contents`
  - Research service discovery patterns in other projects
  - Example: `get_file_contents({ owner: "nats-io", repo: "nats.js", path: "examples/service-discovery.js" })`

### 3. TaskManager Component

When working on the `TaskManager.ts` component:

- **Primary Tools**: `nats_stream_publish`, `nats_consumer_create`
  - Test task creation, delegation, and tracking
  - Verify task completion and failure handling
  - Example: `nats_stream_publish({ stream: "TASKS", subject: "task.create", payload: JSON.stringify(taskPayload) })`

- **Supporting Tool**: `memory.read_graph`
  - Understand task relationships and dependencies
  - Example: `read_graph()`

## Documentation and Research

### 1. Architecture Documentation

When documenting the A2A messaging architecture:

- **Primary Tool**: `memory.create_entities` and `memory.create_relations`
  - Build a comprehensive knowledge graph of the messaging system
  - Document component interactions and message flows
  - Example: `create_entities({ entities: [{ name: "MessageBroker", entityType: "Component", observations: ["Central NATS server for message routing"] }] })`

- **Supporting Tool**: `puppeteer_screenshot`
  - Capture visual representations of the architecture
  - Example: `puppeteer_screenshot({ name: "a2a-architecture-diagram" })`

### 2. Message Flow Research

When researching message flow patterns:

- **Primary Tool**: `github.search_code`
  - Find examples of message flow implementations
  - Research error handling patterns
  - Example: `search_code({ q: "language:typescript nats error handling" })`

- **Supporting Tool**: `brave_web_search`
  - Research best practices for event-driven architectures
  - Example: `brave_web_search({ query: "NATS JetStream best practices" })`

## Last Updated: 2025-05-25
