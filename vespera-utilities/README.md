# Vespera Utilities

A modular, plugin-based MCP (Model Context Protocol) server providing various utility tools for AI assistants.

## Overview

Vespera Utilities is designed with extensibility in mind, featuring a plugin architecture that allows easy addition of new tools and capabilities. The initial release includes a comprehensive calculator plugin with plans for expansion.

## Features

- **Plugin-Based Architecture**: Modular design for easy extension
- **MCP Protocol Support**: Full compatibility with Model Context Protocol
- **Calculator Plugin**: Advanced mathematical operations
- **Type-Safe**: Built with TypeScript for reliability
- **Configurable**: Flexible configuration system
- **Well-Tested**: Comprehensive test coverage

## Installation

```bash
npm install
npm run build
```

## Usage

### Starting the Server

```bash
npm start
```

### Configuration

Edit `config/default.json` to customize server settings and enable/disable plugins.

## Plugin Development

See [docs/plugin-development.md](docs/plugin-development.md) for creating custom plugins.

## Architecture

The project follows a modular architecture with clear separation of concerns:

- **Core**: MCP server implementation and plugin management
- **Plugins**: Self-contained utility modules
- **Interfaces**: Shared contracts and types
- **Utils**: Common utilities and helpers

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT