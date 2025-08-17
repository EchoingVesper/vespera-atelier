# Vespera Scriptorium

Vespera Scriptorium is an Obsidian plugin that provides AI-enhanced content management and creation tools. Starting with automatic summarization of mixed Vault content, it evolves into a comprehensive ecosystem for semantic search, conversational assistance, structured content management, visual planning, and more.

---

## Project Structure

The project follows a modular architecture with clear separation of concerns:

```directory structure
/ (root)
  main.ts
  manifest.json
  package.json
  tsconfig.json
  esbuild.config.mjs
  styles.css
  README.md
  /src
    FileManager.ts
    Parser.ts
    Chunker.ts
    LLMClient.ts
    Writer.ts
    SettingsManager.ts
    /UI
      index.ts
      Modal.ts
      MultiSelectModal.ts
      ProgressPane.ts
      VaultTreeView.ts
      treeUtils.ts
    /providers
      index.ts
      OllamaProvider.ts
      LMStudioProvider.ts
    /templates
      index.ts
      PromptTemplateManager.ts
  /docs
    ImplementationPlan.md
    Vespera-Scriptorium_PRD.md
    Vespera-Scriptorium_FRT.md
    Vespera-Scriptorium-Module-Roadmap.md
    /modules
      Chunker.md
      FileManager.md
      LLMClient.md
      Parser.md
      PromptTemplateManager.md
      UI.md
      Writer.md
  /.windsurf
    /rules
      index.md
      /code
        component-relationships.md
        examples.md
        organization.md
        performance.md
        testing.md
        type-safety.md
      /docs
        markdown-style.md
        rule-activation.md
        rule-best-practices.md
        standards.md
        structure.md
      /mcp-tools
        a2a-messaging-tools.md
        best-practices.md
        brave-search-tools.md
        context7-tools.md
        desktop-commander-tools.md
        github-tools.md
        index.md
        memory-tools.md
        nats-tools.md
        playwright-tools.md
        puppeteer-tools.md
        sequential-thinking-guide.md
        windows-cli-tools.md
    /tracking
      (milestone tracking documents)
```

## Windsurf Rule Optimization

The project implements an optimized Windsurf rules structure for the A2A messaging architecture to improve rule activation efficiency, reduce context size, and enhance Claude's ability to provide accurate assistance with the messaging system.

### Tiered Activation Strategy

1. **Tier 1: Always On (Core Architecture)**
   - Critical component interaction map and high-level project overview
   - Provides essential context in all interactions

2. **Tier 2: Glob Pattern (File-Type Specific)**
   - Rules loaded only when working with relevant file types
   - Documentation files: `globs: *.md`
   - TypeScript/JavaScript files: `globs: *.{ts,js}`
   - Test files: `globs: *.{test,spec}.{ts,js}`

3. **Tier 3: Model Decision (Tool-Specific)**
   - Specialized guides loaded based on relevance to the current task
   - Each includes a description that helps Claude determine when to load it
   - Example: "Apply when working with NATS messaging functionality"

This tiered approach ensures that Claude has access to the most relevant information for each task while optimizing context usage. For more details, see the rule activation documentation in `.windsurf/rules/docs/rule-activation.md`.

## Module-Based Architecture

Vespera Scriptorium follows a modular architecture with six major categories:

1. **Foundational Module** (In Progress)
   - Summarization Module (Current focus)

2. **Core AI Retrieval & Interaction** (Upcoming)
   - Semantic Search Module (Next focus)
   - Conversational Assistant Module
   - Inline Suggestion Module

3. **Structured "Codex" Content** (Planned)
   - Schema Templates Module
   - Dataview/Codex Views Module
   - Relationship Map Module

4. **Visual Planning & Organization** (Planned)
   - Kanban Boards Module
   - Timeline View Module
   - Outline Panel Module

5. **Project & Version Control Enhancements** (Planned)
   - Git Change Summarizer Module
   - Enhanced Version UI Module
   - Collaboration & Sync Module
   - Encryption Controls Module

6. **Extensibility & Advanced Features** (Planned)
   - Public API & Hook Module
   - Theming & Customization Module
   - AI-Driven Art Module

## Key Modules

### Current Implementation

- **FileManager**: Vault file discovery, selection, and I/O operations
- **Parser**: Handles .md, .txt, .html, .csv parsing with format detection
- **Chunker**: Text chunking using LangChain.js with configurable strategies
- **LLMClient**: Local LLM orchestration with provider implementations for Ollama and LM Studio
- **Writer**: Aggregates and outputs summaries to the `/Summaries` folder
- **UI**: Modals, panes, and tree views for selection and progress visualization
- **SettingsManager**: Configuration for LLM providers, chunking strategies, and output preferences
- **Providers**: Implementations for different LLM backends (Ollama, LM Studio)
- **Templates**: Prompt template management with variable substitution and conditional sections

### Robust Processing Features

- **Per-chunk Timeout Enforcement**: Individual timeout handling for each content chunk, ensuring reliable processing even on consumer-grade hardware
- **Incremental Output Naming**: Automatic file naming with sequential indices to prevent overwriting previous summaries
- **Defensive Chunk Sorting**: Robust handling of chunk ordering with safeguards against missing or malformed metadata
- **Enhanced Logging**: Comprehensive logging system for debugging and troubleshooting with configurable detail levels

### Upcoming Modules

- **Semantic Search**: Vector embeddings and similarity search across vault content
- **Conversational Assistant**: Dockable pane for context-aware Q&A
- **Schema Templates**: Structured content creation with predefined schemas
- **Relationship Map**: Visualize connections between content entities

## Development

- Node.js 16+, TypeScript, Obsidian API types
- Linting: ESLint (flat config, see `eslint.config.js`)
- Testing: Vitest/Jest (unit), Playwright (UI)

## Milestone Progress

- [x] Milestone 1: Project scaffolding and folder organization
- [x] Milestone 2: File discovery and selection UI
- [x] Milestone 3: Content parsing for multiple formats
- [x] Milestone 4: Text chunking with LangChain integration
- [x] Milestone 5: LLM integration with provider implementations
- [ ] Milestone 6: Output writing and summaries folder
- [ ] Milestone 7: Semantic search module (Part 1)
- [ ] Milestone 8: Semantic search module (Part 2)

---

## How to Use

### Installation for Development

1. Clone this repository
2. Run `npm i` to install dependencies
3. Run `npm run dev` to start compilation in watch mode
4. Create a symbolic link from the repo to your Obsidian plugins folder:
   - Windows: `mklink /D "C:\Path\To\Vault\.obsidian\plugins\vespera-scriptorium" "E:\Path\To\Repo"`
   - macOS/Linux: `ln -s /path/to/repo /path/to/vault/.obsidian/plugins/vespera-scriptorium`
5. Enable the plugin in Obsidian's Community Plugins settings

### Using the Plugin

1. Open the command palette (Ctrl/Cmd + P)
2. Search for "Vespera Scriptorium: Summarize Files"
3. Select files to summarize using the multi-select modal
4. Configure summarization options if prompted
5. View progress in the progress pane
6. Find generated summaries in the `/Summaries` folder

### Configuration

1. Open Settings > Vespera Scriptorium
2. Configure LLM provider settings (Ollama or LM Studio)
3. Adjust chunking strategy and parameters
4. Customize output format and location preferences

## Manual Installation

- After building, copy the entire `dist/Vespera-Scriptorium/` folder to your vault's `.obsidian/plugins/` directory.
- Example: `.obsidian/plugins/Vespera-Scriptorium/` should contain `main.js`, `manifest.json`, and `styles.css`.

## API Documentation

See <https://github.com/obsidianmd/obsidian-api>

---

For more details, see the PRD, FRT, and Module Roadmap in `/docs`.
