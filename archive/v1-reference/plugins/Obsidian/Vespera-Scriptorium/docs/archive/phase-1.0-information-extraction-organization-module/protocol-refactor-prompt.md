# Protocol-Based Architecture Refactor Prompt

## Background Context

The current Vespera Scriptorium Phase 1.0 Information Extraction and Organization Module represents an **implicit agent-to-agent framework** with complex custom orchestration, workflow management, and inter-component communication. After analysis, it's clear that adopting three emerging AI protocols can significantly simplify this architecture while providing enhanced capabilities:

1. **Model Context Protocol (MCP)** - Standardizes AI-to-data connections
2. **Agent-to-Agent Protocol (A2A)** - Enables agent communication and task delegation
3. **Agent User Interaction Protocol (AG-UI)** - Standardizes real-time user-agent interaction

## Current Architecture Analysis

The existing module structure includes:

- **Workflow Orchestrator** with complex state management, execution engines, and node coordinators
- **Custom agent-like components**: Ingestion, Processing Stages, Extraction, Classification, Output
- **File-Based Queues** for inter-component communication
- **Custom LLM integration** with provider-specific implementations
- **Basic UI** with limited real-time interaction capabilities

This architecture essentially recreates what these protocols standardize, but with custom implementations that require significant maintenance overhead.

## Refactoring Request

Please analyze the current documentation structure in this directory (`/phase-1.0-information-extraction-organization-module/`) and its subdirectories, then restructure the entire documentation to reflect a **protocol-based architecture** that:

### 1. **Replace Complex Workflow Orchestrator with A2A Agent Communication**

- Convert the current Workflow Orchestrator, State Manager, Node Executor, and Concurrency Manager into simple A2A agent definitions
- Each processing stage (Ingestion, Extraction, Classification, Output) becomes an independent A2A agent
- Replace custom workflow definitions with A2A agent capability discovery and task delegation
- Eliminate the need for complex state management by using A2A's built-in task lifecycle management

### 2. **Simplify Data Access with MCP Integration**

- Replace custom file handling and data source management with MCP client implementations
- Convert the current LLMClient complexity into MCP-enhanced providers
- Eliminate custom connector development by using community MCP servers
- Replace File-Based Queues with MCP resource management where appropriate

### 3. **Enhance User Experience with AG-UI**

- Replace basic progress tracking with real-time AG-UI event streams
- Convert batch processing notifications into interactive user experiences
- Enable human-in-the-loop workflows for content review and refinement
- Add real-time collaboration capabilities for document processing

### 4. **Identify Simplifications and Eliminations**

- **Document what components can be eliminated** entirely due to protocol standardization
- **Identify reduced complexity** in remaining components
- **Highlight where community resources** (MCP servers, A2A agents) replace custom development
- **Map current feature requirements** to protocol-native capabilities

### 5. **Update Documentation Structure**

Please restructure the documentation to reflect:

#### **New Architecture Sections:**

- `protocol-integration/` - How MCP, A2A, and AG-UI integrate with Obsidian
- `agent-definitions/` - A2A agent specifications for each processing component
- `mcp-configuration/` - MCP server configurations and resource mappings
- `agui-interactions/` - User interaction patterns and real-time capabilities

#### **Simplified Feature Areas:**

- Convert complex workflow components into simple agent interaction patterns
- Replace custom orchestration docs with A2A communication flows
- Update implementation complexity estimates (should be significantly reduced)
- Add protocol compatibility and ecosystem integration benefits

#### **Implementation Roadmap Updates:**

- Phase 1: MCP integration for data access simplification
- Phase 2: A2A agent conversion for workflow simplification  
- Phase 3: AG-UI implementation for enhanced user experience
- Phase 4: Community integration and ecosystem expansion

### 6. **Specific Documentation Updates Needed:**

1. **Rewrite README.md** to reflect protocol-based approach and simplified architecture
2. **Update module-components-overview.md** to show dramatically reduced complexity
3. **Restructure features/** to focus on agent capabilities rather than monolithic components
4. **Add protocol-specific implementation guides** and configuration documentation
5. **Include ecosystem integration benefits** and community resource utilization
6. **Update effort estimates** to reflect simplified implementation (should be 60-80% reduction)

### 7. **Key Questions to Address in Restructured Docs:**

- How does each A2A agent replace current workflow components?
- Which MCP servers eliminate the need for custom data connectors?
- How does AG-UI enable capabilities not possible with current UI?
- What custom code can be eliminated entirely?
- How does protocol adoption future-proof the plugin architecture?
- What community resources become available through protocol adoption?

## Expected Outcome

The restructured documentation should demonstrate that adopting these protocols transforms a complex, custom-built implicit agent framework into a simple, standards-based, community-supported architecture that:

- **Reduces development effort by 60-80%**
- **Eliminates custom orchestration complexity**
- **Provides enhanced capabilities through protocol ecosystems**
- **Future-proofs the plugin architecture**
- **Enables community integration and resource sharing**

Please maintain all current feature requirements while showing how protocols provide simpler, more powerful implementation paths. Focus on the **dramatic simplification** these protocols enable while **expanding capabilities** beyond what the current custom approach could achieve.
