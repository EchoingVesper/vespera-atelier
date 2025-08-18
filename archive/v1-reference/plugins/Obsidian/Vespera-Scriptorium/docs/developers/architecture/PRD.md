# Summary

"Vespera Scriptorium" is an Obsidian plugin ecosystem designed to enhance creative writing and worldbuilding workflows through AI-powered tools and structured content management. Initially focused on summarization capabilities, the project has expanded to encompass a comprehensive module-based architecture that will include semantic search, conversational assistance, structured content templates, visual planning tools, version control enhancements, and extensibility features. This PRD outlines the project's expanded vision, scope, user personas, use cases, and both functional and non-functional requirements. It details UI/UX needs—leveraging Obsidian's built-in panes and modals—alongside technical specs for the modular architecture, with immediate focus on completing the Summarization Module while establishing foundations for future capabilities.

---

## 1. Introduction

A Product Requirements Document (PRD) defines what capabilities are expected from the final product from the perspective of the end user, serving as a guide for design, development, and launch teams ([Product Requirements Documents (PRD) Explained - Atlassian](https://www.atlassian.com/agile/product-management/requirements?utm_source=chatgpt.com)). "Vespera Scriptorium" began with the goal of streamlining the laborious process of hunting through chat-derived notes and legacy files by generating polished `.md` summaries directly within an Obsidian Vault. As development progressed through Milestone 5 (LLM Integration), the vision expanded to create a comprehensive ecosystem of AI-enhanced tools for writers, worldbuilders, and TTRPG enthusiasts, organized into a modular architecture that allows for incremental development and user customization.

---

## 2. Goals & Objectives

- **Primary Goal**: Create a modular ecosystem of AI-powered tools that enhance creative writing and worldbuilding workflows within Obsidian.
- **Immediate Focus**: Complete the Summarization Module to enable users to select multiple Vault files and automatically generate coherent story summaries in Markdown format.
- **Long-term Vision**: Develop additional modules for semantic search, conversational assistance, structured content management, visual planning, version control, and extensibility.
- **Business Objectives**:
  1. Reduce manual search and organization time by ≥ 70% across various creative writing workflows.
  2. Achieve ≥ 90% user satisfaction in ease of use and AI-generated content quality.
  3. Publish to Obsidian's Community Plugin directory with zero critical issues at launch.
  4. Establish a sustainable development roadmap for incremental module releases.

---

## 3. User Personas

1. **Solo World-Builder**
   - Needs: Fast extraction of lore and dialogue from chat logs and spreadsheets; semantic search across worldbuilding notes; structured templates for consistent entity creation.
   - Pain Points: Scattered notes across formats; difficulty finding related content; inconsistent entity documentation.
2. **Collaborative Storyteller**
   - Needs: Consistent summaries to share with co-writers; version control with meaningful change tracking; secure sharing of selected content.
   - Pain Points: Manual consolidation of multi-format inputs; difficulty tracking contributions; inconsistent formatting across team members.
3. **TTRPG Librarian**
   - Needs: Archive session summaries and NPC details; relationship mapping between characters and locations; timeline visualization of campaign events.
   - Pain Points: Inconsistent formatting; difficulty reusing chat outputs; complex relationships between game elements hard to visualize.
4. **Fiction Author**
   - Needs: AI-assisted writing suggestions; structured organization of plot elements; visual planning tools for narrative arcs.
   - Pain Points: Writer's block; disorganized research notes; difficulty maintaining consistency across long works.
5. **Academic Researcher**
   - Needs: Semantic search across research materials; structured note templates; automated summarization of complex texts.
   - Pain Points: Information overload; difficulty connecting related concepts; time-consuming manual summarization.

---

## 4. Use Cases

### 4.1 Summarization Module

#### 4.1.1 Bulk Summarization
- **Trigger**: User invokes "Summarize Selected Files" from Obsidian's Command Palette.
- **Flow**: Plugin lists `.md`, `.txt`, `.html`, and `.csv` files in a MultiSelectModal; user checks targets; plugin parses, chunks, calls LLM, and writes summaries to `/Summaries`.

#### 4.1.2 Ad-hoc Cleanup
- **Trigger**: User right-clicks a single file and selects "Summarize This File."
- **Flow**: Same as bulk but limited to one file; quick preview in a new pane.

### 4.2 Semantic Search Module

#### 4.2.1 Vault-Wide Search
- **Trigger**: User opens the Semantic Search pane and enters a natural language query.
- **Flow**: Plugin retrieves embeddings for the query, compares against indexed vault content, and returns semantically similar passages ranked by relevance.

#### 4.2.2 Related Content Discovery
- **Trigger**: User right-clicks on a paragraph and selects "Find Related Content."
- **Flow**: Plugin generates embeddings for the selected text, searches the vector index, and displays a list of semantically similar passages from across the vault.

### 4.3 Conversational Assistant Module

#### 4.3.1 Vault-Aware Chat
- **Trigger**: User opens the Assistant pane and asks a question about their vault content.
- **Flow**: Plugin retrieves relevant context from the vault using semantic search, sends the context and question to the LLM, and displays the response with citations.

### 4.4 Schema Templates Module

#### 4.4.1 Entity Creation
- **Trigger**: User selects "Create New Character" from the Command Palette.
- **Flow**: Plugin generates a new note with predefined frontmatter and sections based on the Character schema template.

---

## 5. Functional Requirements  

1. **File Discovery**  
   - List Vault files by extension via `this.app.vault.getFiles()` ([How to Write a Product Requirements Document (PRD) - Nuclino](https://www.nuclino.com/articles/product-requirements-document?utm_source=chatgpt.com)).  
2. **Multi-Select UI**  
   - Present files in a Modal with checkboxes for user selection.  
3. **Parsing Engines**  
   - **Markdown/Text**: `this.app.vault.read(file)`  
   - **HTML**: Use DOMParser to extract visible text.  
   - **CSV**: Parse with `papaparse` in Node context ([What are some must have plugins for beginners with Obsidian - Reddit](https://www.reddit.com/r/ObsidianMD/comments/11q7q6l/what_are_some_must_have_plugins_for_beginners/?utm_source=chatgpt.com)).  
4. **Chunking**  
   - Split text into sentence/paragraph chunks with LangChain.js’s `RecursiveTextSplitter`.  
5. **LLM Calls**  
   - Invoke local Ollama/LM Studio models via `child_process.spawn` or HTTP API.  
6. **Output Writing**  
   - Create `.md` files in `/Summaries` using `this.app.vault.create()` ([How to Write a Product Requirements Document (PRD) - Nuclino](https://www.nuclino.com/articles/product-requirements-document?utm_source=chatgpt.com)).  
7. **Settings Panel**  
   - Allow users to configure chunk size, overlap, and optional spell-check cleanup.  
8. **Progress Feedback**  
   - Show a progress bar or status messages in a custom pane during processing.  

---

## 6. Non-Functional Requirements  

- **Performance**: Handle up to 100 files and 1 million words within 2 minutes.  
- **Reliability**: 99% success rate on repeated runs; graceful error handling with user-friendly notices.  
- **Maintainability**: Code coverage ≥ 80%, modular architecture, thorough inline docs.  
- **Security**: No external data transmissions; all processing runs locally.  
- **Compatibility**: Support Obsidian v1.4+ on Windows (future macOS/Linux support optional).  

---

## 7. UI/UX Requirements  

- **Consistency**: Follow Obsidian plugin UI conventions for modals, panes, and notices ([Submission requirements for plugins - Developer Documentation](https://docs.obsidian.md/Plugins/Releasing/Submission%2Brequirements%2Bfor%2Bplugins?utm_source=chatgpt.com)).  
- **Accessibility**: Keyboard navigation for file selection and command invocation.  
- **Clarity**: Clear labels (e.g., “Summarize Selected Files”), tooltips for settings, and real-time status updates.  

---

## 8. Technical Requirements

- **Languages & Frameworks**:
  - TypeScript, Node.js for core development
  - LangChain.js for text processing and LLM orchestration
  - papaparse for CSV parsing
  - SQLite (or similar) for lightweight vector storage
  - React for complex UI components

- **Obsidian APIs**:
  - Plugin API v1.0+
  - Vault API for file operations
  - Workspace API for UI integration
  - Modal API for user interfaces
  - Pane API for persistent views
  - Settings API for configuration

- **LLM Integration**:
  - Ollama CLI (`ollama run …`) or HTTP (`localhost:11434/v1/completions`)
  - LM Studio API integration
  - Embedding model support for semantic search
  - Streaming response handling
  - Template management system

- **Data Storage & Processing**:
  - Vector embeddings for semantic search
  - JSON/YAML schema validation
  - Efficient chunking algorithms
  - Caching mechanisms for performance

- **Testing**:
  - Vitest or Jest for unit tests
  - Playwright for end-to-end UI tests
  - Mock LLM responses for deterministic testing
  - Performance benchmarking tools

---

## 9. Architecture & Integration

- **Modular Ecosystem Design**:
  - **1. Foundational Module**: Summarization (current focus)
  - **2. Core AI Retrieval & Interaction**: Semantic Search, Conversational Assistant, Inline Suggestions
  - **3. Structured "Codex" Content**: Schema Templates, Dataview/Codex Views, Relationship Maps
  - **4. Visual Planning & Organization**: Kanban Boards, Timeline View, Outline Panel
  - **5. Project & Version Control**: Git Change Summarizer, Enhanced Version UI, Collaboration & Sync, Encryption Controls
  - **6. Extensibility & Advanced Features**: Public API & Hooks, Theming & Customization, AI-Driven Art

- **Shared Core Services**:
  - **FileManager**: File discovery and manipulation across all modules
  - **Parser**: Multi-format content extraction (Markdown, HTML, CSV)
  - **Chunker**: Content segmentation for various AI processing needs
  - **LLMClient**: Unified interface for all AI model interactions
  - **SettingsManager**: Centralized configuration for all modules

- **Summarization Module Workflow**:
  1. **Discover** → 2. **Parse** → 3. **Chunk** → 4. **LLM Call** → 5. **Aggregate** → 6. **Write**

- **Data Flow**: Streams chunks to LLM client, collects responses, and writes atomically to prevent partial outputs.

- **Module Independence**: Each module has clear boundaries and interfaces, allowing independent development, testing, and user activation.

---

## 10. Milestones & Timeline

| Milestone                                | Target Date    | Description                                           |
|------------------------------------------|----------------|-------------------------------------------------------|
| 1. Project Setup & Scaffolding           | May 10, 2025   | Initialize repo; sample plugin loaded                 |
| 2. File Discovery & UI Modal             | May 17, 2025   | Multi-select modal integrated                         |
| 3. Parsing & Chunking                    | May 24, 2025   | Markdown, HTML, CSV parsing; chunker wired            |
| 4. LLM Orchestration                     | May 31, 2025   | Local Ollama calls; basic summary output              |
| 5. LLM Integration                       | June 7, 2025   | Provider implementations; template system             |
| 6. Complete Summarization Module         | June 21, 2025  | Writer module; summary folder structure; metadata     |
| 7. Semantic Search Module (Phase 1)      | July 12, 2025  | Embedding generation; vector storage implementation   |
| 8. Semantic Search Module (Phase 2)      | July 26, 2025  | Search UI; result formatting                          |
| 9. Inline Suggestion Module              | August 16, 2025| Selection-based AI suggestions; insertion UI          |
| 10. Conversational Assistant Module      | Sept 6, 2025   | Persistent chat pane; context-aware responses         |
| 11. Schema Templates Module              | Sept 27, 2025  | JSON/YAML schemas; template generation                |
| 12. Dataview/Codex Views Module          | Oct 18, 2025   | Filtered views; custom panels                         |

---

## 11. Metrics & Success Criteria

- **Usage Metrics**:
  - Number of files processed per session; average processing time
  - Number of modules activated per user
  - Frequency of use for each module
  - Cross-module workflows completed

- **Quality Metrics**:
  - **Summarization Accuracy**: ≥ 85% of summaries rated "useful" by users
  - **Search Relevance**: ≥ 80% of top 5 search results rated relevant
  - **Assistant Helpfulness**: ≥ 85% of assistant responses rated helpful
  - **Reliability**: ≤ 2% error rate on production runs across all modules

- **Adoption Metrics**:
  - ≥ 500 installs in first month; ≥ 4.5★ average rating in the community directory
  - ≥ 60% of users activating multiple modules
  - ≥ 40% monthly active users after 6 months
  - ≥ 25% of users contributing feedback or feature requests

- **Performance Metrics**:
  - Average response time < 2 seconds for search operations
  - Memory usage < 200MB during normal operation
  - Successful operation on vaults with 10,000+ notes

---

## 12. Risks & Mitigations

| Risk                                       | Impact           | Mitigation                                                |
|--------------------------------------------|------------------|-----------------------------------------------------------|
| LLM performance variability                | High             | Allow choosing lighter models; batching strategy          |
| Obsidian API breaking changes              | Medium           | Pin to stable API; abstract Vault calls in a module       |
| Parsing edge cases (malformed HTML/CSV)    | Medium           | Fallback to raw text; user notifications                  |
| Plugin size & memory consumption           | Low              | Lazy-load dependencies; optimize chunk overlap            |
| Module interdependencies                   | Medium           | Clear interfaces; dependency injection; feature flags     |
| User overwhelm from feature complexity     | Medium           | Progressive disclosure; modular activation; guided setup  |
| Vector database performance                | Medium           | Lightweight implementation; indexing optimizations        |
| Integration with community plugins         | Low              | Loose coupling; fallback behaviors when plugins missing   |

---

## 13. Appendix  

- **References**:  
  - PRD Best Practices, Aha! Roadmapping Guide ([PRD Template: What To Include in a Great Product Requirements ...](https://www.aha.io/roadmapping/guide/requirements-management/what-is-a-good-product-requirements-document-template?utm_source=chatgpt.com))  
  - Atlassian Agile Product Management Overview ([Product Requirements Documents (PRD) Explained - Atlassian](https://www.atlassian.com/agile/product-management/requirements?utm_source=chatgpt.com))  
  - LangChain.js Documentation (RecursiveTextSplitter)  
  - Obsidian Developer Docs – Build a Plugin ([Build a plugin - Developer Documentation](https://docs.obsidian.md/Plugins/Getting%2Bstarted/Build%2Ba%2Bplugin?utm_source=chatgpt.com))  
- **Glossary**:
  - **Vault**: Obsidian's folder of Markdown files.
  - **Chunk**: A segment of text sized to fit an LLM's context window.
  - **LLM Client**: Component interfacing with Ollama/LM Studio.
  - **Module**: A self-contained functional unit with clear boundaries and interfaces.
  - **Embedding**: Vector representation of text for semantic search.
  - **Schema**: Structured data template for consistent content creation.
  - **Codex**: Organized collection of structured content entries.

---
