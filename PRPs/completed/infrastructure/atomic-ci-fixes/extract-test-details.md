# Test Details Extraction Guide

## GitHub PR #15 Checks Analysis

**Source**: https://github.com/EchoingVesper/vespera-atelier/pull/15/checks

This document guides the extraction of real test details from the GitHub Actions checks to populate our research tasks with actual data instead of placeholders.

## Data Extraction Process

### Step 1: Access GitHub Actions Results
1. Navigate to: https://github.com/EchoingVesper/vespera-atelier/pull/15/checks
2. Identify each failing workflow run
3. Click into detailed logs for each failed test
4. Extract specific information listed below

### Step 2: Test Information to Extract

For each of the 37 failing tests, extract:

#### Basic Test Information
- **Test Name**: Exact name as shown in GitHub Actions
- **Workflow File**: Which `.github/workflows/*.yml` file contains this test
- **Job Name**: Specific job within the workflow that's failing
- **Step Name**: Which step in the job is failing
- **Runner OS**: Ubuntu/Windows/macOS (likely Ubuntu)

#### Failure Details
- **Error Message**: Complete error message from logs
- **Exit Code**: Process exit code (if available)
- **Failure Point**: Which command/line causes the failure
- **Stack Trace**: Full stack trace (if applicable)
- **Duration**: How long test ran before failing

#### Environment Context
- **Python Version**: If Python test, which version is being used
- **Node Version**: If Node.js test, which version is being used
- **Dependencies**: What packages were being installed/used
- **Working Directory**: Which directory the test runs from

### Step 3: Categorization

While extracting, note which category each test likely falls into:

#### Failed Tests (23 tests)
Tests that run but exit with failure/error status.

**Common patterns to look for:**
- Import errors (module not found)
- Syntax errors  
- Test assertion failures
- Configuration errors
- Missing dependencies

#### Cancelled Tests (4 tests)
Tests that are cancelled before completion.

**Common patterns to look for:**
- Dependency on failed jobs
- Timeout cancellations
- Resource limit cancellations
- Workflow configuration issues

#### Hanging Tests (6 tests)
Tests that start but never complete (running >1 hour).

**Common patterns to look for:**
- Infinite loops in test code
- Waiting for resources that never become available
- Network timeouts without proper handling
- Process deadlocks

#### Skipped Tests (4 tests)
Tests that are intentionally skipped.

**Common patterns to look for:**
- Conditional skips based on environment
- Disabled tests
- Tests skipped due to missing dependencies
- Feature flags or configuration that disables tests

## Research Task Population

### For Each Test Found:
1. Create/update research task file with real data
2. Replace all `[TO BE FILLED]` placeholders with actual information
3. Update task title with real test name
4. Provide specific context for investigation

### Template Updates Needed:
```markdown
# Research: [REAL_TEST_NAME] Analysis

**Test Name**: [ACTUAL_TEST_NAME_FROM_GITHUB]
**Workflow File**: [ACTUAL_WORKFLOW_FILE]
**Job Name**: [ACTUAL_JOB_NAME]
**Failure Type**: [failed/cancelled/hanging/skipped]

## Actual Error Details
[COPY_EXACT_ERROR_FROM_GITHUB_LOGS]

## Environment Context
- **Runner**: [ubuntu-latest/windows-latest/etc]
- **Python Version**: [if applicable]
- **Node Version**: [if applicable]
- **Working Directory**: [actual directory]

## Investigation Focus
Based on the actual error: [SPECIFIC_INVESTIGATION_APPROACH]
```

## Expected Findings

### Likely Test Distribution
Based on typical CI failures, expect to find:

- **Environment/Dependency Issues**: 15-20 tests
  - Python version mismatches
  - Missing packages
  - npm/pnpm configuration issues

- **Configuration Issues**: 8-12 tests  
  - GitHub Actions setup problems
  - Workflow file errors
  - Path resolution issues

- **Code/Import Issues**: 5-8 tests
  - Import path problems from monorepo
  - Deprecated API usage
  - Test code needing updates

- **Infrastructure Issues**: 2-5 tests
  - Timeouts
  - Resource limits
  - Hanging processes

### Consolidation Opportunities
After real data extraction, likely consolidate into:
- **Environment Setup Task**: Fix Python/Node/dependency issues across multiple tests
- **Workflow Configuration Task**: Fix GitHub Actions configuration issues
- **Import/Path Task**: Fix monorepo path resolution issues
- **Timeout/Resource Task**: Fix hanging and resource issues

## Next Steps After Extraction

1. **Populate Research Tasks**: Update all 37 research task files with real data
2. **Initial Analysis**: Look for patterns across the real failures
3. **Spawn Research Agents**: Use orchestrator to spawn 37 research agents with real context
4. **Analyze Findings**: Consolidate research findings into implementation strategy

This evidence-based approach will lead to much more targeted and effective implementation than our original 74-agent plan.

---

**Note**: This extraction should be done before spawning any research agents to ensure they work with real data rather than placeholders.