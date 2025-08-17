# Generate Branch Protection JSON Configuration

**Task ID**: `branch-protection-config`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 5 minutes  
**Priority**: 🔴 Critical  
**Complexity**: trivial

## Objective

Generate a complete JSON configuration object for GitHub branch protection rules that enforces PR reviews, status checks, up-to-date branches, and admin enforcement.

## Context

**Background**: Repository currently lacks branch protection, allowing direct pushes to main branch which bypasses code review processes.

**Relationship to Priority**: Core infrastructure security requirement for reliable CI/CD pipeline.

**Dependencies**:

- Requires: Repository access and GitHub API knowledge
- Provides to: Task 02 (GitHub CLI command generation)

## Inputs

**Required Files/Data**:

- Repository name: `vespera-atelier`
- Target branch: `main`
- Required status checks: `["CI/CD Pipeline", "Quality Checks", "Security Checks"]`

**Commands/Tools Needed**:

- JSON validation tools
- Text editor or JSON formatter

**Context Information**:

- Repository: `EchoingVesper/vespera-atelier`
- Branch protection requirements: PR reviews, status checks, up-to-date branches, admin enforcement

## Expected Outputs

**Primary Deliverables**:

- Complete JSON configuration object for branch protection
- Validated JSON structure with all required fields
- Configuration ready for GitHub API consumption

**Artifact Storage**: All detailed work stored via `orchestrator_complete_task`

**Documentation Updates**: None required for this atomic task

## Success Criteria

**Completion Requirements**:

- [ ] JSON configuration includes required_status_checks with strict: true
- [ ] JSON includes required_pull_request_reviews with required_approving_review_count: 1
- [ ] JSON includes enforce_admins: true
- [ ] All expected outputs generated
- [ ] JSON validates without syntax errors
- [ ] Configuration contains all required fields

**Validation Commands**:

```bash
# Commands to verify task completion
cat branch_protection_config.json | jq '.'
python -m json.tool branch_protection_config.json
```

**Quality Gates**:

- [ ] Valid JSON syntax
- [ ] All required fields present
- [ ] Appropriate security settings configured

## Local LLM Prompt Template

**Structured Prompt**:

```text
CONTEXT: You are a GitHub configuration specialist. Generate a JSON configuration for branch protection rules.

TASK: Create complete JSON configuration for GitHub branch protection

INPUT: 
- Repository: vespera-atelier
- Branch: main
- Requirements: PR reviews, status checks, up-to-date branches, admin enforcement

REQUIREMENTS: 
- required_status_checks with strict: true and contexts array
- enforce_admins: true
- required_pull_request_reviews with required_approving_review_count: 1
- dismiss_stale_reviews: true
- restrictions: null

OUTPUT_FORMAT: 
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

CONSTRAINTS:

- Maximum context size: 300 tokens
- Output must be executable JSON

## Agent Instructions

**Primary Specialist**: DevOps (GitHub configuration)

**Execution Context**:

```bash
# Get task context from orchestrator
orchestrator_execute_task task_id="branch-protection-config"

# Execute the task following the prompt template above
# Store all detailed work in orchestrator artifacts

# Complete task with comprehensive results
orchestrator_complete_task \
  task_id="branch-protection-config" \
  summary="Generated complete JSON configuration for GitHub branch protection" \
  detailed_work="JSON configuration object with all required fields for branch protection" \
  artifact_type="code" \
  next_action="continue"
```

**Special Instructions**:

- Follow exact JSON structure from original PRP specification
- Ensure all security settings are properly configured
- Validate JSON before marking complete

## Validation

**Pre-Execution Checklist**:

- [ ] Repository requirements understood
- [ ] JSON structure template available
- [ ] Security requirements clear

**Post-Execution Validation**:

```bash
# Run these commands to verify completion
cat output.json | jq '.'
echo $? # Should return 0 for valid JSON
```

**Integration Testing**:

- Configuration will be used by next task to generate CLI command
- Must be valid GitHub API format

## Git Worktree Strategy

**Isolation Needed**: No  
**Reason**: Atomic task with no file system changes, pure configuration generation

---

**Navigation**:

- ← Back to [Category Overview](README.md)
- → Next Task: [02-generate-github-cli-command.md](02-generate-github-cli-command.md)
- ↑ Priority: [../../index.md](../../index.md)
- 📋 Progress: [../../../00-main-coordination/tracking/checklist.md](../../../00-main-coordination/tracking/checklist.md)
