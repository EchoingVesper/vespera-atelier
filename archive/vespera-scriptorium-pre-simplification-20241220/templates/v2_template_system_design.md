# V2 Template System Design

## Overview

Convert V1 command prompts and PRP templates into reusable V2 task trees while preserving the rich context and executive dysfunction design principles that made V1 effective.

## V1 Analysis Summary

### Key V1 Strengths to Preserve

1. **Rich Context Engineering**: 697 lines of meta-prp-create.md contains comprehensive workflow patterns
2. **Executive Dysfunction Design**: Pre-created structures, numbered priorities, decision elimination
3. **Multi-Agent Coordination**: Orchestrator integration with specialist role assignments
4. **Systematic Approach**: Research-first methodology, pattern recognition, infrastructure focus
5. **Validation Framework**: 5-stage validation with automated quality gates

### V1 Template Patterns Identified

- **Scaffolded Structure**: Template copying from `PRPs/templates/meta-prp-template/`
- **4-Priority System**: 00-main-coordination + 01-04 priority areas
- **Phase-Based Execution**: Research → Architecture → Implementation → Testing → Security
- **Git Worktree Strategy**: Isolated environments for agent work
- **Hook Integration**: Automated prevention patterns from CI lessons learned

## V2 Template System Architecture

### Core Concept: Template → Task Tree Mapping

```yaml
v1_template_element: v2_task_tree_component
  meta_prp_structure: hierarchical_task_tree
  priority_areas: child_tasks_with_dependencies
  phase_workflows: sequential_task_chains
  validation_gates: milestone_tasks_with_role_restrictions
  sub_agent_spawning: role_assignments_with_capability_validation
```

### Template Categories

#### 1. Meta-PRP Templates

- **Source**: `meta-prp-create.md` + `meta-prp-execute.md`
- **V2 Output**: Hierarchical task tree with coordination patterns
- **Key Features**:
  - Root coordination task (orchestrator role)
  - 4 priority child tasks (configurable roles)
  - Validation milestones (reviewer role)
  - Research phases (researcher role)

#### 2. Workflow Templates

- **Source**: V1 command prompts with systematic approaches
- **V2 Output**: Reusable task chains with role progression
- **Key Features**:
  - Sequential dependencies (research → design → implement → test)
  - Role-specific capability restrictions
  - Automated validation checkpoints

#### 3. Executive Dysfunction Templates

- **Source**: Pre-created directory structures and decision elimination patterns
- **V2 Output**: Task trees with minimal choice points
- **Key Features**:
  - Pre-defined task names and ordering
  - Clear role assignments eliminating specialist selection
  - Progress tracking at multiple granularities

### V2 Template Schema

```python
# Template Definition Structure
class V2TemplateDefinition:
    name: str
    description: str
    category: TemplateCategory  # META_PRP, WORKFLOW, EXECUTIVE_DYSFUNCTION
    
    # Task Structure
    root_task: TaskTemplate
    task_hierarchy: List[TaskTemplate]
    dependencies: Dict[str, List[str]]
    
    # Role Distribution
    role_assignments: Dict[str, str]  # task_id -> role_name
    capability_requirements: Dict[str, List[ToolGroup]]
    
    # Executive Dysfunction Support
    decision_elimination: List[PreDefinedChoice]
    progress_tracking: ProgressTrackingConfig
    
    # Validation Framework
    validation_gates: List[ValidationMilestone]
    quality_targets: Dict[str, int]  # metric -> target_score

class TaskTemplate:
    template_id: str
    title_template: str  # With placeholder support: "{PROJECT_NAME} Architecture"
    description_template: str
    priority: TaskPriority
    estimated_effort: Optional[str]
    
    # Role and Capability Requirements
    required_role: Optional[str]
    required_tool_groups: List[ToolGroup]
    file_pattern_restrictions: Optional[str]
    
    # Template-specific metadata
    template_variables: List[str]  # ["PROJECT_NAME", "FEATURE_NAME"]
    context_references: List[str]  # Files/docs to reference
```

### Template Engine Implementation

#### 1. Template Parser

```python
class V2TemplateParser:
    def parse_v1_workflow(self, workflow_content: str) -> V2TemplateDefinition:
        """Extract reusable patterns from V1 command prompts"""
        
    def identify_role_sequences(self, content: str) -> List[RoleSequence]:
        """Detect role progression patterns (researcher → architect → coder)"""
        
    def extract_validation_gates(self, content: str) -> List[ValidationMilestone]:
        """Find quality checkpoints and success criteria"""
        
    def parse_executive_dysfunction_patterns(self, content: str) -> EDSupportConfig:
        """Extract decision elimination and progress tracking patterns"""
```

#### 2. Template Instantiator

```python
class V2TemplateInstantiator:
    def create_task_tree_from_template(
        self, 
        template: V2TemplateDefinition,
        variables: Dict[str, str],
        project_context: ProjectContext
    ) -> TaskTree:
        """Generate concrete V2 task tree from template with variable substitution"""
        
    def apply_role_assignments(self, task_tree: TaskTree) -> TaskTree:
        """Assign roles based on template specifications and capability validation"""
        
    def setup_dependencies(self, task_tree: TaskTree) -> TaskTree:
        """Configure task dependencies and execution ordering"""
```

#### 3. Template Validator

```python
class V2TemplateValidator:
    def validate_role_capability_match(self, template: V2TemplateDefinition) -> ValidationResult:
        """Ensure all required capabilities are available in assigned roles"""
        
    def validate_dependency_consistency(self, template: V2TemplateDefinition) -> ValidationResult:
        """Check for circular dependencies and unreachable tasks"""
        
    def validate_executive_dysfunction_compliance(self, template: V2TemplateDefinition) -> ValidationResult:
        """Verify decision elimination and progress tracking support"""
```

## Migration Strategy

### Phase 1: Template Extraction (Current)

1. ✅ Analyze V1 meta-prp-create.md patterns (697 lines)
2. ✅ Analyze V1 meta-prp-execute.md patterns (659 lines)
3. ✅ Extract template structure patterns from meta-prp-template/
4. 🔄 Design V2 template schema and engine architecture

### Phase 2: Core Template System

1. Implement V2TemplateDefinition data structures
2. Create template parser for V1 workflow extraction
3. Build template instantiator for V2 task tree generation
4. Implement template validator for quality assurance

### Phase 3: Template Conversion

1. Convert meta-PRP creation workflow to V2 template
2. Convert meta-PRP execution workflow to V2 template
3. Create executive dysfunction support templates
4. Build validation framework templates

### Phase 4: Integration & Testing

1. Integrate with existing V2 task system
2. Test template instantiation with real project scenarios
3. Validate role assignment and capability restrictions
4. Performance testing with complex template hierarchies

## Preserved V1 Patterns in V2

### 1. Scaffolded Template Approach

- **V1**: `cp -r PRPs/templates/meta-prp-template PRPs/in-progress/{project-name}`
- **V2**: `create_task_tree_from_template(meta_prp_template, {PROJECT_NAME: "my-project"})`

### 2. Executive Dysfunction Design

- **V1**: Pre-created directories with numbered priorities (00-04)
- **V2**: Pre-defined task structures with clear ordering and minimal choices

### 3. Multi-Agent Coordination

- **V1**: Sub-agent spawning with orchestrator session management
- **V2**: Role assignments with capability validation and task dependencies

### 4. Systematic Approach Integration

- **V1**: Research-first methodology with pattern recognition
- **V2**: Mandatory research phases with dependency blocking on implementation

### 5. Validation Framework

- **V1**: 5-stage validation with quality gates
- **V2**: Milestone tasks with reviewer role assignments and success criteria

## Template Examples

### Meta-PRP Creation Template

```yaml
name: "meta_prp_creation"
category: "META_PRP"
description: "Create comprehensive meta-PRPs with multi-agent coordination"

root_task:
  title_template: "{PROJECT_NAME} Meta-PRP Creation"
  description_template: "Create comprehensive multi-agent coordination PRP for {PROJECT_NAME}"
  required_role: "orchestrator"
  
task_hierarchy:
  - id: "research_phase"
    title_template: "{PROJECT_NAME} Research Coordination"
    required_role: "researcher"
    dependencies: []
    
  - id: "architecture_phase" 
    title_template: "{PROJECT_NAME} Architecture Design"
    required_role: "architect"
    dependencies: ["research_phase"]
    
  - id: "implementation_phase"
    title_template: "{PROJECT_NAME} Implementation Planning"
    required_role: "coder"
    dependencies: ["architecture_phase"]
    
  - id: "testing_phase"
    title_template: "{PROJECT_NAME} Testing Strategy"
    required_role: "tester"
    dependencies: ["implementation_phase"]
    
  - id: "security_validation"
    title_template: "{PROJECT_NAME} Security Review"
    required_role: "reviewer"
    dependencies: ["testing_phase"]

role_assignments:
  root_task: "orchestrator"
  research_phase: "researcher"
  architecture_phase: "architect"
  implementation_phase: "coder"
  testing_phase: "tester"
  security_validation: "reviewer"

validation_gates:
  - milestone: "research_complete"
    required_artifacts: ["research_summary", "pattern_analysis"]
    quality_targets: {"completeness": 8, "accuracy": 9}
    
  - milestone: "architecture_complete"
    required_artifacts: ["architecture_design", "interface_specs"]
    quality_targets: {"consistency": 9, "security": 8}

executive_dysfunction_support:
  decision_elimination:
    - choice: "specialist_assignment"
      predefined: "automatic_via_task_type"
    - choice: "task_ordering"
      predefined: "dependency_based_sequential"
      
  progress_tracking:
    granularities: ["task_level", "phase_level", "milestone_level"]
    auto_preservation: "git_commits_every_completion"
```

## Success Metrics

### Template System Quality Targets

- **Context Preservation**: 10/10 (maintains V1 rich context)
- **Executive Dysfunction Support**: 10/10 (pre-defined structures, minimal choices)
- **Role Integration**: 10/10 (capability validation, automated assignment)
- **Validation Framework**: 10/10 (automated quality gates)
- **Systematic Approach**: 10/10 (research-first, pattern recognition)

### Migration Success Criteria

- [ ] All V1 template patterns identified and documented
- [ ] V2 template schema supports all V1 features
- [ ] Template instantiation generates valid V2 task trees
- [ ] Role assignments respect capability restrictions
- [ ] Executive dysfunction design principles preserved
- [ ] Validation framework maintains quality standards

## Implementation Plan

### Immediate Next Steps

1. **Create template data structures** in `packages/vespera-scriptorium/templates/`
2. **Implement template parser** for V1 workflow analysis
3. **Build template instantiator** for V2 task tree generation
4. **Create first template**: Meta-PRP creation workflow
5. **Test with real project** to validate approach

### Integration Points

- **V2 Task System**: Template instantiation creates tasks via existing MCP tools
- **Role System**: Template role assignments use existing role validation
- **MCP Server**: Templates exposed as MCP tools for external access
- **Documentation**: Templates generate their own usage documentation

This design preserves the rich context and executive dysfunction awareness of V1 while enabling the structured orchestration capabilities of V2.
