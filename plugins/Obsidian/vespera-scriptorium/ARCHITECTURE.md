# Vespera Scriptorium Obsidian Plugin - Architecture Document

## Overview

The Vespera Scriptorium Obsidian plugin integrates intelligent task orchestration and MCP capabilities directly into Obsidian, providing seamless AI-powered knowledge work with robust semantic search and autonomous agent execution.

## Core Requirements

### Primary Goals

- **Robust Semantic Search**: Enable queries like "what is Elise's favorite color" to successfully retrieve context from anywhere in the vault
- **Task Orchestration**: Create, manage, and execute hierarchical task trees with MCP integration
- **Creative Writing Focus**: Project templates and mode switching optimized for creative workflows
- **Agent Integration**: Spawn and manage autonomous agents for complex task execution

### User Experience Principles

- **Never break flow**: Minimize context switching and tab management
- **Graceful degradation**: Continue working even when services are unavailable
- **Progressive disclosure**: Simple interface with advanced features accessible when needed
- **Project awareness**: Understand and adapt to current project context

## Research Findings & Competitive Analysis

### Existing Plugin Patterns

#### Copilot for Obsidian (Enterprise)

**Strengths:**

- Multi-mode approach (Chat, Vault QA, Agent modes)
- Right-click text editing integration
- Prompt Palette with `/` commands
- Time-based queries and context-aware operations

**Critical Weaknesses:**

- **Indexing fragility**: Users report vault search failing frequently
- **Embedding model lock-in**: Changing models breaks existing indexes
- **Premium dependency**: Best features require subscription
- **Token confusion**: Max tokens vs context window complexity

#### BMO Chatbot (Open Source)

**Strengths:**

- Self-hosted model support (Ollama, LM Studio)
- Profile system for customizable chatbots
- Command-rich interface with chat history management
- Multi-provider API support

**Critical Weaknesses:**

- **No semantic search**: Limited to basic keyword matching
- **Basic UI**: Functional but not polished
- **Manual configuration**: Users must handle API endpoints

### Key Insights

1. **Indexing is the #1 pain point** across all existing solutions
2. **Dockable panels** preferred over modals for persistent interaction
3. **Right-click integration** highly valued for text editing workflows
4. **Project-scoped context** is missing from all current solutions
5. **Vault-wide search** differentiates premium from basic offerings

## Architectural Decisions

### 1. Robust Semantic Search System

**Problem Statement:**
Current Obsidian AI plugins fail at semantic search due to:

- Embedding model changes breaking indexes
- Poor handling of large vaults (>1000 notes)
- Fragile indexing that requires frequent re-indexing
- No fallback mechanisms when search fails

**Our Solution: Multi-Layer Search Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                 Search Query                            │
│              "What is Elise's favorite color?"         │
└─────────────────────────────┬───────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────┐
│              Query Processing Layer                     │
│  • Intent classification (fact lookup, summary, etc.)  │
│  • Entity extraction (Elise)                          │
│  • Query expansion and reformulation                   │
└─────────────────────────────┬───────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────┐
│             Parallel Search Execution                  │
├─────────────────┬─────────────────┬─────────────────────┤
│   Vector Search │ Graph Search    │   Full-Text Search  │
│                 │                 │                     │
│ • Embeddings    │ • Link analysis │ • Keyword matching │
│ • Semantic sim. │ • Backlinks     │ • Fuzzy search      │
│ • Context7 docs │ • Tag relations │ • Regex patterns   │
└─────────────────┼─────────────────┼─────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────┐
│            Result Synthesis & Ranking                  │
│  • Confidence scoring per source                       │
│  • Context relevance weighting                         │
│  • Recency and authority factors                       │
│  • Answer extraction and summarization                 │
└─────────────────────────────┬───────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────┐
│              Response Generation                        │
│  • Source attribution                                  │
│  • Confidence indicators                               │
│  • Related notes suggestions                           │
│  • Follow-up question prompts                          │
└─────────────────────────────────────────────────────────┘
```

**Key Components:**

1. **Hybrid Vector Store**
   - Primary: ChromaDB with local embeddings
   - Fallback: Lightweight TF-IDF vectors for offline capability
   - Incremental updates to avoid full re-indexing
   - Embedding model abstraction layer (prevent lock-in)

2. **Graph-Based Search**
   - Leverage Obsidian's existing link graph
   - Backlink traversal for context expansion
   - Tag-based relationship mapping
   - MOC (Map of Content) awareness

3. **Full-Text Search Integration**
   - Use Obsidian's native search capabilities
   - Regex pattern matching for structured data
   - Fuzzy search for typo tolerance
   - Dataview query integration

4. **Context7 Documentation Layer**
   - Validate search results against official documentation
   - Prevent hallucinated answers
   - Provide authoritative source links
   - Real-time documentation updates

**Robustness Features:**

- **Graceful degradation**: Always return some results even if embeddings fail
- **Progressive enhancement**: Better results with more data/time
- **Error recovery**: Automatic fallback chains
- **Performance monitoring**: Track search quality metrics

### 2. UI Architecture: Dockable Panel + Integration Points

**Primary Interface: Dockable Chat Panel**

```
┌─────────────────────────────────────────────────────────┐
│  🤖 Vespera Scriptorium              [Settings] [Close] │
├─────────────────────────────────────────────────────────┤
│  Mode: Creative Writing Project    Agent: ✅ Active     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  💬 Chat Interface                                      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ User: What is Elise's favorite color?              │ │
│  │                                                     │ │
│  │ 🤖: Based on your character notes, Elise's          │ │
│  │    favorite color is cerulean blue. This is        │ │
│  │    mentioned in her character profile and          │ │
│  │    referenced in Scene 3 where she chooses her     │ │
│  │    dress.                                           │ │
│  │                                                     │ │
│  │    Sources: [[Elise Character Profile]], [[Scene 3]] │ │
│  │    Confidence: High (2 sources confirm)            │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  📝 Current Context: [[Main Story]] (3,247 words)      │
│                                                         │
│  ⚡ Quick Actions:                                      │
│  • Create task from conversation                       │
│  • Add to character notes                              │
│  • Generate scene continuation                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  > Ask about your project...                           │
└─────────────────────────────────────────────────────────┘
```

**Secondary Integration Points:**

1. **Right-Click Context Menu**

   ```
   Selected Text → Right Click →
   ├── 📝 Edit with AI
   ├── 🤖 Ask Vespera about this
   ├── ⚡ Create task from selection
   ├── 🔗 Find related content
   └── 📋 Add to project notes
   ```

2. **Command Palette Integration**

   ```
   /vespera create task
   /vespera ask about [selection]
   /vespera switch project mode
   /vespera spawn agent
   /vespera search vault for [query]
   ```

3. **Ribbon Icon**
   - Toggle chat panel visibility
   - Show agent status indicator
   - Quick access to project modes

### 3. Project-Aware Context Management

**Problem:** Existing plugins treat all vault content equally, missing project-specific context and workflows.

**Solution: Project Mode System**

```
Project Modes:
├── Creative Writing
│   ├── Character development focus
│   ├── Plot structure awareness
│   ├── Scene continuity tracking
│   └── Style consistency checking
│
├── Research & Analysis
│   ├── Source citation tracking
│   ├── Evidence synthesis
│   ├── Argument structure
│   └── Fact-checking emphasis
│
├── Technical Documentation
│   ├── Code example validation
│   ├── API reference integration
│   ├── Version consistency
│   └── Technical accuracy focus
│
└── Personal Knowledge
    ├── Journal entry patterns
    ├── Habit tracking
    ├── Goal progression
    └── Memory reinforcement
```

**Project Context Features:**

- **Automatic mode detection** based on folder structure and note patterns
- **Context scoping**: Limit search to project-relevant content when appropriate
- **Template integration**: Project-specific task and note templates
- **Workflow adaptation**: Different UI priorities per project type

### 4. MCP Integration Architecture

**MCP Client Layer:**

```typescript
interface VesperaMCPClient {
  // Task orchestration
  createTask(task: TaskDefinition): Promise<TaskResult>
  executeTask(taskId: string): Promise<ExecutionResult>
  
  // Agent management
  spawnAgent(config: AgentConfig): Promise<AgentSession>
  sendMessage(sessionId: string, message: string): Promise<Response>
  
  // Context integration
  searchCodebase(query: string): Promise<SearchResults>
  validateCode(code: string): Promise<ValidationResult>
  
  // Obsidian adapters
  indexVault(): Promise<IndexResult>
  getVaultContext(scope?: ProjectScope): Promise<VaultContext>
}
```

**Integration Points:**

1. **Bidirectional sync** between Obsidian notes and Vespera tasks
2. **Agent status display** in chat panel header
3. **Task execution results** automatically added to relevant notes
4. **Context sharing** between Obsidian content and spawned agents

### 5. Data Storage Strategy

**Local Storage (.vespera/ folder in vault):**

```directory
.vespera/
├── index/
│   ├── embeddings.db          # Vector embeddings
│   ├── graph.json            # Relationship graph
│   └── search_cache.db       # Query result cache
├── projects/
│   ├── current_mode.json     # Active project configuration
│   └── templates/            # Project-specific templates
├── agents/
│   ├── sessions/             # Agent conversation history
│   └── outputs/              # Agent-generated artifacts
└── config/
    ├── search_settings.json  # Search configuration
    └── ui_preferences.json   # Panel layout, shortcuts
```

**Privacy & Security:**

- All data stored locally in vault
- No cloud dependencies for core functionality
- Optional MCP server connection for advanced features
- User controls what data is shared with agents

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)

1. **Basic plugin structure** with dockable panel
2. **Simple chat interface** with Obsidian markdown rendering
3. **MCP client integration** for basic task creation
4. **Full-text search implementation** as foundation layer

### Phase 2: Core Collaboration (Weeks 3-4) **[HIGH PRIORITY]**

1. **CRDT document synchronization** with Y.js integration
2. **WebRTC peer-to-peer connections** for serverless collaboration
3. **Project-scoped sharing** with invite code generation
4. **Basic collaborative editing** in shared notes
5. **Session management** (join, leave, handoff ownership)

### Phase 3: Semantic Search (Weeks 5-6)

1. **Vector embedding system** with ChromaDB integration
2. **Graph search implementation** using Obsidian's link data
3. **Search result synthesis** and ranking algorithms
4. **Query processing** and intent classification
5. **Collaborative search** across shared project context

### Phase 4: Project Intelligence (Weeks 7-8)

1. **Project mode detection** and switching
2. **Context-aware search scoping**
3. **Project template system**
4. **Workflow adaptation per project type**
5. **Collaborative project templates** for co-writing

### Phase 5: Advanced Features (Weeks 9-10)

1. **Agent spawning and management**
2. **Context7 documentation integration**
3. **Right-click context menu implementation**
4. **Command palette integration**
5. **Collaborative agent sessions**

### Phase 6: Polish & Optimization (Weeks 11-12)

1. **Performance optimization** for large vaults
2. **Error handling and graceful degradation**
3. **User onboarding and documentation**
4. **Beta testing and feedback integration**

## Success Metrics

### Semantic Search Quality

- **Query success rate**: >90% of reasonable queries return relevant results
- **Response time**: <2 seconds for typical vault sizes (<5000 notes)
- **Answer accuracy**: Measured by user feedback and source verification
- **Context relevance**: Ability to understand project-specific terminology

### User Experience

- **Time to first value**: <5 minutes from installation to useful interaction
- **Flow preservation**: Minimal context switching required
- **Error recovery**: Graceful handling of API failures and service interruptions
- **Feature discovery**: Users can find and use advanced features intuitively

### Technical Performance

- **Memory footprint**: <100MB for typical usage
- **Index build time**: <30 seconds for 1000 notes
- **Incremental updates**: Real-time indexing without noticeable lag
- **Plugin compatibility**: No conflicts with popular Obsidian plugins

## Risk Mitigation

### Technical Risks

1. **Embedding model dependencies**: Abstraction layer prevents lock-in
2. **Large vault performance**: Incremental indexing and lazy loading
3. **Memory usage**: Streaming responses and garbage collection optimization
4. **API rate limiting**: Local model fallbacks and request queuing

### User Experience Risks

1. **Complex setup**: Guided onboarding and sensible defaults
2. **Feature overload**: Progressive disclosure and mode-based UI
3. **Reliability expectations**: Clear status indicators and error messaging
4. **Privacy concerns**: Local-first architecture with transparent data handling

## Future Enhancements

### Advanced Search Features

- **Multi-modal search**: Images, PDFs, and audio file content
- **Temporal queries**: "What was I working on last Tuesday?"
- **Collaborative filtering**: Learn from user interaction patterns
- **Cross-vault search**: Query across multiple Obsidian vaults

### Workflow Integration

- **Calendar integration**: Schedule and track project milestones
- **Version control**: Git integration for collaborative writing
- **Export pipelines**: Direct publishing to various formats
- **External tool bridges**: Notion, Roam, other PKM systems

### Collaborative Features

- **CRDT-based document editing**: Real-time collaborative editing with conflict-free replicated data types
- **Shared project spaces**: Multi-user access to Vespera project contexts
- **Collaborative agent sessions**: Multiple users can interact with the same agent conversation
- **Distributed task coordination**: Task assignments and status updates across team members

## Missing Components to Consider

**CRDT Collaborative Editing System:**

```typescript
interface CollaborativeEditor {
  // Real-time document synchronization
  syncDocument(documentId: string): Promise<CRDTDocument>
  applyOperation(op: DocumentOperation): Promise<void>
  
  // Conflict resolution
  resolveConflicts(conflicts: EditConflict[]): Promise<Resolution[]>
  
  // Presence awareness
  showCursors(users: CollaborativeUser[]): void
  broadcastPresence(position: CursorPosition): void
}
```

**Potential Integration Points:**

- **Y.js integration**: Leverage existing CRDT library for Obsidian
- **WebRTC peer-to-peer**: Direct collaboration without central server
- **Operational Transform fallback**: For older clients or network issues
- **Conflict visualization**: Show merge conflicts in familiar diff format

## Ad-Hoc Collaboration Architecture **[PRIORITY FEATURE]**

**Problem Statement:**
Creative collaborators (writers, researchers) currently lose work in Discord/Slack logs and struggle with:

- **Context loss**: Conversations about "that character" lose meaning later
- **Version conflicts**: Who has the latest version of the shared doc?
- **Tool switching**: Brainstorming in chat, writing in docs, notes in yet another app
- **Async handoffs**: "I worked on Chapter 3, your turn" requires manual coordination

**Solution: Serverless Project Collaboration**

```text
┌─────────────────────────────────────────────────────────┐
│                Collaboration Workflow                  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Step 1: Host creates shareable project session        │
│  /vespera share project "Chapter 4 brainstorm"         │
│  → Generates: vespera://join/abc123                     │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Step 2: Guest joins via invite link                   │
│  → WebRTC P2P connection established                   │
│  → Project context synced (characters, outline, etc.)  │
│  → Both users get shared semantic search               │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Step 3: Collaborative work session                    │
│  • Real-time document editing (CRDTs)                  │
│  • Shared chat with context awareness                  │
│  • Joint task creation and planning                    │
│  • Presence indicators (cursors, typing)               │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Step 4: Session handoff and continuation              │
│  • "I'll work on scenes 5-7, you take 8-10"           │
│  • Changes sync back to both vaults                    │
│  • Conversation history preserved in both contexts     │
│  • Clean disconnect, independent work resumes          │
└─────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

```typescript
interface CollaborationSession {
  // Session lifecycle
  createSession(projectScope: ProjectScope): Promise<SessionInvite>
  joinSession(inviteCode: string): Promise<CollabContext>
  leaveSession(): Promise<SyncSummary>
  
  // Real-time sync
  syncDocument(docId: string, operations: CRDTOp[]): Promise<void>
  broadcastPresence(cursor: CursorPosition): Promise<void>
  
  // Context sharing
  shareProjectFiles(filters: FileFilter[]): Promise<SharedContext>
  syncSearchIndex(scope: ProjectScope): Promise<IndexSync>
  
  // Handoff coordination
  transferOwnership(newHost: UserId): Promise<void>
  forkProject(): Promise<IndependentProject>
}
```

**Key Features:**

1. **No server required**: Direct peer-to-peer via WebRTC
2. **Project-scoped**: Only share relevant context, not entire vault
3. **Persistent**: Changes sync to both users' local vaults
4. **Context-aware**: Shared semantic search across project scope
5. **Graceful handoffs**: Clean transition from collaboration to independent work

**User Experience:**

```text
Host: "Want to brainstorm Chapter 4?"
→ /vespera share project → copies invite link
→ Sends via any channel: "vespera://join/abc123"

Guest: Clicks link → Obsidian opens → "Join Chapter 4 brainstorm?"
→ Both users now have shared:
  • Character sheets and background
  • Plot outline and scene notes  
  • Shared chat with AI context
  • Real-time document editing

After session:
→ All changes preserved in both vaults
→ Conversation history linked to relevant notes
→ Can resume collaboration anytime
```

This directly replaces Discord brainstorming with structured, persistent collaboration that maintains context and preserves all work in your knowledge base.

This architecture prioritizes robust semantic search while maintaining the flexibility and extensibility needed for creative workflows. The multi-layer approach ensures users can find information reliably, whether asking about character details, plot points, or any other content in their vault.
