# Vespera Scriptorium - Protocol-Based Architecture (Phase 1.0)

**Last Updated:** 2025-05-24

## Overview

This directory contains the documentation and implementation details for the protocol-based refactoring of the Vespera Scriptorium's Information Extraction and Organization Module. This refactoring aims to simplify the architecture by leveraging three key protocols:

1. **Model Context Protocol (MCP)** - For standardized AI-to-data connections
2. **Agent-to-Agent Protocol (A2A)** - For agent communication and task delegation
3. **Agent User Interaction Protocol (AG-UI)** - For real-time user-agent interaction

## Directory Structure

```directory-structure
phase-1.0-protocol-based-architecture/
├── protocol-integration/     # Protocol implementation details
│   ├── mcp-configuration/     # MCP server and client configurations
│   ├── a2a-setup/            # A2A protocol implementation
│   └── agui-implementation/   # AG-UI components and integration
├── agent-definitions/         # Agent specifications and implementations
│   ├── ingestion-agent/      # Handles document input and chunking
│   ├── processing-agent/      # Manages data processing pipeline
│   ├── llm-agent/            # Handles LLM interactions
│   ├── output-agent/         # Manages final output generation
│   └── orchestration-agent/   # Coordinates workflow between agents
└── docs/                      # Additional documentation
```

## Key Benefits

- **Reduced Complexity**: Eliminates custom orchestration code in favor of standardized protocols
- **Enhanced Capabilities**: Leverages protocol ecosystems for advanced features
- **Improved Maintainability**: Clear separation of concerns and standardized interfaces
- **Future-Proof**: Easier to adopt new protocol features and updates

## Getting Started

1. Review the protocol integration guides in the `protocol-integration` directory
2. Explore agent definitions to understand their roles and responsibilities
3. Check the documentation for implementation details and examples

## Next Steps

1. Set up MCP servers for data access
2. Implement A2A agent communication
3. Integrate AG-UI for real-time interaction
4. Migrate existing functionality to the new architecture
