# Vespera Scriptorium Developer Documentation

Welcome to the Vespera Scriptorium developer documentation! This section provides technical information for developers who want to understand, modify, or contribute to the Vespera Scriptorium project.

A key focus of the current development is the implementation of a robust, n8n-inspired document processing pipeline. This new architecture aims to provide a flexible and extensible framework for handling various document processing tasks within the plugin.

## Documentation Structure

The developer documentation is organized into the following sections:

- [Architecture](architecture/README.md) - High-level design and architecture documentation, including details on the new [Robust Document Processing System](architecture/RobustDocumentProcessingSystem.md).
  - [Product Requirements Document (PRD)](architecture/PRD.md)
  - [Feature Requirements Table (FRT)](architecture/FRT.md)
  - [Module Roadmap](architecture/Module-Roadmap.md)

- [Implementation](implementation/README.md) - Implementation details and guidelines, including the [Implementation Plan](implementation/ImplementationPlan.md) for the new processing pipeline.
  - [Implementation Plan](implementation/ImplementationPlan.md)

- [Modules](modules/README.md) - Documentation for individual modules, detailing their roles, especially within the new processing pipeline.
  - [Chunker](modules/Chunker.md) - Responsible for breaking down documents into manageable chunks for processing.
  - [FileManager](modules/FileManager.md) - Handles file system interactions.
  - [LLMClient](modules/LLMClient.md) - Manages communication with Language Model clients.
  - [Parser](modules/Parser.md) - Extracts structured information from document content.
  - [PromptTemplateManager](modules/PromptTemplateManager.md) - Manages prompt templates used by the LLMClient.
  - [UI](modules/UI.md) - User interface components.
  - [Writer](modules/Writer.md) - Handles writing processed content back to files or other outputs.

- [UI](ui/README.md) - User interface components and design
  - [MultiSelectModal Specification](ui/MultiSelectModal_spec.md)

- [Tracking](tracking/README.md) - Project progress tracking and milestones

## Getting Started with Development

### Prerequisites

To develop for Vespera Scriptorium, you'll need:

- Node.js and npm
- Git
- A code editor (VS Code recommended)
- Obsidian for testing

### Setting Up the Development Environment

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/vespera-scriptorium.git
   ```

2. Install dependencies:
   ```
   cd vespera-scriptorium
   npm install
   ```

3. Build the plugin:
   ```
   npm run build
   ```

4. For development with hot-reload:
   ```
   npm run dev
   ```

### Project Structure

- `src/` - Source code
  - `main.ts` - Plugin entry point
  - Module implementation files (Chunker.ts, FileManager.ts, etc.)
  - `processing/` - Core processing logic
  - `robust-processing/` - Implementation of the new n8n-inspired processing pipeline components.
  - `providers/` - LLM provider implementations
  - `templates/` - Prompt template management
  - `UI/` - User interface components
  - `types/` - TypeScript type definitions

- `tests/` - Test files
  - `unit/` - Unit tests
  - `ui/` - UI tests
  - `mocks/` - Mock implementations for testing

- `docs/` - Documentation

### Coding Standards

- Use TypeScript for all code
- Follow the existing code style and formatting
- Write unit tests for new functionality
- Document public APIs and complex logic
- Use meaningful commit messages

## Contributing

We welcome contributions to Vespera Scriptorium! Please see our [Contributing Guidelines](https://github.com/yourusername/vespera-scriptorium/blob/main/CONTRIBUTING.md) for more information.

## Building and Testing

### Building the Plugin

```
npm run build
```

### Running Tests

```
npm run test
```

### Linting

```
npm run lint
```

## Release Process

1. Update version number in `manifest.json` and `versions.json`
2. Update changelog
3. Build the plugin
4. Create a new release on GitHub
5. Upload the built plugin files

## Additional Resources

- [Obsidian Plugin API Documentation](https://github.com/obsidianmd/obsidian-api)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vespera Scriptorium User Documentation](../README.md)