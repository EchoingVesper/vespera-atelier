# Vespera Atelier Development Roadmap

**Created**: 2025-08-19  
**Updated**: 2025-09-01
**Status**: Self-Orchestrating Development Plan  
**Vision**: Template-driven Codex system with immersive automation

---

## 🎯 **CRITICAL INSIGHT**: Self-Bootstrapping Development

The comprehensive architecture documentation reveals a system that can **orchestrate its own development**. Instead of manually planning every detail, we'll use the partially-working Vespera Scriptorium to break down, coordinate, and accelerate the implementation of the revolutionary template-driven Codex system.

## 🚨 **IMMEDIATE PRIORITIES** (Next 1-2 weeks)

### Phase 0: System Activation & Self-Orchestration Setup

**Goal**: Get the existing Scriptorium MCP server fully functional so it can manage its own further development.

#### Priority 1: MCP Server Diagnosis & Repair
- **Issue**: Scriptorium not connecting to Claude Code
- **Action**: Diagnose connection issues, fix MCP server configuration
- **Success Criteria**: Agent spawning works through MCP server
- **Timeline**: 1-3 days

#### Priority 2: Agent-Based Task Orchestration Test
- **Issue**: Agent spawning untested through actual MCP server  
- **Action**: Verify multi-role agent coordination works end-to-end
- **Success Criteria**: Can spawn coordinator agents that manage sub-tasks
- **Timeline**: 1-2 days after MCP fix

#### Priority 3: Documentation Style Guide Creation
- **Issue**: Documentation lacks consistent structure and style
- **Action**: Update `docs/prompts/documentation/documentation_implementation_guide.md` with new Codex architecture
- **Deliverable**: Codex-compatible documentation templates and style guide
- **Timeline**: 2-3 days (can run parallel to MCP fixes)

## 🔄 **SELF-ORCHESTRATION STRATEGY** (Weeks 2-4)

### The Revolutionary Approach

Once the MCP server is working, we'll use it to:

1. **Decompose Architecture Documents**: Use agent coordination to break down each technical document into atomic, implementable tasks
2. **Multi-Coordinator Assignment**: Assign different coordinator roles (Backend Architect, Template System Developer, UI Designer, etc.)
3. **Accelerated Development Cycles**: Let the system organize and prioritize its own development

### Coordinator Role Structure

```yaml
# Example coordinator hierarchy for self-orchestration
project_coordinators:
  - role: "Technical Architect"
    focus: "Core Codex system implementation"
    agents: ["Backend Developer", "Database Designer", "API Developer"]
    
  - role: "Template System Coordinator"  
    focus: "JSON5 template system and dynamic type registration"
    agents: ["Template Engine Developer", "UI Generator", "Validation System Developer"]
    
  - role: "Immersive Environment Coordinator"
    focus: "Environmental adaptation and three-mode components"
    agents: ["Audio Integration Developer", "Lighting Controller", "UI Theme Manager"]
    
  - role: "Documentation Coordinator"
    focus: "Living documentation system and style consistency"
    agents: ["Technical Writer", "Template Creator", "Style Guide Enforcer"]
```

## 📚 **ARCHITECTURAL FOUNDATION** (Already Complete!)

### ✅ **Revolutionary Architecture Documented**

The recent documentation sprint has established a comprehensive foundation:

- **[Codex Architecture](docs/technical/CODEX_ARCHITECTURE.md)**: Universal content system
- **[Template System Architecture](docs/technical/TEMPLATE_SYSTEM_ARCHITECTURE.md)**: User-extensible JSON5 templates  
- **[Dynamic Automation Architecture](docs/technical/DYNAMIC_AUTOMATION_ARCHITECTURE.md)**: Tag-driven automation
- **[Multi-Project Vault Organization](docs/technical/MULTI_PROJECT_VAULT_ORGANIZATION.md)**: Project management
- **[UI Architecture Three-Panel Design](docs/technical/UI-Architecture-Three-Panel-Design.md)**: Interface design
- **[Real-World Integration Scenarios](docs/user-guides/REAL_WORLD_INTEGRATION_SCENARIOS.md)**: Concrete use cases

### 🎯 **Next Phase**: Implementation Orchestration

**Week 2-3**: Use working MCP server to break down each architectural document into:
- Granular implementation tasks
- Dependency relationships  
- Coordinator role assignments
- Development timeline optimization

**Week 3-4**: Begin atomic implementation with continuous system feedback

## 🔄 **MIGRATION STRATEGY**: Task System → Codex System

### Incremental Self-Improvement Approach

The beauty of the new architecture is that we can **use the current task system to orchestrate its own evolution into the Codex system**:

#### Phase A: Task System Enhancement (Week 2)
- Enhance current task system with multi-coordinator roles
- Add hierarchical task dependencies  
- Implement agent-based task decomposition

#### Phase B: Parallel Codex Development (Week 3-4)
- Develop core Codex interfaces alongside task system
- Create basic template loading and validation
- Build universal `.codex.md` file format support

#### Phase C: Hybrid Operation (Week 4-5)
- Run both systems in parallel
- Migrate high-value tasks to Codex format
- Use Codex system to manage remaining task system migration

#### Phase D: Complete Migration (Week 6+)
- All task orchestration runs on Codex system
- Legacy task system removed
- **System now developing itself entirely through templates and automation**

## 🚀 **IMPLEMENTATION ACCELERATION PLAN**

### The Self-Development Advantage

Once the MCP server is working and agent coordination is verified, development speed should increase exponentially:

**Week 1**: Manual fixes and testing  
**Week 2**: Agent-assisted task breakdown (2-3x speed increase)  
**Week 3**: Multi-coordinator parallel development (5-10x speed increase)  
**Week 4**: Template-driven automation kicks in (10-50x speed increase for repetitive tasks)  
**Week 5+**: Self-optimizing development cycles (limited only by complexity, not coordination overhead)

### Key Acceleration Triggers

1. **Agent Spawning Works**: Can delegate specialized tasks to focused agents
2. **Task Decomposition Automation**: Architecture documents auto-convert to actionable tasks
3. **Coordinator Role Assignment**: Parallel development streams with minimal conflicts
4. **Template System Online**: Repetitive patterns become instant template generations
5. **Self-Optimization**: System begins improving its own development processes

## 📊 **SUCCESS METRICS** (Redefined)

### Traditional Metrics (Old Approach)
❌ ~~Months of manual development~~  
❌ ~~Sequential implementation phases~~  
❌ ~~Manual project coordination~~  

### Self-Orchestrating Metrics (New Approach)  
✅ **MCP Connection**: Fixed within 1-3 days  
✅ **Agent Coordination**: Verified within 1 week  
✅ **Task Decomposition**: Architecture → Tasks within 2 weeks  
✅ **Parallel Development**: Multiple coordinators active by week 3  
✅ **Template Generation**: Core Codex system by week 4  
✅ **Self-Development**: System managing its own evolution by week 5  

### Ultimate Success: **System Developing Itself**
The moment the system can:
- Generate its own development tasks
- Assign coordinators automatically  
- Create templates for new features
- Optimize its own development process
- **Transform from "project" to "living system"**

---

## 🔍 **TECHNICAL FOUNDATIONS** (From Previous Plan)

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

## 📝 **CRITICAL DOCUMENTATION PRIORITIES**

### Style Guide & Template Creation (Parallel Priority)

**Issue**: Current documentation lacks consistent structure and style, preventing effective coordination.

**Immediate Actions**:
1. **Update Documentation Guide**: Revise `docs/prompts/documentation/documentation_implementation_guide.md` to align with new Codex architecture
2. **Create Codex-Compatible Templates**: Build documentation templates that work with the template system
3. **Establish Style Consistency**: Ensure all architectural documents follow the same patterns

**Why Critical**: Documentation templates will become **Codex templates**, serving as the foundation for the template system itself.

### Living Documentation System

Once the Codex system is working, documentation will become **self-updating**:
- Architecture changes automatically update related documents
- Code implementations auto-generate API documentation  
- User scenarios automatically create corresponding templates
- **Documentation becomes part of the reactive automation system**

---

## 🎯 **IMMEDIATE NEXT ACTIONS** (This Week)

### Day 1-2: MCP Server Diagnosis
1. Check MCP server connection logs
2. Verify Claude Code configuration
3. Test basic MCP tool functionality
4. Fix any connection or configuration issues

### Day 2-3: Agent Coordination Test  
1. Test agent spawning through working MCP server
2. Verify multi-role task coordination
3. Confirm hierarchical task management works
4. Document any remaining agent coordination issues

### Day 3-5: Documentation Style Guide
1. Update documentation implementation guide with Codex architecture
2. Create templates for technical documentation  
3. Standardize existing architectural documents
4. Prepare documentation system for Codex migration

**Success Criteria for Week 1**:
- ✅ MCP server connects and works reliably
- ✅ Agents can be spawned and coordinated through MCP
- ✅ Documentation has consistent structure and templates
- ✅ Ready to begin automated task decomposition in Week 2

---

## 🚀 **THE VISION**: From Manual to Magical

**Current State**: Manually planning and coordinating development  
**Week 2**: Agents helping break down and coordinate tasks  
**Week 4**: Template system generating new features automatically  
**Week 6**: **System fully self-developing through intelligent automation**  

The goal is not just to build a system, but to build a system that **builds itself** - transforming development from manual work into intelligent orchestration.

---

**Next Action**: Diagnose and fix MCP server connection issues to enable self-orchestrating development