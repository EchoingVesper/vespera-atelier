#!/bin/bash

# Generate Phase 3 Subtask Files
# This script creates all 74 subtask files (37 research + 37 implementation)

echo "🔧 Generating Phase 3 Subtask Files..."

# Function to create research task file
create_research_task() {
    local category="$1"
    local test_num="$2"
    local test_type="$3"
    local priority_num="$4"
    local dir="${priority_num}-phase3-${category}-tests/00-research-phase/subtasks/$(printf "%02d" $test_num)-${category}-test-${test_num}"
    local file="${dir}/research-task.md"
    
    mkdir -p "$dir"
    
    cat > "$file" << EOF
# Research: ${test_type^} Test #${test_num} Analysis

**Task ID**: \`${category}-test-${test_num}-research\`  
**Type**: Research  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 15-20 minutes  
**Priority**: 🔴 Critical  
**Complexity**: simple  
**GitHub Issue**: To be created based on findings

## Objective

Deep-dive analysis of specific ${category} test to identify root cause, understand test purpose, and develop implementation plan for resolution.

## Context

**Background**: This is one of the ${category} GitHub Actions tests that need individual analysis.

**Test Category**: ${test_type^} Test
**Failure Type**: ${category^}

## Research Focus Areas

### 1. Test Identification
- **Test Name**: [TO BE FILLED - specific test name from GitHub Actions]
- **Workflow File**: [TO BE FILLED - which .github/workflows/*.yml file]
- **Test Command**: [TO BE FILLED - exact command that's ${category}]
- **Test Category**: [TO BE FILLED - unit/integration/e2e/security/etc]

### 2. ${test_type^} Analysis
- **${test_type^} Reason**: [TO BE RESEARCHED - why is test ${category}]
- **${test_type^} Point**: [TO BE RESEARCHED - when/where does ${category} occur]
- **Error Details**: [TO BE RESEARCHED - specific error messages if any]
- **Conditions**: [TO BE RESEARCHED - what conditions cause ${category}]

### 3. Root Cause Investigation
- **Primary Cause**: [TO BE DETERMINED through analysis]
- **Environment Factors**: [TO BE ASSESSED - runner, dependencies, etc]
- **Configuration Issues**: [TO BE ASSESSED - workflow or test config problems]
- **Monorepo Impact**: [TO BE ASSESSED - did monorepo changes affect this]

### 4. Solution Research
- **Best Practices**: [Research proper configuration for this test type]
- **Similar Solutions**: [Research how other projects handle this scenario]
- **Official Documentation**: [Check docs for proper setup]
- **Community Solutions**: [Search for similar issues and fixes]

## Expected Outputs

**Primary Deliverables**:
- Complete analysis of ${category} cause for this specific test
- Recommended solution approach with implementation steps
- Environment and configuration requirements
- Implementation guidance for resolution

**Artifact Storage**: Via orchestrator_complete_task

## Success Criteria

- [ ] Test details fully documented
- [ ] ${test_type^} cause clearly identified
- [ ] Solution approach researched and documented
- [ ] Implementation plan provided
- [ ] Research findings stored in orchestrator artifacts

---

**Navigation**:
- ← Back to [Research Phase Overview](../README.md)
- → Implementation: [../../01-implementation-phase/subtasks/$(printf "%02d" $test_num)-${category}-test-${test_num}/implementation-task.md](../../01-implementation-phase/subtasks/$(printf "%02d" $test_num)-${category}-test-${test_num}/implementation-task.md)
- ↑ Priority: [../../index.md](../../index.md)
EOF

    echo "✅ Created research task: ${category} test #${test_num}"
}

# Function to create implementation task file
create_implementation_task() {
    local category="$1"
    local test_num="$2"
    local test_type="$3"
    local priority_num="$4"
    local dir="${priority_num}-phase3-${category}-tests/01-implementation-phase/subtasks/$(printf "%02d" $test_num)-${category}-test-${test_num}"
    local file="${dir}/implementation-task.md"
    
    mkdir -p "$dir"
    
    cat > "$file" << EOF
# Implementation: ${test_type^} Test #${test_num} Fix

**Task ID**: \`${category}-test-${test_num}-implementation\`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 15-30 minutes  
**Priority**: 🔴 Critical  
**Complexity**: simple to moderate
**GitHub Issue**: To be created for tracking

## Objective

Implement fix for ${category} test #${test_num} based on research analysis, validate the fix works, and ensure test transitions to proper working state.

## Context

**Background**: Implementation of resolution for specific ${category} test based on research analysis.

**Test Category**: ${test_type^} Test  
**Issue Type**: ${category^} Test Resolution

## Input from Research Phase

**Research Context**:
```bash
# Get research findings from corresponding research task
orchestrator_execute_task --task-id="${category}-test-${test_num}-research"
```

## Implementation Strategy

Based on research findings, implement appropriate resolution:

### Common Resolution Categories:
- **Fix and Enable**: Resolve issues so test runs and passes
- **Proper Configuration**: Configure test to behave correctly
- **Environment Setup**: Provide necessary environment for test
- **Timeout/Error Handling**: Add proper timeouts and error handling
- **Documentation**: Document intentional behavior if appropriate

## Implementation Steps

### 1. Review Research Findings
- Load research analysis from research phase
- Understand root cause and recommended approach
- Identify specific changes needed

### 2. Apply Primary Fix
- Implement main solution based on research
- Make minimal, targeted changes
- Focus on resolving core issue

### 3. Validate Resolution
- Test that ${category} issue is resolved
- Verify test behaves as expected
- Check for any new issues introduced

## Expected Resolution Outcomes

**For ${test_type^} Test:**
- **Fixed**: Test now runs successfully and passes
- **Properly Configured**: Test ${category} behavior is intentional and documented
- **Environment Ready**: Test has necessary environment to run
- **Timeout Handled**: Test completes or times out gracefully

## Success Criteria

- [ ] Research findings reviewed and solution implemented
- [ ] Test ${category} issue resolved appropriately
- [ ] No regressions introduced to other tests
- [ ] Implementation documented with validation results
- [ ] Test transitions to expected working state

## Validation Commands

```bash
# Validate fix in GitHub Actions
git add [modified-files]
git commit -m "fix: resolve ${category} test #${test_num} - [description]"
git push origin [branch-name]

# Monitor test execution results
# Verify ${category} test now behaves correctly
```

---

**Navigation**:
- ← Research: [../../00-research-phase/subtasks/$(printf "%02d" $test_num)-${category}-test-${test_num}/research-task.md](../../00-research-phase/subtasks/$(printf "%02d" $test_num)-${category}-test-${test_num}/research-task.md)
- → Back to [Implementation Phase Overview](../README.md)  
- ↑ Priority: [../../index.md](../../index.md)
EOF

    echo "✅ Created implementation task: ${category} test #${test_num}"
}

# Generate Failed Tests (23 tests)
echo "📋 Generating 23 Failed Test tasks..."
for i in {1..23}; do
    create_research_task "failed" "$i" "failed" "07"
    create_implementation_task "failed" "$i" "failed" "07"
done

# Generate Cancelled Tests (4 tests)  
echo "📋 Generating 4 Cancelled Test tasks..."
for i in {1..4}; do
    create_research_task "cancelled" "$i" "cancelled" "08"
    create_implementation_task "cancelled" "$i" "cancelled" "08"
done

# Generate Hanging Tests (6 tests)
echo "📋 Generating 6 Hanging Test tasks..."
for i in {1..6}; do
    create_research_task "hanging" "$i" "hanging" "09"
    create_implementation_task "hanging" "$i" "hanging" "09"
done

# Generate Skipped Tests (4 tests)
echo "📋 Generating 4 Skipped Test tasks..."
for i in {1..4}; do
    create_research_task "skipped" "$i" "skipped" "10"
    create_implementation_task "skipped" "$i" "skipped" "10"
done

echo "🎉 Generated all 74 subtask files!"
echo "📊 Summary:"
echo "   - 23 Failed test tasks (46 files)"
echo "   - 4 Cancelled test tasks (8 files)" 
echo "   - 6 Hanging test tasks (12 files)"
echo "   - 4 Skipped test tasks (8 files)"
echo "   - Total: 37 research + 37 implementation = 74 task files"
echo ""
echo "✨ Phase 3 structure is ready for 74 individual agents!"