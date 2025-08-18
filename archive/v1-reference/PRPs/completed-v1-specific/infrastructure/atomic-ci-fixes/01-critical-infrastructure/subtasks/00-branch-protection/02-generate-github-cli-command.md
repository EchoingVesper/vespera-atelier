# Generate GitHub CLI Command

**Task ID**: `branch-protection-cli`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 3 minutes  
**Priority**: 🔴 Critical  
**Complexity**: trivial

## Objective

Convert JSON branch protection configuration to executable GitHub CLI command.

## Context

**Background**: JSON configuration from previous task needs to be converted to executable gh CLI command for automated setup.

**Relationship to Priority**: Enables automated branch protection setup for infrastructure reliability.

**Dependencies**:

- Requires: JSON configuration from task 01
- Provides to: Executable command for branch protection setup

## Local LLM Prompt Template

**Structured Prompt**:

```text
CONTEXT: You are a GitHub CLI specialist. Convert JSON config to gh CLI command.

TASK: Convert JSON branch protection config to executable gh CLI command

INPUT: JSON configuration from previous task

REQUIREMENTS: 
- Use gh api command with repos endpoint
- Method: PUT
- Proper JSON escaping for command line
- Target: repos/EchoingVesper/vespera-atelier/branches/main/protection

OUTPUT_FORMAT: 
```bash
gh api repos/EchoingVesper/vespera-atelier/branches/main/protection \
  --method PUT \
  --field required_status_checks='[JSON_HERE]' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='[JSON_HERE]'
```

VALIDATION: Command must be executable with proper JSON escaping.

CONSTRAINTS:

- Maximum context size: 400 tokens
- Command must be copy-paste executable

## Expected Outputs

**Primary Deliverables**:

- Complete gh CLI command with proper JSON escaping
- Ready-to-execute command for branch protection setup

**Success Criteria**:

- [ ] Command uses correct GitHub API endpoint
- [ ] JSON properly escaped for command line execution
- [ ] All configuration fields included in command

---

**Navigation**:

- ← Back to [01-generate-branch-protection-config.md](01-generate-branch-protection-config.md)
- → Next Category: [../01-maintenance-workflow/](../01-maintenance-workflow/)
- ↑ Priority: [../../index.md](../../index.md)
