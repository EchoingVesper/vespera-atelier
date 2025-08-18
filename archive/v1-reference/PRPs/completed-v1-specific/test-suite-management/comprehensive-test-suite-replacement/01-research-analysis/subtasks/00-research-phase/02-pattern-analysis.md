# Pattern Analysis - Root Cause Identification

**Task ID**: `research-pattern-analysis-002`  
**Type**: Analysis  
**Local LLM Ready**: 🟡 Medium  
**Estimated Duration**: 4 hours  
**Priority**: 🔴 Critical

## Objective

Apply systematic pattern recognition methodology (proven successful in atomic CI fixes) to identify root causes of legacy test failures rather than treating them as individual issues.

## Systematic Approach Integration

**LESSONS LEARNED**: From CI fixes success - pattern recognition identified 18 "different" failures were actually one systematic linting issue. Apply this methodology to test failures.

### Pattern Recognition Framework
- **Look for Common Elements**: Identify shared failure patterns across different test files
- **Root Cause Analysis**: Find systematic issues affecting multiple tests, not individual problems
- **Infrastructure Focus**: Prioritize architectural changes that caused widespread test incompatibility

## Inputs

**Legacy Test Failure Data:**
- Complete inventory from `01-data-gathering.md`
- Test execution logs and error messages
- Git history of Clean Architecture refactor changes
- Current codebase structure and import patterns

**Analysis Tools:**
```bash
# Pattern analysis commands
python tools/test_failure_pattern_analyzer.py --systematic-analysis
grep -r "import.*domain" tests/ > import_pattern_analysis.txt
pytest --tb=short tests/ 2>&1 | grep -E "(FAILED|ERROR)" > failure_patterns.txt
```

## Expected Outputs

### 1. Systematic Failure Pattern Report
**File**: `systematic_test_failure_patterns.json`
```json
{
  "root_causes": [
    {
      "pattern": "Import path changes from Clean Architecture refactor",
      "affected_tests": ["test_legacy_1.py", "test_legacy_2.py", ...],
      "frequency": "85% of failures",
      "systematic_solution": "Update import patterns across all legacy tests"
    },
    {
      "pattern": "Parameter count mismatches in domain entity constructors", 
      "affected_tests": ["test_entities.py", "test_business_logic.py", ...],
      "frequency": "60% of failures",
      "systematic_solution": "Update entity construction patterns to match Clean Architecture"
    }
  ],
  "infrastructure_issues": [
    {
      "issue": "Test database setup incompatible with new repository pattern",
      "impact": "All integration tests failing",
      "systematic_fix": "Rebuild test database infrastructure for Clean Architecture"
    }
  ]
}
```

### 2. Root Cause Categorization
**File**: `root_cause_categorization.md`

**Categories Based on Systematic Analysis:**
- **Import Path Changes**: Clean Architecture refactor changed module structure
- **Constructor Parameter Changes**: Domain entities updated for Clean Architecture
- **Repository Pattern Changes**: Database access patterns completely refactored
- **Dependency Injection Changes**: Application layer now uses DI container
- **Test Infrastructure Obsolescence**: Test helpers incompatible with new architecture

### 3. Multiplicative Impact Solutions
**File**: `multiplicative_impact_solutions.md`

**Solutions That Fix Multiple Issues:**
- **Update Test Infrastructure Foundation**: Fix repository pattern testing infrastructure fixes 40+ tests
- **Create Clean Architecture Test Helpers**: New test utilities solve import and setup issues across 60+ tests  
- **Implement DI Test Container**: Dependency injection test setup fixes 30+ application layer tests

## Success Criteria

### Pattern Recognition Success
- [ ] **Common patterns identified** across multiple failing test files
- [ ] **Root causes documented** rather than individual failure symptoms
- [ ] **Systematic solutions designed** that address multiple test failures with single changes
- [ ] **Infrastructure issues prioritized** based on multiplicative impact potential

### Systematic Analysis Quality
- [ ] **CI fixes methodology applied** using pattern recognition over individual debugging
- [ ] **Multiplicative impact solutions** identified that fix many issues with minimal changes
- [ ] **Infrastructure focus maintained** prioritizing foundational changes
- [ ] **Hook opportunities identified** for preventing similar issues in future

### Analysis Deliverables
- [ ] **Systematic failure pattern report** with root cause categorization
- [ ] **Multiplicative impact solutions** prioritized by breadth of fix
- [ ] **Infrastructure change recommendations** based on pattern analysis
- [ ] **Hook integration opportunities** for preventing future test architecture drift

## Local LLM Prompt Template

**CONTEXT**: Analysis of legacy test failures using systematic pattern recognition methodology proven successful in atomic CI fixes

**TASK**: Identify root causes affecting multiple test failures rather than treating each failure individually

**INPUT**: 
- Legacy test failure logs and error messages
- Git history showing Clean Architecture refactor changes  
- Current codebase structure and architectural patterns

**REQUIREMENTS**:
- Apply pattern recognition methodology from CI fixes success
- Look for systematic issues, not individual problems
- Focus on infrastructure changes with multiplicative impact
- Identify hook opportunities for automated prevention

**OUTPUT_FORMAT**:
```json
{
  "systematic_patterns": [
    {
      "pattern_name": "",
      "root_cause": "",
      "affected_tests": [],
      "failure_frequency": "",
      "systematic_solution": ""
    }
  ],
  "multiplicative_solutions": [
    {
      "solution": "",
      "tests_fixed": "",
      "implementation_effort": "",
      "future_prevention": ""
    }
  ]
}
```

**VALIDATION**: Patterns should affect multiple tests and solutions should fix many issues with single changes

## Agent Instructions

**For Research Specialist Agent:**

```yaml
systematic_approach_execution:
  methodology: "Apply proven CI fixes pattern recognition approach"
  focus: "Identify root causes, not individual symptoms"
  validation: "Solutions must have multiplicative impact across multiple tests"
  
pattern_recognition_requirements:
  - "Look for common elements across different test failures"
  - "Identify architectural changes that caused systematic incompatibility"
  - "Prioritize infrastructure-level solutions over individual test fixes"
  - "Document hook opportunities for preventing future test drift"
  
deliverable_criteria:
  - "Systematic failure patterns with root cause analysis"
  - "Multiplicative impact solutions that fix many tests with single changes"
  - "Infrastructure recommendations based on Clean Architecture alignment"
  - "Hook integration strategy for automated test quality validation"
```

## Validation

### Pattern Analysis Validation
```bash
# Verify pattern analysis completeness
python tools/validate_pattern_analysis.py --file systematic_test_failure_patterns.json

# Check multiplicative impact solutions
python tools/validate_multiplicative_solutions.py --solutions multiplicative_impact_solutions.md

# Validate root cause categorization
python tools/validate_root_causes.py --categories root_cause_categorization.md
```

### Hook Integration Validation
```bash
# Test hook opportunities identified
python tools/validate_hook_opportunities.py --analysis-output ./

# Verify systematic approach application
python tools/validate_systematic_methodology.py --methodology "CI-fixes-pattern-recognition"
```

---

**This analysis applies the proven systematic methodology from atomic CI fixes success to identify root causes of test failures and design multiplicative impact solutions.**