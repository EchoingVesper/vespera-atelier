# Vespera Atelier Development Roadmap

**Created**: 2025-08-19  
**Status**: Active Development Plan  
**Vision**: Creative suite with development tools at its core

---

## 📋 Priority Phases

### Phase 1: Foundation Layer (Next 2-3 months)

1. **LLM Provider System** - Critical blocker for everything else
2. **Triple Database Integration** - Core intelligence layer
3. **Basic Plugin Framework** - User interface foundation

### Phase 2: User Experience (Following 3-4 months)

4. **Obsidian Plugin MVP** - Immediate usability for creative workflow
5. **ComfyUI Integration** - High-value creative workflow automation
6. **Collaboration Infrastructure** - P2P real-time sync foundation

### Phase 3: Creative Suite Expansion (6+ months)

7. **VS Code Plugin** - Development workflow completion
8. **Asset Management System** - Creative project organization
9. **Advanced Analytics & Automation** - Power user features

---

## 🔍 Research & Resources

### Claude Code OAuth Integration

Located at: `/home/user/.claude/.credentials.json`

Structure:
```json
{
  "claudeAiOauth": {
    "accessToken": "<TOKEN>",
    "refreshToken": "<TOKEN>",
    "expiresAt": 1785641859301,
    "scopes": ["user:inference"],
    "subscriptionType": null
  }
}
```

**Investigation needed**:
- OAuth refresh mechanism and token rotation
- API endpoints compatibility
- Legal/ToS implications
- Security considerations

### Existing Solutions to Leverage

#### Already in reference/
- **crawl4ai-rag**: Knowledge graphs, web crawling, RAG patterns
- **context7**: Documentation fetching, token optimization
- **Roo Code**: Provider implementations, VS Code integration patterns

#### Additional Research Targets
- **ComfyUI API**: Python API or WebSocket interface
- **PeerJS/WebRTC**: P2P collaboration infrastructure
- **CRDTs**: Conflict-free replicated data types for collaborative editing
- **LangChain/LlamaIndex**: RAG implementation patterns
- **Ollama**: Local model integration
- **Obsidian Plugin SDK**: Built-in features to leverage

---

## 🚀 Implementation Sprints

### Sprint 1: Foundation Research (Week 1-2)

1. **Update Reference Repositories**
   ```bash
   cd reference/roo-code && git pull
   cd ../crawl4ai-rag && git pull  
   cd ../context7 && git pull
   ```

2. **Analyze Provider Implementations**
   - Roo Code's Claude Code provider
   - Context7's documentation fetching
   - crawl4ai's RAG patterns

3. **OAuth Feasibility Study**
   - Research Anthropic's ToS
   - Test token refresh mechanism
   - Investigate API compatibility

### Sprint 2: Core Systems (Week 2-4)

1. **LLM Provider System**
   - Multi-provider architecture design
   - Cost tracking and warnings
   - Context management optimization

2. **Triple Database Activation**
   - Enable Chroma vector database
   - Integrate KuzuDB relationships
   - Build unified query interface

3. **Basic RAG System**
   - Document indexing pipeline
   - Semantic search implementation
   - Knowledge graph integration

### Sprint 3: Plugin Framework (Month 2)

1. **Obsidian Plugin Research**
   - Study Obsidian's built-in features (Bases, organization, markdown)
   - Design integration points
   - Prototype basic interface

2. **Shared Architecture Design**
   - Common TypeScript/Python core
   - Plugin-specific UI layers
   - Real-time sync protocols

3. **ComfyUI Integration Planning**
   - API investigation
   - Booru tag management system design
   - Workflow automation architecture

### Sprint 4: MVP Development (Month 2-3)

1. **Obsidian Plugin MVP**
   - Basic task management UI
   - LLM chat interface
   - Scriptorium integration

2. **ComfyUI Tag Manager**
   - Intelligent conflict resolution
   - Automatic organization
   - Workflow integration

3. **P2P Collaboration Prototype**
   - WebRTC implementation
   - CRDT integration
   - @mention system for LLM

---

## 🎯 Success Metrics

### MVP Criteria
- ✅ GUI in VS Code/Obsidian
- ✅ Chatbot with Scriptorium integration
- ✅ Creative task application (Discord log analysis)
- ✅ P2P collaboration for brainstorming sessions

### Phase 1 Deliverables
- Working LLM provider system with cost management
- Enabled triple database with RAG
- Basic plugin framework design

### Phase 2 Deliverables
- Functional Obsidian plugin
- ComfyUI integration prototype
- P2P sync demonstration

### Phase 3 Deliverables
- VS Code extension
- Complete asset management
- Production-ready system

---

## 📊 Technical Architecture

### Core Components

#### LLM Provider System
- Multi-provider support (Claude Code OAuth, API keys, local models)
- Smart context management
- Usage tracking and cost warnings
- Token rotation and security

#### Triple Database Architecture
- **SQLite**: Core task and metadata storage
- **Chroma**: Vector embeddings for semantic search
- **KuzuDB**: Graph relationships and dependencies

#### Plugin Architecture
- Shared core library (business logic)
- Plugin-specific UI implementations
- Real-time sync via WebRTC/CRDTs
- Progressive feature disclosure

### Key Features

#### Directory-Restricted Roles
```yaml
documentation_specialist:
  working_directories: 
    - "/docs/**"
    - "/README.md"
  forbidden_directories:
    - "/src/**"
```

#### Intelligent ComfyUI Integration
- Booru tag conflict resolution
- Automatic image organization
- Prompt management system

#### Collaboration Infrastructure
- P2P connections via WebRTC
- Real-time collaborative editing
- Observer mode LLM with @mentions
- Privacy-focused (no cloud routing)

---

## 🔧 "Don't Reinvent the Wheel" Strategy

Before implementing any major component:

1. Search existing Python/TypeScript packages
2. Check GitHub for similar projects
3. Look for academic papers with implementations
4. Consider forking rather than starting fresh

Key areas with existing solutions:
- Vector similarity algorithms
- Graph database optimization
- WebRTC signaling servers
- OAuth token management
- Markdown parsing/manipulation
- File watching systems

---

## 📅 Timeline Overview

**Month 1**: Foundation (LLM providers, databases, RAG)  
**Month 2-3**: Plugin MVP (Obsidian focus, ComfyUI start)  
**Month 4-5**: Collaboration (P2P, real-time sync)  
**Month 6+**: Expansion (VS Code, assets, analytics)

---

## 🎉 Quick Wins Completed

- ✅ Ko-Fi/Patreon funding links configured
- ✅ Architectural vision documented
- ✅ Development roadmap created

---

## 📝 Notes

- Creative suite is primary focus, dev tools support it
- Executive dysfunction accommodation is core architecture
- Privacy and user control are non-negotiable
- Leverage Obsidian's built-in features where possible
- Start with working solutions, optimize later

---

**Next Action**: Update reference repositories and begin OAuth research