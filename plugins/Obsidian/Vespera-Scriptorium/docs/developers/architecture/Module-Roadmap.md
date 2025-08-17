# Vespera Scriptorium Module Roadmap

Below is a module-by-module roadmap for evolving **Vespera Scriptorium**—building on your **in-progress Summarization Module** and gradually surfacing the key Talespinners' Sanctum features as Obsidian plugins you can slot in over time.

---

## 1. Foundational Module (In Progress)

### 1.1 Summarization Module  
**Goal:** Chunk arbitrary files and produce roll-up summaries.  
**Status:** _Built:_ modal UI → file selection → LangChain splitter → placeholder for LLM calls.  
**Next Steps:**  
- Wire up your **SummaryEngine** to generate per-chunk summaries and aggregate them.  
- Persist outputs in a `/Summaries` folder or inline beneath original notes.  
- Expose a **Re-summarize** command for updated content.

---

## 2. Core AI Retrieval & Interaction

### 2.1 Semantic Search Module  
**Goal:** Embed a vector-search index over your vault.  
**Key Tasks:**  
- After chunking, compute embeddings (Ollama/local model) and store in a lightweight index.  
- Create a "Find semantically similar" command that returns top N matching notes or chunks.  
- UI: modal with search box + ranked results list.  

### 2.2 Conversational Assistant Module  
**Goal:** A dockable pane for freeform Q&A scoped to vault or active note.  
**Key Tasks:**  
- Use Obsidian Pane API to render a persistent chat view.  
- On each user message, gather context (recent chunks), call LLM, display response.  
- Allow "pin" of chat histories per-vault or per-workspace.

### 2.3 Inline Suggestion Module  
**Goal:** Let you select text in-note and generate AI-powered rewrites, expansions, or summaries.  
**Key Tasks:**  
- Add a right-click "VS: Summarize/Expand/Rewrite selection" action.  
- Show results in a small popup with "Insert," "Replace," "Append" buttons.  

---

## 3. Structured "Codex" Content

### 3.1 Schema Templates Module  
**Goal:** Define JSON/YAML schemas for Characters, Locations, Scenes, etc.  
**Key Tasks:**  
- Ship a `/schemas` folder where users drop their schema files.  
- Generate "New X Entry" commands that scaffold frontmatter + sections.  

### 3.2 Dataview/Codex Views Module  
**Goal:** One-click Dataview blocks filtered by schema type.  
**Key Tasks:**  
- For each schema, expose commands like "List all Characters" → injects a Dataview code block.  
- Optionally, wrap results in a custom panel for richer styling.

### 3.3 Relationship Map Module  
**Goal:** Spotlight schema-backed links in Obsidian's Graph or a custom map.  
**Key Tasks:**  
- Parse frontmatter fields (e.g. `affiliation: [[Guild A]]`) to infer edges.  
- Provide a "VS Codex Map" view that filters graph to just those nodes + relations.

---

## 4. Visual Planning & Organization

### 4.1 Kanban Boards Module  
**Goal:** Auto-generate Kanban boards for "Scene" or "Task" entries.  
**Key Tasks:**  
- Leverage the community Kanban plugin's API.  
- Sync frontmatter `status:` field with column headings.

### 4.2 Timeline View Module  
**Goal:** Render dated schema entries (events, scenes) on a scrollable timeline.  
**Key Tasks:**  
- Integrate with an existing Timeline plugin or build a lightweight HTML view.  
- Pull `date:` from frontmatter and plot in chronological order.

### 4.3 Outline Panel Module  
**Goal:** Show a collapsible tree of your Codex categories.  
**Key Tasks:**  
- Use Obsidian's Outline API to define top-level nodes per schema type.  
- Allow drag-and-drop reordering (if supported) to update an entry's `order:` field.

---

## 5. Project & Version Control Enhancements

### 5.1 Git Change Summarizer Module  
**Goal:** Summarize git-diffs using your chunker + Summarization engine.  
**Key Tasks:**  
- Integrate with the Obsidian Git plugin to pull diffs since last commit.  
- Chunk and summarize, then output a human-readable "What changed" note.

### 5.2 Enhanced Version UI Module  
**Goal:** Show commit list + AI-generated summaries side-by-side.  
**Key Tasks:**  
- Wrap the Git plugin's file list panel in a new view.  
- Fetch per-commit diff summary from Summarization Module.

### 5.3 Collaboration & Sync Module  
**Goal:** Real-time peer editing with conflict summaries.  
**Key Tasks:**  
- Leverage Obsidian Sync or peer-to-peer plugins.  
- On merge conflicts, auto-generate a diff summary and present resolution suggestions.

### 5.4 Encryption Controls Module  
**Goal:** Toggle note-level encryption on/off.  
**Key Tasks:**  
- Integrate with the community Encryption plugin.  
- Provide a "VS: Encrypt/Decrypt" command and surface status in the note header.

---

## 6. Extensibility & Advanced Features

### 6.1 Public API & Hook Module  
**Goal:** Let other plugins call your core services (chunk, summarize, embed).  
**Key Tasks:**  
- Export commands like `vs:chunk-text`, `vs:generate-summary`.  
- Document input/output contracts in a `README` under `/api`.

### 6.2 Theming & Customization Module  
**Goal:** Skin your modals, panes, and outputs to user taste.  
**Key Tasks:**  
- Expose CSS-variable overrides in the Settings UI.  
- Let users pick font-sizes, panel widths, and highlight colors.

### 6.3 AI-Driven Art Module  
**Goal:** Create AI-generated character imagery with advanced conditional prompt building and directional tag management.  
**Key Tasks:**  
- **Basic Image Generation**: Implement a Python subprocess backend to run local Stable Diffusion models.
- **Smart Prompt Building**: Create a tag management system with conditional and directional rules.
- **Character Sheet Generator**: Generate multi-view (front/side/back) and facial expression matrix character sheets.
- **LoRA Dataset Creation**: Prepare comprehensive training datasets for character LoRA training.
- **Note Integration**: Extract character details from notes and attach generated images with metadata.
- **UI Panel**: Build a dedicated panel with tabs for different generation modes and image preview area.

#### Development Phases:

1. **Infrastructure Phase**: Python subprocess backend, model loading, and basic UI.
2. **Prompt Engineering Phase**: Smart tag system with conditionals and directional rules.
3. **Character Generation Phase**: Basic character generation with angle-specific tag handling.
4. **Character Sheet Phase**: Multi-view and expression matrix generation.
5. **LoRA Dataset Phase**: Training variant generation with metadata.
6. **Integration Phase**: Connect with notes, add keyboard shortcuts, and optimize performance.

See [AI Art Module Documentation](../modules/AIArtModule.md) for the comprehensive architecture plan.

---

### Suggested Prioritization

1. **Finish Summarization** (Module 1)  
2. **Semantic Search** (2.1) & **Inline Suggestions** (2.3)  
3. **Conversational Assistant** (2.2)  
4. **Schema Templates** (3.1) & **Dataview/Codex Views** (3.2)  
5. **Relationship Map** (3.3)  
6. **Visual Planning** (4.x)  
7. **AI Art Module** (6.3) - Consider moving up in priority for creative needs
8. **Git & Version UI** (5.1–5.2)  
9. **Collaboration & Encryption** (5.3–5.4)  
10. **API & Theming** (6.1–6.2)
