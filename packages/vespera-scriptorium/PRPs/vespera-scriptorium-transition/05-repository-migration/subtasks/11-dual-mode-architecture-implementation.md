# Dual-Mode Architecture Specification for Vespera Scriptorium

**Status**: [CURRENT] - Architecture refinement based on Claude Code pattern  
**Created**: 2025-08-15  
**Type**: Architectural Specification  

## Overview

Vespera Scriptorium follows the proven dual-mode architecture pattern established by Claude Code, enabling flexible deployment and consumption models.

## Architecture Modes

### Mode 1: Standalone MCP Server
**Use Case**: Integration with external MCP clients (Claude Desktop, Cursor, VS Code, etc.)

```bash
# Launch as MCP server
vespera-scriptorium --server --port 3000

# Or via node
node packages/vespera-scriptorium/dist/server.js

# MCP configuration for clients
{
  "servers": {
    "vespera-scriptorium": {
      "command": "vespera-scriptorium",
      "args": ["--server"]
    }
  }
}
```

**Features**:
- Full MCP protocol compliance
- Task orchestration tools
- Specialist role management
- Database persistence
- Clean Architecture patterns

### Mode 2: CLI Consumer
**Use Case**: Command-line automation, scripting, consuming other MCP servers

```bash
# Use as CLI tool
vespera-scriptorium plan-task --title "Example Task" --description "Test"

# Connect to other MCP servers
vespera-scriptorium query-tasks --mcp-server claude-code --filter "status:active"

# Local operations
vespera-scriptorium get-status --local
```

**Features**:
- Full CLI interface to orchestrator functionality
- Can consume other MCP servers as dependencies
- Scripting and automation support
- Local database operations

### Mode 3: Package Import
**Use Case**: Integration into applications (Obsidian plugin, custom GUIs)

```typescript
// Package import for applications
import { TaskOrchestrator, SpecialistType } from 'vespera-scriptorium';

// Embedded mode for Obsidian plugin
const orchestrator = new TaskOrchestrator({
  mode: 'embedded',
  database: path.join(obsidianVaultPath, '.vespera-scriptorium'),
  logLevel: 'info'
});

// Use orchestrator functionality
const task = await orchestrator.planTask({
  title: 'Document Analysis',
  description: 'Analyze vault structure',
  specialistType: SpecialistType.ANALYST
});
```

**Features**:
- Clean API for programmatic access
- Embedded database management
- Event-driven architecture
- TypeScript support

## Monorepo Integration Strategy

### Package Structure
```bash
vespera-atelier/
├── packages/
│   └── vespera-scriptorium/          # Core backend package
│       ├── src/
│       │   ├── cli/                  # CLI mode implementation
│       │   ├── server/               # MCP server mode
│       │   ├── lib/                  # Package import API
│       │   ├── domain/               # Clean Architecture: Domain layer
│       │   ├── application/          # Clean Architecture: Application layer
│       │   ├── infrastructure/       # Clean Architecture: Infrastructure layer
│       │   └── presentation/         # Clean Architecture: Presentation layer
│       ├── package.json              # "vespera-scriptorium"
│       ├── tsconfig.json
│       └── dist/                     # Compiled outputs
│           ├── cli.js                # CLI entry point
│           ├── server.js             # MCP server entry point
│           └── lib/                  # Package API exports
└── plugins/
    └── Obsidian/
        └── Vespera-Scriptorium/      # Frontend that imports vespera-scriptorium
            ├── src/
            │   ├── main.ts           # Plugin entry point
            │   ├── orchestrator/     # Integration with backend
            │   └── ui/               # Obsidian-specific UI
            └── package.json          # Depends on "vespera-scriptorium"
```

### Entry Points Configuration

**package.json**:
```json
{
  "name": "vespera-scriptorium",
  "version": "1.0.0",
  "main": "./dist/lib/index.js",
  "types": "./dist/lib/index.d.ts",
  "bin": {
    "vespera-scriptorium": "./dist/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/lib/index.js",
      "require": "./dist/lib/index.js",
      "types": "./dist/lib/index.d.ts"
    },
    "./server": {
      "import": "./dist/server.js",
      "require": "./dist/server.js"
    },
    "./cli": {
      "import": "./dist/cli.js",
      "require": "./dist/cli.js"
    }
  }
}
```

## Implementation Phases

### Phase 1: Package Migration (Week 1)
- [ ] Copy `mcp-task-orchestrator` to `packages/vespera-scriptorium/`
- [ ] Update package.json with correct name and exports
- [ ] Setup TypeScript build configuration
- [ ] Verify basic functionality in all three modes

### Phase 2: Mode Implementation (Week 2)
- [ ] Implement CLI mode with argument parsing
- [ ] Enhance MCP server mode for external clients
- [ ] Create clean API for package import mode
- [ ] Add comprehensive logging and error handling

### Phase 3: Integration Testing (Week 3)
- [ ] Test MCP server mode with Claude Desktop, Cursor
- [ ] Test CLI mode for automation scenarios
- [ ] Test package import with simple TypeScript application
- [ ] Performance benchmarking across all modes

### Phase 4: Obsidian Integration (Week 4)
- [ ] Rewrite Obsidian plugin to use vespera-scriptorium as backend
- [ ] Implement document processing integration
- [ ] Add Obsidian-specific UI enhancements
- [ ] Testing and documentation

## Benefits of Dual-Mode Architecture

### For Users
- **Flexibility**: Choose the interface that fits their workflow
- **Integration**: Works with existing tools (Obsidian, CLI scripts, MCP clients)
- **Performance**: Optimized for each use case
- **Consistency**: Same backend logic across all interfaces

### For Developers
- **Separation of Concerns**: Backend logic separated from UI concerns
- **Testability**: Each mode can be tested independently
- **Maintainability**: Single source of truth for orchestrator logic
- **Extensibility**: Easy to add new interfaces without changing core logic

### For Ecosystem
- **MCP Compliance**: Participates fully in MCP ecosystem
- **Tool Integration**: Works with any MCP-compatible client
- **Automation**: Supports scripting and workflow automation
- **Plugin Development**: Enables rich frontend development

## Success Criteria

### Technical Requirements
- [ ] All three modes functional and well-tested
- [ ] Consistent API across all modes
- [ ] Performance acceptable in all deployment scenarios
- [ ] Clean Architecture principles maintained

### Integration Requirements
- [ ] MCP clients can connect and use all tools
- [ ] CLI provides full functionality for automation
- [ ] Package import enables rich application development
- [ ] Obsidian plugin successfully uses backend

### Quality Requirements
- [ ] Comprehensive test coverage for all modes
- [ ] Clear documentation for each use case
- [ ] Performance benchmarks established
- [ ] Security considerations addressed

## References

- [Claude Code Architecture](https://docs.anthropic.com/en/docs/claude-code) - Reference implementation
- [MCP Protocol Specification](https://modelcontextprotocol.io/) - Protocol compliance
- [Clean Architecture Guide](../../mcp_task_orchestrator/CLAUDE.md) - Implementation patterns
- [Monorepo Analysis](../tracking/monorepo-analysis-artifacts.md) - Integration strategy

---

This specification ensures Vespera Scriptorium provides maximum flexibility while maintaining clean architecture and excellent user experience across all deployment modes.