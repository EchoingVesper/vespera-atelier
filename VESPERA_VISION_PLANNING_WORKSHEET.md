# Vespera Scriptorium Vision Implementation Planning Worksheet

**Date Created**: 2025-08-17  
**Purpose**: Comprehensive planning for complete Vespera Scriptorium vision implementation  
**Instructions**: Fill out each section with your decisions/preferences, then return for meta-PRP creation

---

## 🎯 **CORE VISION SUMMARY**

**What we're building**: Repository of information with automatic organization and "Discord for LLMs" task management

**Key Components**:

- Task ecosystem with recursive breakdown
- Multi-database knowledge management (Core + Vector + Graph)
- Role-based LLM routing and execution
- Comprehensive artifact tracking
- Automated workflow hooks
- Human-readable + LLM-optimized organization

---

## 🗃️ **SECTION 1: DATABASE ARCHITECTURE**

### **Current State**: Single SQLite database

### **Vision**: Triple database ecosystem

**Q1.1**: Vector Database Choice

- [x] Chroma (embedded, Python-native)
- [ ] Weaviate (more features, external service)
- [ ] FAISS (Facebook, fast but basic)
- [ ] Qdrant (Rust-based, high performance)
- [ ] Other: ________________________________
- **Your choice**: **Chroma - embedded, developer-friendly, persistent storage, good performance for most use cases**

**Q1.2**: Graph Database Choice  

- [ ] Neo4j (industry standard, requires service)
- [ ] NetworkX (Python-native, in-memory)
- [ ] SQLite with graph tables (simple, embedded)
- [ ] Redis Graph (if using Redis)
- [x] KuzuDB (embedded, Cypher support, extremely fast)
- [ ] Other: ________________________________
- **Your choice**: **KuzuDB - embedded like SQLite, supports Cypher queries, 18-188x faster than Neo4j, NetworkX integration, perfect for embedded use**

**Q1.3**: Deployment Preference

- [x] All embedded (easier setup, single process)
- [ ] External services (more powerful, complex setup)
- [ ] Hybrid (SQLite + Vector embedded, Graph external)
- **Your choice**: **All embedded - KuzuDB and Chroma are both pip-installable with no external services**

**Q1.4**: Project Root Restriction

- [ ] STRICT: Only one .vespera_scriptorium per project root
- [x] FLEXIBLE: Allow subdirectory instances for large projects
- **Your choice**: **FLEXIBLE with hierarchical context nesting - master instance manages child instances via event-driven registration system**

---

## 🤖 **SECTION 2: ROLE SYSTEM ARCHITECTURE**

### **Current State**: Basic role definitions

### **Vision**: User-editable role templates with LLM associations

**Q2.1**: Role Template Structure

```yaml
# Proposed structure - modified based on Roo Code inspiration:
role_name:
  display_name: "Human-readable name"
  description: "What this role does"
  system_prompt: "Base prompt for this role"
  preferred_llm: "local:ollama:llama3" # Local-first approach
  fallback_llms: ["claude-3-5-sonnet", "gpt-4"]
  capabilities:
    - "file_read"
    - "file_write" 
    - "spawn_tasks"
  restrictions:
    - "max_file_changes: 5"
    - "single_codeblock_only: true"
  context_requirements:
    - "Documentation types this role needs"
    - "Code patterns this role should understand"
  task_types:
    - "implementation"
    - "research" 
  validation_rules:
    - "What to check before assigning this role"
```

- **Is this structure good?**: **Yes, enhanced with Roo Code-style capability restrictions**
- **Changes needed**: **Added capabilities/restrictions system for granular control**

**Q2.2**: LLM Association Strategy

- [x] Role defines preferred LLM + fallbacks
- [x] User can override per-task
- [ ] System-wide LLM mapping with role preferences
- **Your choice**: **Role-based preferences with user override capability, local-first with API fallbacks**

**Q2.3**: LLM Validation & Remapping

- [x] Check availability at startup, warn about missing LLMs
- [x] Auto-remap to available LLMs with user confirmation
- [ ] Fail fast if required LLMs unavailable
- [x] Interactive setup wizard for LLM configuration
- **Your choice**: **All of the above - comprehensive validation with graceful fallbacks**

**Q2.4**: Role Template Location

- [ ] Project-specific roles in .vespera_scriptorium/roles/
- [ ] Global roles + project overrides
- [x] Both global and project with inheritance
- **Your choice**: **Hierarchical system - global defaults, project overrides, instance-specific customization**

---

## 📋 **SECTION 3: TASK SYSTEM REDESIGN**

### **Current State**: Basic task with minimal metadata

### **Vision**: Rich task ecosystem with comprehensive context

**Q3.1**: Task Context Assembly

```yaml
# For each task, context includes:
task_context:
  specialist_context: "System prompt from role template"
  task_prompt: "User prompt from creating LLM/user"
  linked_documents: 
    automatic: "Hooks based on file types, semantic similarity"
    manual: "User-specified document links"
    graph: "Related documents from graph database"
  project_context: "Project-wide documentation"
  parent_context: "Context from parent tasks"
  capability_restrictions: "What this agent can/cannot do"
```

- **Is this comprehensive enough?**: **Yes, enhanced with capability restrictions**
- **Missing components**: **Added capability restrictions for Roo Code-style agent management**

**Q3.2**: Session → Task Hierarchy Transition

- [x] Remove session concept entirely
- [x] Top-level tasks replace sessions  
- [x] Migrate existing sessions to top-level tasks
- [ ] Keep sessions for backward compatibility
- **Your choice**: **Complete transition to hierarchical task system, migration path for existing data**

**Q3.3**: Task Execution Model

- [x] Tasks spawn LLMs directly (Scriptorium manages)
- [ ] Tasks request LLM execution from external system
- [ ] Hybrid (internal for local, external for API LLMs)
- **Your choice**: **Direct management with local-first approach, API fallbacks as needed**

**Q3.4**: Human-in-the-Loop Integration

- [x] "Call home" button/command in task execution
- [x] Automatic escalation based on task complexity
- [x] User approval required for certain actions
- [x] Notification system for task status changes
- **Your choice**: **Comprehensive human oversight with escalation paths for complex decisions**

---

## 🔗 **SECTION 4: DOCUMENT LINKING SYSTEM**

### **Current State**: Minimal document association

### **Vision**: Rich document ecosystem with automatic linking

**Q4.1**: Automatic Document Hooks

```yaml
# Enhanced file type hooks:
file_type_hooks:
  ".py": ["project_python_docs", "coding_standards", "api_docs", "roo_code_patterns"]
  ".md": ["writing_guidelines", "project_overview", "prp_templates"]
  ".test.py": ["testing_guidelines", "test_patterns"]
  ".sql": ["database_schema", "migration_docs"]
  ".js/.ts": ["javascript_standards", "framework_docs"]
  ".vue/.jsx": ["component_patterns", "ui_guidelines"]
```

- **Add/modify file type hooks**: **Enhanced with creative file types and PRP templates**

**Q4.2**: Vector Search Integration

- [x] Semantic similarity for document suggestions
- [x] Automatic embedding of all project documents
- [x] User can accept/reject suggested documents
- [x] Machine learning improves suggestions over time
- **Your choice**: **Full semantic integration with Chroma for intelligent document discovery**

**Q4.3**: Graph Database Relationships

```yaml
# Enhanced relationship types with KuzuDB:
document_relationships:
  depends_on: "Document A needs Document B"
  implements: "Code implements specification"
  tests: "Test documents validate implementation"
  documents: "Documentation explains code"
  references: "Cross-references between documents"
  inspires: "Creative inspiration links"
  templates: "Template-instance relationships"
```

- **Add/modify relationship types**: **Added creative and template relationships for expanded use**

**Q4.4**: Document Organization Strategy

- [x] Human-readable folders + database tracking
- [ ] Dual copies (human + LLM optimized)
- [ ] Database-only with generated human navigation
- [x] Hybrid with smart linking
- **Your choice**: **Hybrid approach - human-readable structure with intelligent database-driven linking**

---

## ⚡ **SECTION 5: WORKFLOW AUTOMATION & HOOKS**

### **Current State**: Manual task execution

### **Vision**: Automated workflow orchestration

**Q5.1**: Hook System Priorities (rank 1-10)

- [9] Git operations (branch creation, commits, PRs)
- [8] Test execution after code changes  
- [7] Documentation updates after implementation
- [6] Code review task spawning
- [5] CI/CD integration and status checking
- [10] File type-based context loading
- [10] Automatic task breakdown for complex work
- [8] Progress summarization and reporting
- [9] Dependency tracking and validation
- [4] Security and compliance checking

**Q5.2**: Template System Overhaul

```yaml
# Enhanced template structure based on Roo Code patterns:
task_template:
  name: "implementation"
  roles: ["orchestrator"] # Who can create this task type
  pre_tasks:
    - type: "git_branch_create"
      automatic: true
    - type: "research"  
      role: "researcher"
      automatic: false
  main_task:
    role: "coder"
    capability_restrictions: ["single_file_only", "max_changes_10"]
    context_requirements: ["implementation_docs", "coding_standards"]
  post_tasks:
    - type: "testing"
      role: "tester" 
      automatic: true
    - type: "documentation"
      role: "documenter"
      automatic: false
  validation:
    - "Code compiles without errors"
    - "Tests pass"
    - "Documentation updated"
```

- **Modify template structure**: **Enhanced with capability restrictions and granular role management**
- **Add other template types**: **Creative templates (story_writing, asset_creation), research templates, review templates**

**Q5.3**: Automatic Task Spawning Strategy

- [ ] Spawn all sub-tasks immediately
- [x] Spawn pre-tasks, wait for main, spawn post-tasks
- [x] User approval for each spawning decision
- [x] Smart spawning based on task complexity
- **Your choice**: **Intelligent spawning with user oversight and complexity-based decisions**

---

## 🎨 **SECTION 6: ARTIFACT SYSTEM REDESIGN**

### **Current State**: ID-based storage, limited tracking

### **Vision**: Comprehensive tracking with human navigation

**Q6.1**: Artifact Tracking Scope

- [ ] Only explicit task outputs (current)
- [x] All LLM messages and responses
- [x] All file changes and creations
- [x] User interactions and decisions
- [x] System actions and automations
- **Your choice**: **Comprehensive tracking for complete project history and learning**

**Q6.2**: Human-Readable Organization

Proposed structure:

```directory
.vespera_scriptorium/
├── artifacts/
│   ├── by-task/          # Task-based organization
│   ├── by-date/          # Chronological organization  
│   ├── by-type/          # Type-based (code, docs, tests, creative)
│   └── by-id/           # Database ID (for system use)
├── databases/
│   ├── core.db          # SQLite task database
│   ├── vector/          # Chroma database files
│   └── graph/           # KuzuDB database files
└── config/
    ├── roles/           # Role templates
    ├── templates/       # Task templates
    └── hooks/           # Automation hooks
```

- **Modify structure**: **Enhanced with creative content types and cleaner database organization**

**Q6.3**: Codex System Integration

- [x] Generate web-based artifact browser
- [x] Command-line artifact navigation
- [x] Integration with external tools (VS Code, Obsidian)
- [x] API for custom integrations
- **Your choice**: **Full integration across all platforms with dual-plugin strategy**

---

## 🚀 **SECTION 7: IMPLEMENTATION STRATEGY**

### **Massive Scope**: Months of work across multiple domains

**Q7.1**: Implementation Priority (rank 1-8)

- [1] Clean Architecture migration (start fresh)
- [2] Role system overhaul (borrow from Roo Code)
- [6] Vector database integration (Chroma)
- [5] Graph database integration (KuzuDB)
- [3] Document linking system
- [4] Automated workflow hooks
- [7] Multi-LLM execution environment
- [8] Advanced artifact system

**Q7.2**: Development Approach

- [ ] Sequential phases (complete one before next)
- [ ] Parallel development with integration points
- [x] MVP approach (basic version first, iterate)
- [x] Component-by-component replacement
- **Your choice**: **MVP with modular microservices - build working system quickly, enhance iteratively**

**Q7.3**: Backward Compatibility

- [ ] Maintain compatibility during transition
- [x] Breaking changes acceptable (pre-release)
- [x] Migration tools for existing data
- [ ] Fresh start (archive old, build new)
- **Your choice**: **Option A archiving strategy with migration tools for valuable data**

**Q7.4**: Testing Strategy

- [ ] TDD (tests first, then implementation)
- [x] Implementation first, comprehensive tests after
- [x] Parallel test development
- [x] Integration testing focus over unit testing
- **Your choice**: **Mixed approach - integration tests for reliability, unit tests for critical components**

**Q7.5**: Agent Spawning for Implementation

- [x] Use current meta-PRP approach for all phases
- [x] Spawn specialist agents for each component
- [ ] Mix of agent spawning and manual development
- [x] Focus on automation-enabling components first
- **Your choice**: **Heavy use of meta-PRP system with specialist agents, building tools that improve the building process**

---

## 💡 **SECTION 8: ADDITIONAL CONSIDERATIONS**

**Q8.1**: Performance Requirements

- Target number of concurrent tasks: **10-50 (scalable to hundreds for large creative projects)**
- Maximum database size expectations: **10GB+ for large creative projects with assets**
- Acceptable startup time: **< 5 seconds for basic functionality**
- Memory usage constraints: **Reasonable for local development (2-8GB)**

**Q8.2**: Integration Requirements  

- Must integrate with: **Obsidian, VS Code, Git, local LLMs (Ollama), API LLMs (Claude, GPT)**
- Should integrate with: **ComfyUI, Blender, DAWs, image/video tools**
- Future integration plans: **Full creative suite with asset management**

**Q8.3**: User Experience Priorities

- Most important for CLI users: **Reliable automation, clear status, easy task management**
- Most important for GUI users (future): **Visual project overview, drag-drop workflows, rich previews**
- Automation vs control balance: **Automation by default with easy override/manual control**

**Q8.4**: Deployment Considerations

- Target platforms: **Windows, macOS, Linux (desktop focus)**
- Installation complexity acceptable: **Single installer with guided setup**
- Dependencies management strategy: **Embedded everything possible, clear instructions for required externals**

---

## 🔍 **SECTION 9: OPEN QUESTIONS & CONCERNS**

**Q9.1**: Technical Concerns

- Biggest technical risk: **Complexity of hierarchical instance management and API communication**
- Most complex component: **Event-driven coordination between nested Scriptorium instances**
- Dependencies you're worried about: **KuzuDB maturity, Chroma scaling, plugin maintenance burden**

**Q9.2**: Design Uncertainties  

- Areas needing more research: **Plugin architecture for dual VS Code/Obsidian approach**
- Decisions you want to revisit: **Whether to build custom UI eventually vs staying with plugins**
- Alternative approaches to consider: **WebSocket vs REST for real-time collaboration**

**Q9.3**: Scope Management

- Components that could be deferred: **Advanced asset management, real-time collaboration, custom UI**
- Must-have vs nice-to-have features: **Must: reliable task breakdown, role restrictions, document linking. Nice: advanced automation, asset integration**
- Stopping points for MVP: **Working task system with role restrictions, basic document management, dual plugin support**

---

## ✅ **SECTION 10: IMPLEMENTATION READINESS**

**Q10.1**: Ready to Proceed?

- [x] Yes, create comprehensive meta-PRP for full vision
- [ ] Yes, but start with specific subset: ___________
- [ ] Need more research/discussion on: _____________
- [ ] Want to prototype specific components first: ___

**Q10.2**: Initial Focus Area
If starting with subset, which component first?

- **Your choice**: **Start fresh with Option A archiving, then build modular backend with role system**
- **Reasoning**: **Need solid foundation before adding complexity; role system is core to everything else**

**Q10.3**: Success Criteria
How will we know this implementation succeeded?

- **Measurable outcomes**: **Can manage creative project end-to-end, tasks break down properly, agents stay in capability bounds, better than current system for daily workflow**
- **User experience goals**: **Seamless dual-plugin experience, reliable automation, clear project oversight**  
- **Technical benchmarks**: **< 5s startup, handles 50+ concurrent tasks, stable nested instance communication**

---

## 📋 **COMPLETION CHECKLIST**

- [x] All sections reviewed and filled out
- [x] Priority rankings assigned where requested
- [x] Choices made for all decision points
- [x] Open questions documented
- [x] Implementation readiness confirmed

**Next Step**: Create meta-PRP with these specifications!

---

## 🏗️ **IMPLEMENTATION DIRECTIVES FOR CLAUDE CODE**

### **Repository Transition Strategy (Option A)**

1. **Archive Current Branch**:

   ```bash
   git checkout main
   git checkout -b archive/v1-legacy  
   git push origin archive/v1-legacy
   git tag v1-archive-$(date +%Y%m%d)
   git push origin --tags
   ```

2. **Preserve PRPs System & Archive Content**:

   ```bash
   git checkout main
   # Keep the PRP system but archive existing PRPs
   mkdir -p archive/v1-prps
   mv PRPs/completed/* archive/v1-prps/ 2>/dev/null || true
   mv PRPs/draft/* archive/v1-prps/ 2>/dev/null || true
   
   # Archive old implementation files but keep .claude/commands/PRPs structure
   git rm -rf scriptorium/ src/ tests/ 2>/dev/null || true
   # Keep: .claude/commands/PRPs/, PRPs/templates/, PRPs/README.md
   # Archive: completed PRPs, draft PRPs, old code
   ```

3. **New Project Structure**:

   ```directory
   vespera-atelier/
   ├── README.md                    # NEW: Explain rewrite, vision, current status
   ├── ARCHITECTURE.md              # NEW: Technical architecture decisions
   ├── .claude/                     # MODIFIED: Update for new architecture
   │   ├── commands/
   │   │   └── PRPs/               # KEEP: Proven meta-PRP system
   │   │       ├── meta-prp-*.md   # KEEP: Your refined meta-PRP commands
   │   │       └── ...
   │   └── settings.json           # NEW: Updated for new project structure
   ├── PRPs/                       # KEEP: PRP system structure
   │   ├── templates/              # KEEP: Your refined PRP templates
   │   ├── completed/              # EMPTY: For new PRPs
   │   ├── draft/                  # EMPTY: For new PRPs
   │   └── README.md               # KEEP: PRP documentation
   ├── archive/
   │   └── v1-prps/               # OLD: Archived PRPs from v1
   ├── scriptorium/                # NEW: Core backend service
   │   ├── core/                   # Database management
   │   ├── roles/                  # Role system (inspired by Roo Code)
   │   ├── tasks/                  # Task management
   │   └── api/                    # REST API for plugins
   ├── plugins/
   │   ├── obsidian/              # NEW: Obsidian plugin
   │   └── vscode/                # NEW: VS Code extension
   ├── docs/                      # NEW: Comprehensive documentation
   ├── CLAUDE.md                  # NEW: Updated for new architecture
   └── scripts/                   # NEW: Development and deployment scripts
   ```

### **Critical First Steps**

1. **Create Explanatory README**:
   - Explain this is a complete rewrite of the project
   - Describe the vision for creative suite management
   - Set expectations: "Currently under heavy development, not ready for use"
   - Reference archive branch for old version and archived PRPs
   - Roadmap with phases

2. **Update Claude Code Integration**:
   - **NEW CLAUDE.md**: Remove orchestrator-specific rules, focus on Claude Code capabilities
   - **Update .claude/settings.json**: Configure for new project structure
   - **Keep proven .claude/commands/PRPs/**: Your refined meta-PRP system has proven valuable
   - **Adapt PRP templates**: Update for new architecture but keep successful patterns
   - **Note**: Remove orchestrator system references, leverage Claude Code's built-in tasks/todos

3. **Architecture Documentation**:
   - Database choices (SQLite + KuzuDB + Chroma)
   - Plugin strategy (dual Obsidian/VS Code)
   - Microservices approach
   - Local-first LLM strategy
   - How PRPs system integrates with new architecture

4. **License Decisions**:
   - Confirm AGPL 3.0 for copyleft protection
   - Document inspiration sources (Roo Code Apache 2.0 compatibility)
   - Clear attribution for borrowed concepts

### **Development Phases**

#### **Phase 1: Foundation (2-3 months)**

- [ ] Modular backend architecture
- [ ] Role system with capability restrictions (Roo Code-inspired)
- [ ] Basic task management with hierarchy
- [ ] Essential CLI interface
- [ ] Database abstraction layer

#### **Phase 2: Intelligence (2-3 months)**  

- [ ] Document linking and hooks
- [ ] Vector search integration (Chroma)
- [ ] Graph relationships (KuzuDB)
- [ ] Workflow automation
- [ ] Plugin APIs

#### **Phase 3: Interfaces (3-4 months)**

- [ ] Obsidian plugin development
- [ ] VS Code extension development
- [ ] Cross-plugin communication
- [ ] User workflow testing

#### **Phase 4: Expansion**

- [ ] Asset management
- [ ] Real-time collaboration
- [ ] Advanced creative tools
- [ ] ComfyUI integration

---

**Notes Section**:

This represents a complete architectural reboot based on lessons learned from v1 and research into modern practices. The focus is on building a modular, scalable foundation that can grow into the full creative suite vision while being immediately useful for project management and creative work.

**Preserving What Works**: The PRP system (.claude/commands/PRPs/ and templates) has proven invaluable for orchestrating complex development tasks and will be retained and adapted for the new architecture. Existing PRPs will be archived to preserve lessons learned while starting fresh for v2 development.

Key inspirations: Roo Code's role system, Archon's microservices approach, modular Unix philosophy, and Japanese design principles for simplicity and reliability.

The dual-plugin strategy allows leveraging existing mature editors while building toward eventual standalone creative tools.
