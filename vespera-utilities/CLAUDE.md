# Claude AI Development Guide for Vespera Utilities

This document provides guidance for Claude AI or other AI assistants working on the Vespera Utilities project.

## Project Overview

Vespera Utilities is a modular, plugin-based MCP (Model Context Protocol) server that provides various utility tools. The architecture is designed for extensibility, with each utility implemented as a self-contained plugin.

## Key Architecture Decisions

1. **Plugin-Based Design**: Each utility is a separate plugin with a standard interface
2. **File Size Limit**: All files must be under 500 lines to prevent Claude crashes
3. **TypeScript First**: Full type safety with strict TypeScript configuration
4. **Modular Structure**: Clear separation of concerns between core, plugins, and utilities

## Development Guidelines

### When Adding New Features

1. Check if it belongs in an existing plugin or needs a new one
2. Follow the plugin interface defined in `src/interfaces/plugin.interface.ts`
3. Keep individual files focused and under 500 lines
4. Use Zod for all external input validation
5. Write comprehensive tests for new functionality

### Code Style

- Use ESLint configuration (already set up)
- Follow existing patterns in the codebase
- Prefer composition over inheritance
- Use dependency injection where appropriate

### Testing

Run tests before committing:
```bash
npm test
npm run lint
npm run typecheck
```

### Common Tasks

#### Creating a New Plugin

1. Create directory under `src/plugins/[plugin-name]/`
2. Implement the `VesperaPlugin` interface
3. Add plugin configuration to `config/plugins.json`
4. Register tools/resources/prompts in the plugin
5. Write tests in `tests/unit/plugins/[plugin-name]/`

#### Adding MCP Tools

Tools should:
- Have clear, descriptive names
- Use Zod schemas for parameter validation
- Include comprehensive error handling
- Return consistent response formats

## Project Structure

```
src/
├── core/           # Core server and plugin system
├── interfaces/     # TypeScript interfaces
├── plugins/        # Plugin implementations
├── utils/          # Shared utilities
└── index.ts        # Entry point
```

## Important Files

- `src/interfaces/plugin.interface.ts` - Plugin contract
- `src/core/plugin-manager.ts` - Plugin lifecycle management
- `src/core/server.ts` - MCP server setup
- `config/default.json` - Server configuration

## Current Plugins

1. **Calculator** - Mathematical operations and calculations
   - Basic arithmetic
   - Expression evaluation
   - Unit conversions
   - Statistical functions

## Future Considerations

- Additional plugins can be added following the same pattern
- Consider plugin dependencies for complex interactions
- Maintain backwards compatibility when updating interfaces

## Known Constraints

- Node.js 20+ required
- ES modules used throughout
- MCP SDK version compatibility important
- File size limit of 500 lines is critical

## Debugging Tips

1. Use the `npm run dev` command for development with auto-reload
2. Check `.task_orchestrator/artifacts/` for task completion details
3. Enable debug logging in `config/default.json` for troubleshooting
4. MCP Inspector can be used for testing tools

## Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Zod Documentation](https://zod.dev/)