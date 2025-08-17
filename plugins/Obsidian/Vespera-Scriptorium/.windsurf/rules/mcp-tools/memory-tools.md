---
trigger: model_decision
description: "Apply when working with knowledge graph tracking for A2A components"
---

# Memory MCP Server Tools

## Overview

The Memory MCP Server provides a knowledge graph-based persistent memory system that is particularly valuable for tracking relationships between components in the Vespera-Scriptorium A2A messaging architecture.

## Available Tools

### Entity Management

- **`create_entities`**: Create new entities in the knowledge graph
  - Use for documenting messaging components and concepts
  - Create representations of services, message types, and flows
  - Example: `create_entities({ entities: [{ name: "NatsClient", entityType: "Component", observations: ["Handles connection management"] }] })`

- **`add_observations`**: Add new observations to existing entities
  - Use for updating component documentation
  - Add new capabilities or behaviors to existing components
  - Example: `add_observations({ observations: [{ entityName: "NatsClient", contents: ["Implements reconnection logic"] }] })`

- **`delete_entities`**: Remove entities from the knowledge graph
  - Use for removing deprecated components
  - Clean up outdated architectural concepts
  - Example: `delete_entities({ entityNames: ["DeprecatedService"] })`

- **`delete_observations`**: Remove specific observations from entities
  - Use for correcting inaccurate information
  - Update component documentation
  - Example: `delete_observations({ deletions: [{ entityName: "NatsClient", observations: ["Incorrect behavior"] }] })`

### Relationship Management

- **`create_relations`**: Create relationships between entities
  - Use for documenting component interactions
  - Map message flows between services
  - Example: `create_relations({ relations: [{ from: "NatsClient", to: "ServiceManager", relationType: "provides transport for" }] })`

- **`delete_relations`**: Remove relationships from the knowledge graph
  - Use for updating architectural relationships
  - Correct inaccurate component interactions
  - Example: `delete_relations({ relations: [{ from: "ServiceA", to: "ServiceB", relationType: "depends on" }] })`

### Knowledge Graph Navigation

- **`open_nodes`**: Retrieve specific entities by name
  - Use for examining specific components in detail
  - Access documentation for particular services
  - Example: `open_nodes({ names: ["NatsClient", "ServiceManager"] })`

- **`read_graph`**: View the entire knowledge graph
  - Use for understanding the complete A2A architecture
  - Visualize all component relationships
  - Example: `read_graph()`

- **`search_nodes`**: Find entities based on a query
  - Use for locating components by functionality
  - Search for specific message handling patterns
  - Example: `search_nodes({ query: "message validation" })`

## Best Practices

1. **Entity Organization**:
   - Create separate entities for each major component
   - Use consistent entity types (Component, Service, MessageType, etc.)
   - Include detailed observations with implementation details

2. **Relationship Documentation**:
   - Use descriptive relationship types
   - Document bidirectional relationships when appropriate
   - Capture dependencies and data flows

3. **Knowledge Management**:
   - Update the knowledge graph when architecture changes
   - Remove outdated information promptly
   - Use search to verify existing information before adding new entities

4. **Integration with Development Workflow**:
   - Document new components as they are created
   - Update relationships when interfaces change
   - Use the knowledge graph for onboarding new developers

## Integration with A2A Architecture

The Memory MCP tools enhance the A2A messaging architecture by:

- Providing a visual representation of the messaging system
- Documenting relationships between services and message types
- Tracking the evolution of the architecture over time
- Serving as a knowledge base for the development team

## Last Updated: 2025-05-25
