# Task Artifact: architect_39146d

**Type:** design
**Created:** 2025-06-06 10:19:36 UTC
**Summary:** Designed modular plugin-based architecture for Vespera Utilities MCP server

## Detailed Work

## Vespera Utilities Architecture Design

### Project Overview
Vespera Utilities is a modular, plugin-based MCP server designed for extensibility and maintainability. The architecture supports dynamic plugin loading with a calculator as the initial plugin.

### Core Architecture Principles

1. **Plugin-Based Architecture**
   - Each utility is a self-contained plugin
   - Plugins follow a standard interface
   - Hot-loading/unloading capability
   - Isolated plugin contexts

2. **Separation of Concerns**
   - Core server logic separate from plugins
   - Clear boundaries between layers
   - Dependency injection for extensibility

3. **File Size Constraints**
   - All files limited to <500 lines
   - Modular design to enforce small, focused modules
   - Clear single responsibility per file

### Directory Structure

```
vespera-utilities/
├── src/
│   ├── core/                    # Core server functionality
│   │   ├── server.ts           # Main MCP server setup (<200 lines)
│   │   ├── plugin-manager.ts   # Plugin loading/lifecycle (<300 lines)
│   │   ├── plugin-registry.ts  # Plugin registration (<150 lines)
│   │   └── types.ts            # Core type definitions (<100 lines)
│   │
│   ├── interfaces/             # Shared interfaces
│   │   ├── plugin.interface.ts # Plugin contract (<50 lines)
│   │   ├── config.interface.ts # Configuration types (<50 lines)
│   │   └── index.ts           # Export aggregator
│   │
│   ├── plugins/               # Plugin implementations
│   │   └── calculator/        # Calculator plugin
│   │       ├── index.ts       # Plugin entry point (<100 lines)
│   │       ├── calculator.ts  # Core logic (<200 lines)
│   │       ├── operations.ts  # Math operations (<150 lines)
│   │       ├── types.ts       # Plugin-specific types
│   │       └── plugin.json    # Plugin manifest
│   │
│   ├── utils/                 # Shared utilities
│   │   ├── logger.ts          # Logging utility (<100 lines)
│   │   ├── validator.ts       # Schema validation (<100 lines)
│   │   └── errors.ts          # Error types (<50 lines)
│   │
│   └── index.ts              # Main entry point (<50 lines)
│
├── config/                    # Configuration files
│   ├── default.json          # Default configuration
│   └── plugins.json          # Plugin configuration
│
├── tests/                    # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .task_orchestrator/       # Task orchestrator artifacts
│   └── artifacts/
│
├── docs/                     # Documentation
├── scripts/                  # Build and utility scripts
├── CLAUDE.md                # Claude AI assistance guide
├── package.json
├── tsconfig.json
├── .gitignore
├── .eslintrc.json
└── README.md
```

### Core Components Design

#### 1. Plugin Interface
```typescript
interface VesperaPlugin {
  metadata: PluginMetadata;
  initialize(context: PluginContext): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  destroy(): Promise<void>;
}

interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  dependencies?: string[];
  capabilities: PluginCapabilities;
}

interface PluginCapabilities {
  tools?: ToolDefinition[];
  resources?: ResourceDefinition[];
  prompts?: PromptDefinition[];
}

interface PluginContext {
  logger: Logger;
  config: PluginConfig;
  registerTool: (tool: McpTool) => void;
  registerResource: (resource: McpResource) => void;
  registerPrompt: (prompt: McpPrompt) => void;
}
```

#### 2. Plugin Manager
- Handles plugin discovery and loading
- Manages plugin lifecycle
- Dependency resolution
- Error isolation and recovery

#### 3. MCP Server Integration
- Wraps McpServer from @modelcontextprotocol/sdk
- Delegates tool/resource/prompt registration to plugins
- Handles transport layer (Streamable HTTP)
- Session management

#### 4. Configuration System
```typescript
interface ServerConfig {
  server: {
    name: string;
    version: string;
    port: number;
    transport: 'streamable-http' | 'stdio';
  };
  plugins: {
    enabled: string[];
    directory: string;
    autoload: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'pretty';
  };
}
```

### Calculator Plugin Design

#### Structure
- Entry point exports plugin class
- Separate files for operations (basic, scientific, etc.)
- Type-safe operation definitions
- Comprehensive error handling

#### MCP Tools Exposed
1. `calculate` - Basic arithmetic operations
2. `evaluate` - Expression evaluation
3. `convert` - Unit conversions
4. `stats` - Statistical calculations

### Technical Stack

- **Language**: TypeScript 5.x
- **Runtime**: Node.js 20+
- **MCP SDK**: @modelcontextprotocol/sdk
- **Schema Validation**: Zod
- **Testing**: Jest
- **Linting**: ESLint
- **Build**: TSC + ESBuild
- **Package Manager**: npm

### Security Considerations

1. Plugin isolation
2. Input validation on all tools
3. Resource access controls
4. No eval() or dynamic code execution
5. Sanitized error messages

### Performance Considerations

1. Lazy plugin loading
2. Efficient plugin discovery
3. Minimal overhead for inactive plugins
4. Caching for frequently used operations

### Future Extensibility

The architecture supports:
- Additional plugins (file utilities, text processing, etc.)
- Multiple transport layers
- Plugin marketplace concepts
- Remote plugin loading
- Plugin sandboxing

---

*This artifact was generated by the MCP Task Orchestrator on 2025-06-06 10:19:36 UTC*
*Task ID: architect_39146d*