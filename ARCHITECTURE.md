# Vespera Atelier V2 Architecture

**Status**: Ground-up rewrite in progress  
**V1 Archive**: `archive/v1-legacy` branch (tag: `v1-archive-20250818`)  
**Active Session**: `session_16affafc_1755499003`  
**Last Updated**: 2025-08-18

## 🎯 Transition Strategy

### Orchestrator Preservation Protocol

**Critical Insight**: The current V1 orchestrator system remains active to coordinate the V2 rewrite process, ensuring no loss of task management capabilities during the transition.

#### Preservation Approach
1. **V1 Orchestrator Active**: Current session `session_16affafc_1755499003` manages V2 development
2. **Archive Safety**: V1 codebase preserved in `archive/v1-legacy` branch  
3. **Continuous Coordination**: V1 orchestrator tools coordinate V2 implementation
4. **Pattern Migration**: Proven V1 patterns systematically integrated into V2
5. **No Downtime**: Project management capabilities maintained throughout transition

## 🏗️ V2 Architecture Overview

### Core Vision
Building a **"repository of information with automatic organization"** and **"Discord for LLMs"** that enables seamless management of creative projects.

### Clean Architecture Implementation

```
scriptorium/                    # V2 Core Backend
├── domain/                     # Business Logic (Pure)
│   ├── entities/              # Core business objects
│   │   ├── task.py           # Task hierarchy system
│   │   ├── role.py           # Role with capability restrictions
│   │   ├── artifact.py       # Comprehensive artifact tracking
│   │   └── project.py        # Project orchestration
│   ├── value_objects/         # Immutable domain concepts
│   ├── repositories/          # Abstract data contracts
│   └── services/              # Domain business rules
│
├── application/                # Use Cases & Workflows
│   ├── use_cases/            # Application business logic
│   ├── services/             # Application coordination
│   ├── dtos/                 # Data transfer objects
│   └── interfaces/           # External system contracts
│
├── infrastructure/            # External Concerns
│   ├── databases/            # Triple database system
│   │   ├── sqlite/           # Transactional data
│   │   ├── chroma/          # Vector embeddings
│   │   └── kuzu/            # Graph relationships
│   ├── llm/                  # LLM integration
│   │   ├── local/           # Ollama, LM Studio
│   │   └── api/             # Claude, GPT, Gemini
│   ├── plugins/              # Plugin communication
│   └── external/            # File system, Git, etc.
│
└── presentation/              # User Interfaces
    ├── api/                  # REST API for plugins
    ├── cli/                  # Command-line interface
    └── mcp/                  # MCP server implementation
```

### Database Architecture

#### Triple Database System
- **SQLite**: Core transactional data (tasks, roles, sessions)
- **KuzuDB**: Graph relationships (embedded, Cypher support)
- **Chroma**: Vector embeddings (semantic search, document similarity)

#### Benefits
- **All Embedded**: No external service dependencies
- **Specialized**: Each database optimized for its use case
- **Scalable**: Can handle large creative projects with complex relationships
- **Local-First**: Works offline with optional cloud sync

## 🔌 Plugin Architecture

### Dual Plugin Strategy

#### Obsidian Plugin
- **Knowledge Management**: Document-centric workflows
- **Visual Task Management**: Kanban boards, mind maps
- **Creative Project Oversight**: Multi-modal project tracking
- **Graph Visualization**: Relationship mapping

#### VS Code Extension  
- **Development Workflows**: Code-centric task management
- **Integrated Terminal**: CLI tool access
- **File Management**: Direct scriptorium integration
- **Debug Integration**: Task-aware debugging

## 📊 Artifact System

### Comprehensive Tracking

#### Scope (from completed worksheet)
- **All LLM Messages**: Complete conversation history
- **All File Changes**: Version-controlled artifact storage
- **User Interactions**: Decision tracking and learning
- **System Actions**: Automation audit trail

#### Organization Structure
```
.vespera_scriptorium/
├── artifacts/
│   ├── by-task/          # Task-based organization
│   ├── by-date/          # Chronological access
│   ├── by-type/          # Type-based (code, docs, creative)
│   └── by-id/            # Database reference
├── databases/
│   ├── core.db           # SQLite core data
│   ├── vector/           # Chroma database
│   └── graph/            # KuzuDB database
└── config/
    ├── roles/            # Role templates
    ├── templates/        # Task templates
    └── hooks/            # Automation configurations
```

## 🚀 Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Status**: In Progress via Meta-PRP coordination

#### Deliverables
- [ ] Clean Architecture directory structure
- [ ] Database abstraction layer (triple database)
- [ ] Core domain entities (Task, Role, Artifact, Project)
- [ ] Plugin communication protocol design
- [ ] Basic CLI interface structure

#### V1 Orchestrator Role
- Coordinates specialist agent spawning
- Manages task breakdown and dependencies
- Preserves work artifacts across development sessions
- Provides continuous project oversight

### Phase 2: Core Systems (Weeks 3-4)
#### Deliverables
- [ ] Role system with capability restrictions (Roo Code-inspired)
- [ ] Local LLM integration (Ollama, LM Studio)
- [ ] Task hierarchy implementation
- [ ] Session → Task migration utilities
- [ ] Basic artifact tracking system

### Phase 3: Intelligence Layer (Weeks 5-6)
#### Deliverables
- [ ] Chroma vector database integration
- [ ] KuzuDB graph database implementation
- [ ] Document linking with file-type hooks
- [ ] Workflow automation engine
- [ ] Template system overhaul

### Phase 4: Plugin Development (Weeks 7-8)
#### Deliverables
- [ ] Obsidian plugin MVP
- [ ] VS Code extension MVP
- [ ] Cross-plugin communication
- [ ] User workflow testing
- [ ] Integration test suite

## 📈 Performance Targets

### Startup Performance
- **< 5 seconds**: Basic functionality available
- **< 10 seconds**: Full system ready including databases
- **< 2 seconds**: Plugin connection establishment

### Runtime Performance  
- **10-50 concurrent tasks**: Target capacity for individual users
- **50+ concurrent tasks**: Scalable for large creative projects
- **< 100ms**: API response times for standard operations
- **< 500ms**: Complex search operations (vector + graph)

### Resource Usage
- **2-8GB RAM**: Reasonable for local development
- **10GB+ storage**: Large creative projects with assets
- **Minimal CPU**: Background operations should not impact system

## 🔄 Migration Strategy

### Data Migration
- [ ] Task hierarchy conversion from V1 sessions
- [ ] Artifact preservation and organization  
- [ ] Role definition migration
- [ ] Template system enhancement

### Feature Parity
- [ ] All V1 MCP tools functional in V2
- [ ] Enhanced capabilities where architecturally sound
- [ ] Improved reliability through Clean Architecture
- [ ] Maintained backward compatibility for critical workflows

---

**Next Steps**: Execute Phase 1 via active meta-PRP coordination while maintaining V1 orchestrator session continuity.