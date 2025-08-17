# Unit Test Fixes Category

**Issue Reference**: GitHub Issue #21
**Category Purpose**: Fix critical unit test failures in vespera-scriptorium
**Total Tasks**: 4 atomic tasks
**LLM Ready**: ✅ All tasks ready for local LLM execution

## Test Failure Analysis

**Current Status**: 104 failures out of 205 tests
**Root Causes Identified**:
1. Missing imports (`GenericTaskRepository` not defined)
2. Constructor signature changes (`StaleTaskDetector`)
3. Model initialization failures
4. Circular dependency issues

## Atomic Tasks

### 01-fix-repository-imports.md
**Purpose**: Fix GenericTaskRepository import issues affecting 20 tests
**LLM Ready**: ✅
**Estimated Time**: 30 minutes

### 02-fix-stale-detector-constructor.md  
**Purpose**: Update StaleTaskDetector constructor calls affecting 12 tests
**LLM Ready**: ✅
**Estimated Time**: 20 minutes

### 03-fix-model-initialization.md
**Purpose**: Fix test_generic_models.py initialization failures affecting 26 tests
**LLM Ready**: ✅
**Estimated Time**: 45 minutes

### 04-fix-remaining-test-failures.md
**Purpose**: Address remaining test failures and ensure clean test run
**LLM Ready**: ✅
**Estimated Time**: 25 minutes

## Validation Commands

```bash
# Test individual modules
cd packages/vespera-scriptorium
./venv/bin/pytest tests/unit/test_generic_repository.py -v
./venv/bin/pytest tests/unit/test_task_lifecycle_manager.py -v
./venv/bin/pytest tests/unit/test_generic_models.py -v

# Full test suite validation
./venv/bin/pytest tests/unit/ -q
```

## Success Criteria

- [ ] All 4 atomic tasks completed
- [ ] pytest tests/unit/ shows 0 failures
- [ ] No import errors in test modules
- [ ] All constructor calls updated
- [ ] Model initialization tests pass