# Updated GitHub Issues Plan - Post-PR #55

## Original 12 Issues Status Analysis

### Issues That Can Be CLOSED (Already Resolved):
- **Issue #43**: Rust-File-Ops Integration - ✅ FULLY RESOLVED (security wrapper complete, needs binary build)
- **Issue #44**: Default Tool Disabling with SDK - ✅ FULLY RESOLVED (tool management complete)
- **Issue #51**: Bindery Integration and Custom File Tools - ✅ FULLY RESOLVED (service layer complete)
- **Issue #40**: Session Persistence - ✅ FULLY RESOLVED (30-second auto-save implemented)
- **Issue #52**: Chat Provider Implementations - ✅ FULLY RESOLVED (all providers complete, no TODOs)
- **Issue #48**: Security & Performance from PR #47 - ✅ FULLY RESOLVED (all feedback addressed)

### Issues That Need UPDATING (Partially Complete):
- **Issue #49, #50, #41, #42**: Context UI Issues - PARTIALLY COMPLETE
  - ✅ Discord-like multi-server interface added
  - ❌ Context foldout still needed
  - **Action**: Update with our new Issue #3 content

### Issues That Remain OPEN (Not Started):
- **Issue #7**: Multiple TODOs in Provider Implementations - NOT STARTED
  - **Note**: This conflicts with closure summary saying providers are complete
  - **Action**: Verify actual state and close if complete

## Overlap Analysis Between Old and New Issues

### Direct Overlaps:
1. **Old Issues #49, #50, #41, #42** → **New Issue #3** (Context Foldout UI)
2. **Old Issue #43** → **New Issue #1** (Rust-file-ops - only binary build remains)
3. **Old Issue #44** → **New Issue #4** (Tool overrides - verification needed)
4. **Old Issue #51** → **New Issue #5** (Bindery - runtime verification needed)

### No Overlap (New Issues):
- Issue #2: Resource Disposal Patterns (NEW)
- Issue #6-9: Testing & Performance (NEW)
- Issue #10-13: Optimization & Tech Debt (NEW)
- Issue #14: Spec-Driven Development (NEW)

---

# Final Consolidated GitHub Issues

## High Priority Issues (2)

### Issue 1: Complete rust-file-ops Binary Build and Integration
**Updates Issue:** #43
**Title:** Build and integrate rust-file-ops binary
**Labels:** integration, performance, rust, vs-code-extension, high-priority

#### Description
The rust-file-ops security wrapper has been created but the actual Rust binary needs to be built and integrated.

#### Remaining Tasks
- [ ] Build rust-file-ops binary
- [ ] Configure build process in package.json
- [ ] Wire up binary to existing security wrapper
- [ ] Verify 3-15x performance gains are achieved
- [ ] Add performance benchmarks
- [ ] Test file operations at scale

---

### Issue 2: Add Resource Disposal Patterns to Large Analyzer Classes
**New Issue**
[Content remains the same as original Issue #2]

---

## Medium Priority Issues (7)

### Issue 3: Implement Context Foldout UI Component
**Updates Issues:** #49, #50, #41, #42
[Content remains the same with note about partial completion]

### Issues 4-9: [Keep as originally defined]

---

## Low Priority Issues (4)

### Issues 10-13: [Keep as originally defined]

---

## Planning Issue (Enhanced with BMAD Method)

### Issue 14: Implement Hybrid Spec-Driven Development System
**Title:** Implement Hybrid Spec-Driven Development System with Codex Integration
**Labels:** enhancement, architecture, planning, codex-integration, meta, bmad-method
**Priority:** Planning Phase (Not for immediate implementation)

#### Vision
Transform Vespera Forge's development process by combining:
1. **GitHub's spec-kit** - Lightweight specification management
2. **BMAD Method** - Context-engineered development with AI agents
3. **Vespera's Codex System** - Universal content management

This creates a unified, AI-enhanced knowledge management system for both technical specifications and creative content.

#### Background
After completing our massive TypeScript cleanup (431 → 0 errors), we've learned valuable lessons about the importance of structured planning. We can combine the best of three methodologies:
- **GitHub spec-kit**: Simple, effective spec management
- **BMAD Method**: Agentic planning with context preservation
- **Codex System**: Our existing universal content framework

#### Key Innovations from BMAD Method

##### 1. Agentic Planning Phase
```yaml
specAgents:
  analyst:
    role: "Requirements Analysis"
    output: "Detailed PRD with acceptance criteria"
  architect:
    role: "Technical Architecture"
    output: "Architecture decisions and system design"
  projectManager:
    role: "Task Breakdown"
    output: "Hyper-detailed development stories"
```

##### 2. Context-Engineered Development
- Each spec becomes a "context-rich story file"
- Full implementation details embedded in specs
- No context loss between planning and implementation
- AI agents can understand complete requirements

##### 3. Human-in-the-Loop Refinement
- Specs are iteratively refined with human feedback
- AI generates initial drafts, humans validate and enhance
- Continuous improvement through usage

#### Proposed Architecture

```typescript
interface VesperaSpec extends CodexEntry {
  type: 'technical-spec';
  metadata: {
    specNumber: string;        // "VSF-001"
    status: SpecStatus;
    category: SpecCategory;
    
    // BMAD-inspired additions
    agents: {
      analyst?: AgentContribution;
      architect?: AgentContribution;
      projectManager?: AgentContribution;
    };
    
    // Context engineering
    context: {
      requirements: DetailedPRD;
      architecture: ArchitectureDecisions;
      implementation: DevelopmentStories[];
      dependencies: CodexId[];
    };
    
    // GitHub spec-kit compatibility
    implementationPR?: string;
    relatedIssues: string[];
  };
}
```

#### Phased Implementation Plan

**Phase 0: Research & Design (Current)**
- [ ] Study GitHub spec-kit implementation
- [ ] Analyze BMAD method's context engineering
- [ ] Design hybrid system architecture
- [ ] Create proof-of-concept spec

**Phase 1: Basic Spec System (Week 1)**
- [ ] Implement spec directory structure
- [ ] Create spec templates (GitHub-style)
- [ ] Add basic spec lifecycle management
- [ ] Manual spec tracking

**Phase 2: Agentic Planning Integration (Week 2-3)**
- [ ] Integrate AI agents for spec generation
- [ ] Implement analyst agent for requirements
- [ ] Implement architect agent for design
- [ ] Add human-in-the-loop refinement UI

**Phase 3: Context Engineering (Week 4-5)**
- [ ] Create context-rich story files
- [ ] Embed implementation details in specs
- [ ] Link specs to code implementation
- [ ] Add spec compliance validation

**Phase 4: Codex Integration (Week 6-7)**
- [ ] Extend Codex types for specs
- [ ] Create spec viewer in VS Code
- [ ] Implement cross-referencing
- [ ] Add search and filtering

**Phase 5: Self-Hosting (Week 8+)**
- [ ] Use Vespera to manage Vespera development
- [ ] AI agents create specs for new features
- [ ] Automated spec-to-implementation workflow
- [ ] Continuous self-improvement

#### Benefits Over Single Approach

**vs GitHub spec-kit alone:**
- AI-assisted spec generation
- Context preservation through development
- Automated story breakdown

**vs BMAD Method alone:**
- Lighter weight for small features
- Better integration with existing GitHub workflow
- Codex system provides broader content management

**vs Current approach:**
- Structured planning prevents "12 issues at once" chaos
- AI assistance reduces planning overhead
- Context preservation improves implementation accuracy

#### Success Metrics
- Reduction in planning-to-implementation time
- Improved spec compliance in implementations
- Reduced context loss between phases
- Developer satisfaction scores
- AI agent contribution quality

#### Example Workflow

1. **Human Request**: "Add dark mode to the extension"
2. **Analyst Agent**: Generates PRD with user stories
3. **Architect Agent**: Designs theme system architecture
4. **PM Agent**: Creates detailed implementation stories
5. **Human Review**: Refines and approves spec
6. **Codex Integration**: Spec becomes searchable knowledge
7. **Implementation**: Developers have full context
8. **Validation**: Automated spec compliance checking

---

## Summary of Actions Required

### For GitHub Issues:
1. **CLOSE** Issues: #43, #44, #51, #40, #52, #48 (6 issues)
2. **UPDATE** Issues: #49, #50, #41, #42 → Merge into new Context Foldout issue
3. **VERIFY** Issue: #7 (Provider TODOs) - may already be complete
4. **CREATE** New Issues: 14 issues as defined above

### Issue Distribution:
- **High Priority:** 2 issues
- **Medium Priority:** 7 issues
- **Low Priority:** 4 issues
- **Planning:** 1 enhanced spec-driven development issue

### Next Steps:
1. Close the 6 completed issues with resolution notes
2. Update the 4 context UI issues with new requirements
3. Create the 14 new issues as defined
4. Link all issues to PR #55 for traceability