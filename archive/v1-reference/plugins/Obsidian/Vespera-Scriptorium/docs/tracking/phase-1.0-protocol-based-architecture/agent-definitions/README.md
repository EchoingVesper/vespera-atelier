# Agent Definitions

**Last Updated:** 2025-05-24

This directory contains the specifications and implementation details for the agents that make up the Vespera Scriptorium's protocol-based architecture. Each agent is designed to handle specific responsibilities and communicate using the A2A protocol.

## Agent Architecture

### 1. Ingestion Agent

- **Purpose**: Handles document input and chunking
- **Responsibilities**:
  - Accept document inputs
  - Chunk documents into processable units
  - Validate input formats
  - Route documents to processing pipeline

### 2. Processing Agent

- **Purpose**: Manages the data processing pipeline
- **Responsibilities**:
  - Coordinate processing stages
  - Manage data transformation
  - Handle intermediate storage
  - Ensure data consistency

### 3. LLM Agent

- **Purpose**: Handles interactions with Large Language Models
- **Responsibilities**:
  - Manage LLM provider integration
  - Handle prompt construction
  - Process LLM responses
  - Implement retry and fallback logic

### 4. Output Agent

- **Purpose**: Manages final output generation
- **Responsibilities**:
  - Format processed data
  - Generate output files
  - Handle export formats
  - Manage output destinations

### 5. Orchestration Agent

- **Purpose**: Coordinates workflow between agents
- **Responsibilities**:
  - Manage workflow state
  - Route tasks between agents
  - Handle errors and retries
  - Provide system observability

## Agent Communication

Agents communicate using the A2A protocol, which provides:

- Message passing between agents
- Service discovery
- Task delegation
- Error handling
- State management

## Implementation Status

| Agent             | Status      | Next Steps |
|-------------------|-------------|------------|
| Ingestion Agent   | Not Started | Define API |
| Processing Agent  | Not Started | Design pipeline |
| LLM Agent        | Not Started | Integrate MCP |
| Output Agent      | Not Started | Define formats |
| Orchestration Agent| Not Started | Design workflows |

## Getting Started

1. Review agent specifications
2. Implement agent interfaces
3. Set up A2A communication
4. Test agent interactions
