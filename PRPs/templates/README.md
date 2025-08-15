# PRP Templates

This directory contains comprehensive templates for creating Product Requirement Prompts (PRPs) and Meta-PRPs with systematic, orchestrator-driven coordination.

## Template Types

### 1. Meta-PRP Template (`meta-prp-template/`)

**Purpose**: Comprehensive scaffolded structure for complex multi-phase projects requiring multi-agent coordination.

**Use Case**: Major system transitions, feature implementations, architectural changes, or any project with 3+ distinct priorities.

**Features**:
- Complete directory structure ready to populate
- Executive dysfunction-aware design principles
- Orchestrator integration throughout
- Git worktree strategy for parallel agent work
- Local LLM integration patterns

### 2. Individual PRP Templates

**Basic Templates**:
- `prp_base.md` - Standard PRP structure
- `prp_base_enhanced.md` - Enhanced with orchestrator integration
- `prp_base_typescript.md` - TypeScript/JavaScript projects
- `prp_planning.md` - Planning-focused PRPs
- `prp_spec.md` - Specification PRPs
- `prp_task.md` - Task-focused PRPs

## Using the Meta-PRP Template

### Quick Start

1. **Copy Template**:
   ```bash
   cp -r PRPs/templates/meta-prp-template PRPs/in-progress/{your-project-name}
   cd PRPs/in-progress/{your-project-name}
   ```

2. **Fill Placeholders**: Replace all `{PLACEHOLDER}` values throughout:
   - `{PROJECT_NAME}` - Your project name
   - `{PRIORITY_X_NAME}` - Names for each priority area
   - `{DATE}` - Current date
   - `{TIMELINE}` - Estimated timelines
   - And many others...

3. **Customize Structure**:
   - Rename priority directories (`01-priority-template` → `01-your-priority`)
   - Customize subtask categories within each priority
   - Update navigation links throughout

4. **Initialize Orchestrator**:
   ```bash
   # From your meta-PRP directory
   orchestrator_initialize_session working_directory="$(pwd)"
   ```

5. **Begin Execution**: Start with `00-main-coordination/index.md`

### Template Structure

```
meta-prp-template/
├── README.md                     # Main meta-PRP overview
├── executive-dysfunction-philosophy.md  # ED design principles
├── git-worktree-strategy.md      # Multi-agent coordination strategy
│
├── 00-main-coordination/         # Primary coordination hub
│   ├── index.md                 # ENTRY POINT - Start here
│   ├── index/                   # Auto-generated navigation (working dir)
│   │   └── README.md
│   └── tracking/                # Progress tracking (working dir)
│       ├── README.md
│       └── checklist.md         # Master checklist
│
├── 01-priority-template/         # Priority 1 template
│   ├── index.md                 # Priority coordination
│   ├── index/                   # Auto-generated (working dir)
│   │   └── README.md
│   ├── subtasks/                # Atomic task breakdowns
│   │   ├── 00-category-template/
│   │   │   ├── README.md        # Category overview
│   │   │   └── 01-task-template.md  # Individual task template
│   │   └── 01-category-template/
│   └── tracking/                # Priority-specific tracking
│       └── README.md
│
├── 02-priority-template/         # Priority 2 template (same structure)
├── 03-priority-template/         # Priority 3 template (same structure)
└── 04-priority-template/         # Priority 4 template (same structure)
```

## PRP Lifecycle Management

### Organizational Folders

**Draft** (`PRPs/draft/`): Initial PRP ideas and planning
- PRPs in conceptual stage
- Incomplete requirements gathering
- Status: `[DRAFT]`

**In-Progress** (`PRPs/in-progress/`): Active PRPs being executed
- Currently being worked on
- Orchestrator sessions active
- Status: `[IN-PROGRESS]`

**Completed** (`PRPs/completed/`): Finished PRPs with confirmed results
- All objectives achieved
- Quality validation passed
- Status: `[COMPLETED]`

### Status Tag System

Use status tags in filenames for lifecycle tracking:
- `[DRAFT]project-name.md` - Planning stage
- `[IN-PROGRESS]project-name.md` - Active execution
- `[COMPLETED]project-name.md` - Finished and validated

### Moving Between Stages

```bash
# Draft → In-Progress
mv PRPs/draft/[DRAFT]project-name PRPs/in-progress/[IN-PROGRESS]project-name
# Update status tags throughout files

# In-Progress → Completed  
mv PRPs/in-progress/[IN-PROGRESS]project-name PRPs/completed/[COMPLETED]project-name
# Update status tags and add completion documentation
```

## Template Design Principles

### 1. Executive Dysfunction as First-Class Design Constraint

**Lid Weight Reduction**: 
- Pre-created directory structures eliminate decision paralysis
- Templates reduce cognitive load of starting complex projects
- Clear navigation paths at every level

**Momentum Preservation**:
- Structure survives interruptions and context switches
- Progress tracking at multiple granularities
- Auto-save mechanisms for work preservation

**Pressure Delegation**: 
- Clear handoff mechanisms to specialist agents
- Orchestrator integration for complex coordination
- External structure for internal organization struggles

**Damage Prevention**:
- Git worktree isolation prevents conflicts
- Rollback mechanisms for safe experimentation
- Graceful degradation when overwhelm occurs

### 2. Multi-Agent Orchestrator Integration

**Systematic Coordination**:
- Orchestrator manages complex multi-agent workflows
- Clear task breakdown and assignment patterns
- Artifact-centric approach to preserve detailed work

**Agent Specialization**:
- Templates align with specialist agent types
- Clear context handoff mechanisms  
- Isolated workspaces prevent conflicts

### 3. Local LLM Integration Readiness

**Task Classification**:
- ✅ High readiness: Structured prompts, clear validation
- 🟡 Medium readiness: Some human oversight needed
- ❌ Low readiness: Complex reasoning, creative decisions

**Automation Pathways**:
- Progressive automation from manual → semi-auto → full-auto
- Structured prompt templates for consistent LLM execution
- Category-based task distribution aligned with LLM capabilities

## Template Customization Guidelines

### Adding New Priority Templates

1. **Copy Existing Priority**: Use `01-priority-template` as base
2. **Customize Content**: Update placeholders and structure
3. **Update Navigation**: Link from main coordination and other priorities
4. **Add to Checklist**: Include in master tracking checklist

### Creating Subtask Categories

1. **Copy Category Template**: Use `00-category-template` as base
2. **Define Category Purpose**: Clear scope and objectives
3. **Create Task Templates**: Individual atomic tasks within category
4. **Link Navigation**: Update parent priority index

### Customizing for Specific Project Types

**Code Projects**: Emphasize implementation, testing, CI/CD priorities
**Documentation Projects**: Focus on audit, creation, validation priorities  
**Architecture Projects**: Structure around research, design, implementation, review
**Migration Projects**: Organize by analysis, planning, execution, validation phases

## Quality Standards

### Template Validation Checklist

**Structure Validation**:
- [ ] All directories have README files explaining purpose
- [ ] Navigation links work throughout structure
- [ ] Placeholder values clearly marked with `{BRACES}`
- [ ] Status tags used consistently

**Content Validation**:
- [ ] Executive dysfunction principles integrated throughout
- [ ] Orchestrator integration patterns clear and consistent
- [ ] Git worktree strategy documented where applicable
- [ ] Local LLM readiness classified for tasks

**Usability Validation**:
- [ ] Template can be copied and filled out efficiently
- [ ] Instructions are clear and actionable
- [ ] Examples provided for complex concepts
- [ ] Navigation aids help users find information quickly

## Best Practices

### When Creating New Templates

1. **Start with Existing**: Build on proven templates rather than from scratch
2. **Follow Patterns**: Use established naming, structure, and content patterns
3. **Include Examples**: Provide concrete examples for abstract concepts
4. **Test Thoroughly**: Walk through entire template before publishing

### When Using Templates

1. **Read First**: Review entire template structure before customizing
2. **Fill Systematically**: Replace all placeholders before beginning execution
3. **Maintain Consistency**: Keep naming and structure patterns throughout
4. **Update Navigation**: Ensure all links work after customization

### When Improving Templates

1. **Document Lessons**: Capture what worked well and what didn't
2. **Update Templates**: Incorporate improvements back into base templates
3. **Share Patterns**: Document successful patterns for reuse
4. **Version Control**: Track template evolution for future reference

## Future Automation

These templates are designed for eventual Scriptorium automation:

**Template Management**: Automated template application and customization
**Progress Tracking**: Automated progress detection and reporting
**Quality Gates**: Automated validation of template compliance
**Lifecycle Management**: Automated movement between draft/in-progress/completed

**Current State**: Manual template usage with systematic structure
**Future State**: Scriptorium manages templates, tracks progress, coordinates agents automatically

---

**Remember**: Templates are scaffolding for complex work - they provide structure so you can focus on execution rather than organization.