# Research Task Template: Skipped Test Analysis

**Task ID**: `research-04-skipped-test`  
**Type**: Research  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 15-20 minutes  
**Priority**: 🔴 Critical  
**Complexity**: simple

## Objective

Extract real test details from GitHub PR #15 checks and perform deep-dive analysis to identify root cause and solution approach for this specific failed test.

## Data Source

**GitHub PR #15 Checks**: https://github.com/EchoingVesper/vespera-atelier/pull/15/checks

## Research Tasks

### 1. Test Identification (Extract from GitHub Actions)
- **Test Name**: [TO BE EXTRACTED from GitHub Actions logs]
- **Workflow File**: [TO BE EXTRACTED - which .github/workflows/*.yml file]
- **Job Name**: [TO BE EXTRACTED - specific job within workflow]
- **Step Name**: [TO BE EXTRACTED - which step fails]
- **Runner OS**: [TO BE EXTRACTED - Ubuntu/Windows/macOS]

### 2. Failure Analysis (Copy from GitHub Logs)
- **Error Message**: [TO BE COPIED - exact error from logs]
- **Exit Code**: [TO BE EXTRACTED - process exit code]
- **Failure Point**: [TO BE IDENTIFIED - which command/line causes failure]
- **Stack Trace**: [TO BE COPIED - full stack trace if applicable]
- **Duration**: [TO BE EXTRACTED - how long test ran before failing]

### 3. Environment Context (Extract from Logs)
- **Python Version**: [TO BE EXTRACTED - if Python test]
- **Node Version**: [TO BE EXTRACTED - if Node.js test]
- **Dependencies**: [TO BE EXTRACTED - what packages were being used]
- **Working Directory**: [TO BE EXTRACTED - which directory test runs from]

### 4. Root Cause Investigation
- **Primary Cause**: [TO BE DETERMINED through analysis]
- **Environment Factors**: [TO BE ASSESSED - runner, dependencies, versions]
- **Configuration Issues**: [TO BE ASSESSED - workflow or test config problems]
- **Monorepo Impact**: [TO BE ASSESSED - did monorepo changes affect this]

### 5. Solution Research
- **Best Practices**: [Research proper configuration for this error type]
- **Similar Solutions**: [Research how other projects handle this error]
- **Official Documentation**: [Check docs for proper setup]
- **Community Solutions**: [Search for similar issues and fixes]

## Research Methodology

### Step 1: Extract Real Test Data
1. Navigate to GitHub PR #15 checks page
2. Find this specific test failure in the workflow runs
3. Click into detailed logs for this test
4. Extract all information listed above
5. Replace all [TO BE EXTRACTED] placeholders with real data

### Step 2: Analyze Error Pattern
1. Copy exact error message and context
2. Identify the specific point of failure
3. Check for environment or configuration issues
4. Note any dependency or version problems

### Step 3: Research Root Cause
1. Search online for this specific error pattern
2. Check GitHub issues for similar problems
3. Review official documentation for proper setup
4. Identify if this is a known issue with solutions

### Step 4: Document Solution Approach
1. Identify the most likely fix for this specific error
2. Document any dependencies or requirements
3. Note potential impact on other tests
4. Provide implementation guidance

## Expected Output Format

```markdown
# Research Report: [ACTUAL_TEST_NAME]

## Test Details (Extracted from GitHub Actions)
- **Test Name**: [Real test name from GitHub]
- **Workflow**: [Actual workflow file]
- **Job**: [Actual job name]
- **Error**: [Exact error message from logs]

## Root Cause Analysis
- **Primary Issue**: [Specific root cause identified]
- **Category**: [Environment/Configuration/Code/Infrastructure]
- **Impact**: [What this affects]

## Solution Approach
- **Recommended Fix**: [Specific solution approach]
- **Implementation**: [How to implement the fix]
- **Dependencies**: [What else needs to be updated]
- **Validation**: [How to test the fix]

## Pattern Recognition
- **Similar Tests**: [Other tests that might have same issue]
- **Consolidation Opportunity**: [Can this be fixed with other tests]
```

## Success Criteria

**Completion Requirements**:
- [ ] Real test name and details extracted from GitHub Actions
- [ ] Exact error message and failure context documented
- [ ] Root cause clearly identified and explained
- [ ] Solution approach researched and documented
- [ ] Pattern recognition notes for consolidation analysis
- [ ] All findings stored in orchestrator artifacts

## Agent Instructions

**Execution Steps**:
1. Access GitHub PR #15 checks and find your assigned test failure
2. Extract complete real test details (no placeholders)
3. Copy exact error messages and failure context
4. Research root cause through analysis and online investigation
5. Document solution approach with implementation guidance
6. Note patterns for potential consolidation with other tests
7. Store comprehensive findings in orchestrator artifacts

---

**Navigation**:
- ← Back to [Research Phase Overview](../../README.md)
- ↑ Priority: [../../../index.md](../../../index.md)
- 🔗 Data Source: [GitHub PR #15 Checks](https://github.com/EchoingVesper/vespera-atelier/pull/15/checks)

**Note**: This is a template. Copy this structure to all 37 research task directories and customize the task ID and numbering for each specific test.