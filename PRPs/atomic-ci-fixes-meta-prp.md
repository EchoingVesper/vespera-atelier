# Meta-PRP: Atomic CI/CD Fixes for Local LLM Execution

**Meta-PRP ID**: ATOMIC_CI_FIXES_LOCAL_LLM  
**Type**: Multi-Agent Atomic Task Coordination  
**Priority**: High - Critical CI/CD Issues  
**Target Environment**: Local LLM (8GB VRAM / RTX 2080 constraint)  
**Estimated Total Effort**: 4-6 hours across multiple atomic tasks  
**Orchestrator Session**: session_6375af58_1755338579  

## Executive Summary

This meta-PRP decomposes the critical CI/CD issues from the comprehensive code review into highly granular, context-contained atomic tasks specifically designed for execution by resource-constrained local LLMs. Each task is self-contained, requires minimal context loading, and has clear input/output specifications with structured prompts.

## Local LLM Optimization Strategy

### Context Minimization Approach
- **Maximum Context Per Task**: 2000 tokens
- **Input Specification**: Exact file paths and line numbers
- **Output Specification**: Precise diff format or exact replacement text
- **Validation Method**: Automated tests for each atomic change

### Task Granularity Principles
1. **Single File Focus**: Each task modifies one file maximum
2. **Clear Boundaries**: No dependencies between atomic tasks
3. **Validation Ready**: Each task includes verification command
4. **Rollback Safe**: Each change easily reversible

## Priority Breakdown Structure

### 🔴 Priority 1: Critical Infrastructure Fixes (Local LLM Ready: ✅)

#### P1.1: Branch Protection Configuration
**Local LLM Readiness**: ✅ Perfect for automation  
**Context Required**: ~500 tokens  
**Complexity**: Trivial  

**Atomic Tasks:**

##### P1.1.1: Generate Branch Protection JSON Config
```yaml
task_id: branch-protection-config
local_llm_ready: ✅
context_size: 300 tokens
input: GitHub repository settings requirements
output: Complete JSON configuration object
estimated_time: 5 minutes

structured_prompt: |
  You are a GitHub configuration specialist. Generate a JSON configuration for branch protection rules.
  
  INPUT:
  - Repository: vespera-atelier
  - Branch: main
  - Requirements: PR reviews, status checks, up-to-date branches, admin enforcement
  
  OUTPUT FORMAT (exact JSON):
  ```json
  {
    "required_status_checks": {
      "strict": true,
      "contexts": ["CI/CD Pipeline", "Quality Checks", "Security Checks"]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "required_approving_review_count": 1,
      "dismiss_stale_reviews": true
    },
    "restrictions": null
  }
  ```
  
  VALIDATION: JSON must be valid and contain all required fields.
```

##### P1.1.2: Generate GitHub CLI Command
```yaml
task_id: branch-protection-cli
local_llm_ready: ✅
context_size: 400 tokens
input: Branch protection JSON config from P1.1.1
output: Complete gh CLI command
estimated_time: 3 minutes

structured_prompt: |
  You are a GitHub CLI specialist. Convert JSON config to gh CLI command.
  
  INPUT: [JSON config from previous task]
  
  OUTPUT FORMAT (exact command):
  ```bash
  gh api repos/EchoingVesper/vespera-atelier/branches/main/protection \
    --method PUT \
    --field required_status_checks='[JSON_HERE]' \
    --field enforce_admins=true \
    --field required_pull_request_reviews='[JSON_HERE]'
  ```
  
  VALIDATION: Command must be executable with proper JSON escaping.
```

#### P1.2: Maintenance Workflow Debug Enhancement
**Local LLM Readiness**: ✅ Excellent for targeted fixes  
**Context Required**: ~800 tokens per task  

##### P1.2.1: Add Debug Logging to Maintenance Workflow
```yaml
task_id: maintenance-debug-logging
local_llm_ready: ✅
context_size: 800 tokens
input: Current .github/workflows/maintenance.yml (specific lines 45-80)
output: Enhanced YAML with debug logging
estimated_time: 10 minutes

structured_prompt: |
  You are a GitHub Actions specialist. Add comprehensive debug logging to a failing workflow.
  
  INPUT FILE: .github/workflows/maintenance.yml
  FOCUS LINES: 45-80 (Python environment setup section)
  
  REQUIRED ADDITIONS:
  1. Echo commands before execution
  2. Environment variable debugging  
  3. Python path and version logging
  4. Dependency installation verbose output
  5. Error capture with detailed output
  
  OUTPUT FORMAT: Complete YAML replacement for lines 45-80 with debug enhancements.
  
  EXAMPLE PATTERN:
  ```yaml
  - name: Debug Environment
    run: |
      echo "::group::Environment Debug"
      echo "Python version: $(python --version)"
      echo "Python path: $(which python)"
      echo "Working directory: $(pwd)"
      echo "::endgroup::"
  ```
  
  VALIDATION: YAML syntax must be valid, preserve existing functionality.
```

##### P1.2.2: Add Error Recovery to Maintenance Workflow
```yaml
task_id: maintenance-error-recovery
local_llm_ready: ✅
context_size: 600 tokens
input: Original maintenance workflow step
output: Enhanced step with retry logic
estimated_time: 8 minutes

structured_prompt: |
  You are a CI/CD reliability specialist. Add error recovery to a failing workflow step.
  
  INPUT: Single workflow step that installs Python dependencies
  
  REQUIRED ENHANCEMENTS:
  1. Retry logic (3 attempts)
  2. Progressive backoff (sleep 10, 30, 60)
  3. Clear error messages
  4. Cleanup on failure
  
  OUTPUT FORMAT: Complete YAML step with error recovery.
  
  TEMPLATE:
  ```yaml
  - name: Install dependencies with recovery
    run: |
      for attempt in 1 2 3; do
        if [ORIGINAL_COMMAND]; then
          echo "✅ Success on attempt $attempt"
          break
        else
          echo "❌ Attempt $attempt failed"
          [CLEANUP_COMMANDS]
          if [[ $attempt -eq 3 ]]; then exit 1; fi
          sleep [BACKOFF_TIME]
        fi
      done
  ```
```

### 🟡 Priority 2: Configuration Fixes (Local LLM Ready: ✅)

#### P2.1: Monorepo Workspace Configuration
**Local LLM Readiness**: ✅ Perfect for JSON manipulation  

##### P2.1.1: Fix Root Package.json Workspaces
```yaml
task_id: fix-package-json-workspaces
local_llm_ready: ✅
context_size: 400 tokens
input: Current package.json workspaces section (lines 68-71)
output: Corrected workspaces array
estimated_time: 3 minutes

structured_prompt: |
  You are a package.json configuration specialist. Fix incorrect workspace paths.
  
  INPUT LINES (package.json:68-71):
  "workspaces": [
    "vespera-utilities",
    "plugins/Obsidian/Vespera-Scriptorium"
  ],
  
  PROBLEM: "vespera-utilities" should be "packages/vespera-utilities"
  
  OUTPUT (exact replacement):
  ```json
  "workspaces": [
    "packages/vespera-utilities",
    "plugins/Obsidian/Vespera-Scriptorium"
  ],
  ```
  
  VALIDATION: Must be valid JSON, paths must exist in filesystem.
```

##### P2.1.2: Verify Workspace Path Existence
```yaml
task_id: verify-workspace-paths
local_llm_ready: ✅
context_size: 300 tokens
input: Workspace paths array
output: Validation script
estimated_time: 5 minutes

structured_prompt: |
  You are a filesystem validation specialist. Create a script to verify workspace paths exist.
  
  INPUT: ["packages/vespera-utilities", "plugins/Obsidian/Vespera-Scriptorium"]
  
  OUTPUT: Complete bash script for validation.
  
  TEMPLATE:
  ```bash
  #!/bin/bash
  workspace_paths=("packages/vespera-utilities" "plugins/Obsidian/Vespera-Scriptorium")
  for path in "${workspace_paths[@]}"; do
    if [[ -d "$path" && -f "$path/package.json" ]]; then
      echo "✅ $path: Valid workspace"
    else
      echo "❌ $path: Invalid workspace"
      exit 1
    fi
  done
  echo "All workspaces validated successfully"
  ```
```

#### P2.2: CI Path Corrections
**Local LLM Readiness**: ✅ Simple find-replace operations  

##### P2.2.1: Fix CI Working Directory Paths
```yaml
task_id: fix-ci-working-directories
local_llm_ready: ✅
context_size: 500 tokens
input: GitHub Actions workflow files with incorrect paths
output: Corrected working-directory values
estimated_time: 5 minutes

structured_prompt: |
  You are a GitHub Actions path specialist. Fix incorrect working-directory references.
  
  SEARCH AND REPLACE OPERATIONS:
  
  File: .github/workflows/ci.yml
  Line 36: working-directory: packages/vespera-scriptorium
  Should be: working-directory: packages/vespera-scriptorium
  
  File: .github/workflows/enhanced-ci.yml  
  Line 114: working-directory: packages/vespera-scriptorium
  Should be: working-directory: packages/vespera-scriptorium
  
  OUTPUT FORMAT: List of exact line replacements.
  
  TEMPLATE:
  ```
  File: .github/workflows/ci.yml
  Line: 36
  Old: working-directory: packages/vespera-scriptorium
  New: working-directory: packages/vespera-scriptorium
  ```
  
  VALIDATION: Paths must exist in repository structure.
```

### 🟢 Priority 3: Enhancement Tasks (Local LLM Ready: 🟡)

#### P3.1: Build Script Improvements
**Local LLM Readiness**: 🟡 Medium complexity - requires understanding of build systems  

##### P3.1.1: Add Virtual Environment Creation
```yaml
task_id: add-venv-creation
local_llm_ready: 🟡
context_size: 800 tokens
input: Root package.json build scripts (lines 36-40)
output: Enhanced scripts with venv creation
estimated_time: 15 minutes

structured_prompt: |
  You are a build system specialist. Add virtual environment creation to build scripts.
  
  INPUT (package.json lines 36-40):
  "build:scriptorium": "cd packages/vespera-scriptorium && ./venv/bin/pip install -e '.[dev]' && ./venv/bin/python -m build",
  
  PROBLEM: Assumes venv exists
  SOLUTION: Add venv creation before usage
  
  ENHANCED SCRIPT TEMPLATE:
  "build:scriptorium": "cd packages/vespera-scriptorium && (test -d venv || python -m venv venv) && ./venv/bin/pip install -e '.[dev]' && ./venv/bin/python -m build",
  
  OUTPUT: Complete corrected scripts object.
  
  VALIDATION: Scripts must handle both fresh checkout and existing venv scenarios.
```

## Local LLM Execution Framework

### Task Classification System

#### ✅ High Local LLM Readiness (Perfect for 8GB VRAM)
- **Characteristics**: Simple text transformation, JSON manipulation, template completion
- **Context Size**: <1000 tokens
- **Examples**: Config file updates, CLI command generation, simple script creation
- **Success Rate**: 95%+

#### 🟡 Medium Local LLM Readiness (Feasible with careful prompting)  
- **Characteristics**: Logic implementation, multi-file awareness, build system understanding
- **Context Size**: 1000-2000 tokens
- **Examples**: Build script enhancement, workflow logic, dependency management
- **Success Rate**: 80%+
- **Requirements**: Structured prompts, clear examples, validation steps

#### ❌ Low Local LLM Readiness (Requires larger models)
- **Characteristics**: Complex architecture decisions, multi-system integration, deep contextual understanding
- **Context Size**: >2000 tokens
- **Examples**: Architectural refactoring, complex orchestration, security analysis
- **Success Rate**: <60%
- **Alternative**: Break into smaller atomic tasks or use larger model

### Structured Prompt Template

```yaml
atomic_task_template:
  metadata:
    task_id: "unique_identifier"
    local_llm_ready: "✅|🟡|❌"
    context_size: "X tokens"
    estimated_time: "X minutes"
    
  input_specification:
    description: "Exact description of input"
    format: "Specific format requirements"
    example: "Concrete example"
    
  processing_instructions:
    role: "You are a [SPECIALIST_TYPE]"
    task: "Specific action to perform"
    constraints: "Limitations and requirements"
    
  output_specification:
    format: "Exact output format"
    template: "Template to follow"
    validation: "How to verify correctness"
    
  execution_context:
    working_directory: "Specific path"
    files_to_modify: ["specific", "file", "paths"]
    validation_command: "command to verify result"
```

### Progressive Automation Strategy

#### Phase 1: Manual Execution with Structured Prompts
- Use structured prompts with local LLM
- Manual validation of each atomic task
- Build confidence in task decomposition

#### Phase 2: Semi-Automated Execution
- Script-assisted prompt generation
- Automated validation testing
- Batch processing of similar tasks

#### Phase 3: Full Automation Pipeline
- Orchestrator integration for task coordination
- Automated LLM task assignment
- Continuous validation and rollback

## Implementation Workflow

### Step 1: Task Preparation
```bash
# Create atomic task workspace
mkdir -p atomic-tasks/{priority-1,priority-2,priority-3}

# Generate structured prompts for each task
python scripts/generate_atomic_prompts.py atomic-ci-fixes-meta-prp.md

# Validate task independence
python scripts/validate_task_atomicity.py atomic-tasks/
```

### Step 2: Local LLM Execution
```bash
# Execute high-readiness tasks first
for task in atomic-tasks/priority-1/*.yml; do
  echo "Executing $(basename $task)"
  # Send structured prompt to local LLM
  # Capture and validate output
  # Apply changes if validation passes
done
```

### Step 3: Validation and Integration
```bash
# Validate each atomic change
pytest tests/integration/test_atomic_fixes.py

# Run affected CI workflows
gh workflow run ci.yml

# Verify no regressions
python scripts/regression_test.py
```

## Atomic Task Orchestration

### Orchestrator Integration for Task Coordination

```yaml
orchestrator_task_breakdown:
  main_coordination_task: "task_40a8d30b"
  
  sub_tasks:
    priority_1_critical:
      - task_id: "branch_protection_setup"
        specialist_type: "devops"
        dependencies: []
        
      - task_id: "maintenance_workflow_debug"
        specialist_type: "coder"
        dependencies: []
        
    priority_2_configuration:
      - task_id: "workspace_configuration_fix"
        specialist_type: "coder"
        dependencies: ["priority_1_critical"]
        
      - task_id: "ci_path_corrections"
        specialist_type: "coder"
        dependencies: ["workspace_configuration_fix"]
        
    priority_3_enhancements:
      - task_id: "build_script_improvements"
        specialist_type: "coder"
        dependencies: ["priority_2_configuration"]
```

### Multi-Agent Coordination

Each atomic task can be assigned to a specialist agent with minimal context:

```yaml
agent_assignment_strategy:
  config_specialist:
    tasks: ["branch_protection_setup", "workspace_configuration_fix"]
    context_size: 500 tokens average
    specialization: "JSON/YAML configuration"
    
  workflow_specialist:
    tasks: ["maintenance_workflow_debug", "ci_path_corrections"]
    context_size: 800 tokens average
    specialization: "GitHub Actions workflows"
    
  build_specialist:
    tasks: ["build_script_improvements"]
    context_size: 1000 tokens average
    specialization: "Build systems and dependency management"
```

## Success Metrics

### Local LLM Effectiveness Metrics
- **Task Completion Rate**: Target 90%+ for ✅ tasks, 80%+ for 🟡 tasks
- **Context Efficiency**: Average <1000 tokens per atomic task
- **Validation Success**: 95%+ tasks pass automated validation
- **Time Efficiency**: 80% time savings vs manual implementation

### Quality Assurance Metrics
- **Regression Rate**: <5% of atomic changes cause new issues
- **Integration Success**: 100% of atomic tasks integrate cleanly
- **Rollback Success**: 100% of changes can be automatically reverted
- **CI Improvement**: Target 95%+ CI workflow success rate post-fixes

## Risk Mitigation

### Task Isolation Strategy
- Each atomic task modifies only one file
- No dependencies between atomic tasks in same priority
- Automated rollback for any failed validation
- Git commits per atomic task for granular history

### Validation Framework
- Syntax validation for all configuration changes
- Integration testing for workflow modifications
- Regression testing for build script changes
- Security scanning for any new automation

### Fallback Procedures
- Manual execution instructions for each atomic task
- Escalation path to larger LLM for complex tasks
- Rollback scripts for each type of change
- Alternative implementation approaches for failed tasks

## Next Steps

1. **Implement Task Generation Scripts**: Create tooling to generate structured prompts from meta-PRP
2. **Develop Validation Framework**: Automated testing for each atomic task type
3. **Create Local LLM Interface**: Standardized way to execute atomic tasks with local models
4. **Build Progress Tracking**: Monitor success rates and adjust task granularity
5. **Scale to Other Domains**: Apply atomic task methodology to other development areas

This meta-PRP demonstrates how complex CI/CD fixes can be decomposed into atomic, local LLM-friendly tasks while maintaining quality and integration coherence. The approach scales beyond this specific use case to any complex development challenge.