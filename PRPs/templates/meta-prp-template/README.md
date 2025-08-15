# {PROJECT_NAME} Meta-PRP

**Template Compliance**: Created using [PRPs/templates/meta_prp_structure.md](../meta_prp_structure.md)  
**Philosophy**: Executive Dysfunction-Aware Multi-Agent Coordination  
**Git Strategy**: Worktree isolation for conflict-free parallel development

**Status**: [DRAFT] / [IN-PROGRESS] / [COMPLETED]  
**Meta-PRP ID**: `{PROJECT}_META_PRP_{YEAR}`  
**Created**: {DATE}  
**Estimated Duration**: {TIMELINE}

## 📁 Directory Structure

```directory
{project-name}-meta-prp/
├── 00-main-coordination/       # Main orchestrator coordination hub
│   ├── index.md               # PRIMARY ENTRY POINT - Start here!
│   └── tracking/              # Progress tracking and checklists
│       └── checklist.md       # Master tracking checklist
│
├── 01-{priority-1-name}/      # PRIORITY 1 - {Description}
│   ├── index.md              # Priority coordination
│   └── subtasks/             # Individual tasks
│
├── 02-{priority-2-name}/      # PRIORITY 2 - {Description}
│   ├── index.md              # Priority coordination
│   └── subtasks/             # Individual tasks
│
├── 03-{priority-3-name}/      # PRIORITY 3 - {Description}
│   ├── index.md              # Priority coordination
│   └── subtasks/             # Individual tasks
│
└── 04-{priority-4-name}/      # PRIORITY 4 - {Description}
    ├── index.md              # Priority coordination
    └── subtasks/             # Individual tasks
```

## 🚀 Quick Start

**To use this template:**

1. **Copy Template**: `cp -r PRPs/templates/meta-prp-template PRPs/in-progress/{your-project-name}`
2. **Fill Placeholders**: Replace all `{PLACEHOLDER}` values throughout files
3. **Customize Priorities**: Rename and configure the 4 priority areas
4. **Initialize Orchestrator**: Use `orchestrator_initialize_session` from the new directory
5. **Begin Execution**: Start with `00-main-coordination/index.md`

## 🎯 Priorities Template

| Priority | Task | Status | Completion Date |
|----------|------|--------|----------------|
| **1** | {Priority 1 Description} | [DRAFT] | {Target Date} |
| **2** | {Priority 2 Description} | [DRAFT] | {Target Date} |
| **3** | {Priority 3 Description} | [DRAFT] | {Target Date} |
| **4** | {Priority 4 Description} | [DRAFT] | {Target Date} |

## 🤖 Orchestrator Integration

- **Session ID**: `{To be filled during initialization}`
- **Parent Task**: `{To be filled during initialization}`
- **Working Directory**: `{Current directory path}`
- **Coordination Method**: Multi-agent swarm with git worktree isolation

## 📚 Key Concepts

### What We're Building

**{PROJECT_NAME}**: {High-level description of what this meta-PRP accomplishes}

### Why This Structure

- **Systematic Approach**: {Explain the systematic approach}
- **Agent Coordination**: Designed for multi-agent execution via orchestrator
- **Executive Dysfunction Support**: {How this supports ED principles}

## 🔗 Related Documents

### Template and Design Philosophy

- [PRPs/templates/meta_prp_structure.md](../meta_prp_structure.md) - Template structure used
- [executive-dysfunction-philosophy.md](executive-dysfunction-philosophy.md) - Core design principles
- [git-worktree-strategy.md](git-worktree-strategy.md) - Multi-agent coordination strategy

### Source Context

- {List any source PRPs or documents this meta-PRP builds on}
- {Reference any completed work that informs this meta-PRP}
- {Link to related planning documents}

## ⚡ Next Steps

**PHASE 1**: {Phase 1 Description}

1. **{First Major Step}** (Priority: {High/Medium/Low})
   - {Specific action items}
   - {Expected outcomes}

2. **{Second Major Step}** (Priority: {High/Medium/Low})
   - {Specific action items}
   - {Expected outcomes}

### **Available Context/Inputs**

- {List any existing artifacts or context}
- {Reference any specialist work or analysis}
- {Note any technical requirements or constraints}

## 🎨 Vision

{High-level vision statement for what success looks like}

---

## 🏆 Success Metrics

**Achievement Scores Target**:
- Context Engineering: {Target}/10
- Security Integration: {Target}/10
- Orchestrator Integration: {Target}/10
- Multi-Agent Coordination: {Target}/10
- Executive Dysfunction Design: {Target}/10
- Future Automation Readiness: {Target}/10

**Git Worktree Strategy**: {Will use/Not applicable}

**Next Phase**: {Description of what comes after this meta-PRP}

---

**Remember**: {Key reminders or principles for this specific meta-PRP}